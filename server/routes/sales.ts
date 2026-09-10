import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { verifySession } from './auth.js';

export const salesRouter = Router();

// GET /api/sales - list sales with search, filters & pagination
salesRouter.get('/', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);
    const isAdmin = session?.role === 'ADMIN';

    const {
      search = '',
      payment_status,
      payment_method,
      delivery_status,
      customer_id,
      branch_id,
      date_from,
      date_to,
      limit = '50',
      offset = '0',
    } = req.query;

    let query = `
      SELECT 
        s.id,
        s.invoice_number,
        s.branch_id,
        b.name as branch_name,
        b.code as branch_code,
        s.customer_id,
        c.name as customer_name,
        c.phone as customer_phone,
        c.is_walk_in,
        s.sale_date,
        s.subtotal,
        s.tax_amount,
        s.discount_amount,
        s.grand_total,
        COALESCE(s.original_grand_total, s.grand_total + COALESCE(s.returned_amount, 0)) as original_grand_total,
        COALESCE(s.net_total, s.grand_total) as net_total,
        COALESCE(s.returned_amount, 0) as returned_amount,
        ${isAdmin ? 's.cogs_total, s.gross_profit,' : '0 as cogs_total, 0 as gross_profit,'}
        s.paid_amount,
        s.due_amount,
        s.payment_method,
        s.payment_status,
        COALESCE(s.delivery_status, 'DELIVERED') as delivery_status,
        (SELECT SUM(si.quantity) FROM sale_items si WHERE si.sale_id = s.id) as total_purchased_qty,
        (SELECT SUM(COALESCE(si.delivered_quantity, si.quantity)) FROM sale_items si WHERE si.sale_id = s.id) as total_delivered_qty,
        (SELECT SUM(MAX(0, si.quantity - COALESCE(si.returned_quantity, 0) - COALESCE(si.delivered_quantity, si.quantity))) FROM sale_items si WHERE si.sale_id = s.id) as total_remaining_qty,
        s.cashier_id,
        COALESCE(s.cashier_name, u.name, 'Terminal') as cashier_name,
        (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as items_count
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.cashier_id = u.id
      LEFT JOIN branches b ON s.branch_id = b.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (s.invoice_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (branch_id && branch_id !== 'all') {
      query += ` AND s.branch_id = ?`;
      params.push(Number(branch_id));
    }

    if (payment_status && payment_status !== 'ALL') {
      query += ` AND s.payment_status = ?`;
      params.push(payment_status);
    }

    if (delivery_status && delivery_status !== 'ALL') {
      query += ` AND s.delivery_status = ?`;
      params.push(delivery_status);
    }

    if (payment_method && payment_method !== 'ALL') {
      query += ` AND s.payment_method = ?`;
      params.push(payment_method);
    }

    if (customer_id) {
      query += ` AND s.customer_id = ?`;
      params.push(Number(customer_id));
    }

    if (date_from) {
      query += ` AND date(s.sale_date) >= date(?)`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND date(s.sale_date) <= date(?)`;
      params.push(date_to);
    }

    // Sort newest first
    query += ` ORDER BY s.sale_date DESC, s.id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit) || 50, Number(offset) || 0);

    const sales = db.prepare(query).all(...params);

    // Summary counts for current filter view
    const summary = db
      .prepare(`
        SELECT 
          COUNT(*) as total_invoices,
          COALESCE(SUM(grand_total), 0) as total_revenue,
          COALESCE(SUM(paid_amount), 0) as total_collected,
          COALESCE(SUM(due_amount), 0) as total_due
        FROM sales
      `)
      .get() as any;

    return res.json({
      success: true,
      data: sales,
      summary,
    });
  } catch (error: any) {
    console.error('Error fetching sales:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve sales.' });
  }
});

// GET /api/sales/:id - get single invoice with itemized line details
salesRouter.get('/:id', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);
    const isAdmin = session?.role === 'ADMIN';

    const saleId = Number(req.params.id);

    const sale = db
      .prepare(`
        SELECT 
          s.*,
          COALESCE(s.original_grand_total, s.grand_total + COALESCE(s.returned_amount, 0)) as original_grand_total,
          COALESCE(s.net_total, s.grand_total) as net_total,
          COALESCE(s.returned_amount, 0) as returned_amount,
          c.name as customer_name,
          c.phone as customer_phone,
          c.address as customer_address,
          c.outstanding_balance as customer_current_balance,
          c.is_walk_in,
          COALESCE(s.cashier_name, u.name, 'Terminal') as cashier_name,
          b.name as branch_name,
          b.code as branch_code,
          b.address as branch_address,
          b.phone as branch_phone
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.cashier_id = u.id
        LEFT JOIN branches b ON s.branch_id = b.id
        WHERE s.id = ?
      `)
      .get(saleId) as any;

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const items = db
      .prepare(`
        SELECT 
          si.id,
          si.product_id,
          p.name as product_name,
          p.sku,
          p.unit,
          si.quantity,
          COALESCE(si.delivered_quantity, si.quantity) as delivered_quantity,
          MAX(0, si.quantity - COALESCE(si.returned_quantity, 0) - COALESCE(si.delivered_quantity, si.quantity)) as remaining_delivery,
          si.unit_price,
          ${isAdmin ? 'si.unit_cost, si.line_profit,' : '0 as unit_cost, 0 as line_profit,'}
          si.discount,
          si.line_total,
          COALESCE(si.returned_quantity, 0) as returned_quantity,
          COALESCE(si.remaining_quantity, si.quantity - COALESCE(si.returned_quantity, 0)) as remaining_quantity
        FROM sale_items si
        LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
      `)
      .all(saleId);

    const returns = db
      .prepare(`
        SELECT 
          sr.*,
          u.name as processed_by_name
        FROM sales_returns sr
        LEFT JOIN users u ON sr.processed_by = u.id
        WHERE sr.sale_id = ?
        ORDER BY sr.id DESC
      `)
      .all(saleId);

    const deliveryLogs = db
      .prepare(`
        SELECT 
          sdl.*,
          p.name as product_name,
          u.name as delivered_by_name
        FROM sale_delivery_logs sdl
        LEFT JOIN sale_items si ON sdl.sale_item_id = si.id
        LEFT JOIN products p ON si.product_id = p.id
        LEFT JOIN users u ON sdl.recorded_by = u.id
        WHERE sdl.sale_id = ?
        ORDER BY sdl.id DESC
      `)
      .all(saleId);

    // Get store settings for receipt headers
    const settingsRows = db.prepare('SELECT key, value FROM settings').all() as any[];
    const settings: Record<string, string> = {};
    for (const r of settingsRows) {
      settings[r.key] = r.value;
    }

    return res.json({
      success: true,
      data: {
        ...sale,
        items,
        returns,
        delivery_logs: deliveryLogs,
        settings,
      },
    });
  } catch (error: any) {
    console.error('Error fetching invoice details:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve invoice.' });
  }
});

// POST /api/sales - create new POS sale transaction
salesRouter.post('/', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session) {
      return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }

    const {
      customer_id = 1, // Default to Walk-in if not provided
      branch_id,
      items,
      discount_amount = 0,
      tax_amount = 0,
      paid_amount = 0,
      payment_method = 'Cash',
      notes = '',
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart must contain at least one item.' });
    }

    // Determine target branch
    const targetBranchId = Number(branch_id) || session.branchId || 1;
    const branch = (db.prepare('SELECT id, name, code FROM branches WHERE id = ?').get(targetBranchId) as any)
      || { id: 1, name: 'Main Store & Central Warehouse', code: 'BR-01' };

    const cashierUser = db.prepare('SELECT name FROM users WHERE id = ?').get(session.userId) as any;
    const cashierName = cashierUser?.name || 'Terminal Cashier';

    // 1. Fetch customer
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(customer_id)) as any;
    if (!customer) {
      return res.status(400).json({ success: false, message: 'Selected customer does not exist.' });
    }

    // 2. Fetch invoice prefix from settings
    const prefixSetting = db.prepare(`SELECT value FROM settings WHERE key = 'invoice_prefix'`).get() as any;
    const prefix = prefixSetting ? prefixSetting.value : 'INV-';

    // 3. Generate sequential invoice number: e.g. INV-2026-1003
    const year = new Date().getFullYear();
    const lastSale = db
      .prepare(`SELECT id, invoice_number FROM sales ORDER BY id DESC LIMIT 1`)
      .get() as any;
    const nextSeq = lastSale ? lastSale.id + 1001 : 1001;
    const invoiceNumber = `${prefix}${year}-${nextSeq}`;

    // 4. Validate products, current stocks, calculate totals
    let calculatedSubtotal = 0;
    let calculatedCogs = 0;
    const validatedItems: {
      productId: number;
      productName: string;
      sku: string;
      unit: string;
      quantity: number;
      deliveredQuantity: number;
      unitPrice: number;
      unitCost: number;
      discount: number;
      lineTotal: number;
      lineProfit: number;
      stockBefore: number;
      stockAfter: number;
    }[] = [];

    for (const item of items) {
      const prodId = Number(item.product_id);
      const qty = Number(item.quantity);
      const unitPrice = Number(item.unit_price);
      const lineDisc = Number(item.discount || 0);

      if (!prodId || isNaN(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: `Invalid item or quantity in cart.` });
      }

      const product = db
        .prepare('SELECT id, name, sku, unit, purchase_price, selling_price, wholesale_price, current_stock FROM products WHERE id = ?')
        .get(prodId) as any;

      if (!product) {
        return res.status(400).json({ success: false, message: `Product ID ${prodId} not found.` });
      }

      const price = !isNaN(unitPrice) && unitPrice > 0 ? unitPrice : product.selling_price;
      const lineTotal = Math.max(0, Math.round((qty * price - lineDisc) * 100) / 100);
      const unitCost = product.purchase_price || 0;
      const cogs = Math.round(qty * unitCost * 100) / 100;
      const profit = Math.round((lineTotal - cogs) * 100) / 100;

      const deliveredQtyInput = item.delivered_quantity !== undefined && item.delivered_quantity !== null
        ? Number(item.delivered_quantity)
        : qty;
      const deliveredQuantity = isNaN(deliveredQtyInput) ? qty : Math.max(0, Math.min(qty, deliveredQtyInput));

      calculatedSubtotal = Math.round((calculatedSubtotal + lineTotal) * 100) / 100;
      calculatedCogs = Math.round((calculatedCogs + cogs) * 100) / 100;

      validatedItems.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unit: product.unit,
        quantity: qty,
        deliveredQuantity,
        unitPrice: price,
        unitCost,
        discount: lineDisc,
        lineTotal,
        lineProfit: profit,
        stockBefore: product.current_stock,
        stockAfter: product.current_stock - qty,
      });
    }

    // Determine overall delivery status for invoice
    let totalPurchasedUnits = 0;
    let totalDeliveredUnits = 0;
    for (const it of validatedItems) {
      totalPurchasedUnits += it.quantity;
      totalDeliveredUnits += it.deliveredQuantity;
    }
    let deliveryStatus: 'DELIVERED' | 'PARTIAL' | 'PENDING' = 'DELIVERED';
    if (totalDeliveredUnits >= totalPurchasedUnits) {
      deliveryStatus = 'DELIVERED';
    } else if (totalDeliveredUnits > 0) {
      deliveryStatus = 'PARTIAL';
    } else {
      deliveryStatus = 'PENDING';
    }

    const orderDiscount = Math.max(0, Math.round((Number(discount_amount) || 0) * 100) / 100);
    const orderTax = Math.max(0, Math.round((Number(tax_amount) || 0) * 100) / 100);
    const grandTotal = Math.max(0, Math.round((calculatedSubtotal - orderDiscount + orderTax) * 100) / 100);
    const grossProfit = Math.round((grandTotal - calculatedCogs) * 100) / 100;

    const enteredPaid = Number(paid_amount);
    const paid = isNaN(enteredPaid) ? 0 : Math.round(enteredPaid * 100) / 100;
    const due = Math.max(0, Math.round((grandTotal - paid) * 100) / 100);

    let paymentStatus: 'PAID' | 'PARTIAL' | 'DUE' = 'PAID';
    if (due <= 0.01) {
      paymentStatus = 'PAID';
    } else if (paid > 0) {
      paymentStatus = 'PARTIAL';
    } else {
      paymentStatus = 'DUE';
    }

    // If customer is walk-in and has due amount, warn or check credit
    if (customer.is_walk_in && due > 0 && payment_method === 'Cash') {
      return res.status(400).json({
        success: false,
        message: 'Walk-in cash customers must pay the full bill. Please select a registered customer for credit (Udhaar).',
      });
    }

    // Begin Database Transaction
    db.exec('BEGIN');
    let saleId: number;

    try {
      // Check for active open cash drawer shift for this branch
      const activeShift = db.prepare(`
        SELECT id FROM cash_drawer_shifts
        WHERE branch_id = ? AND status = 'OPEN'
        ORDER BY id DESC LIMIT 1
      `).get(branch.id) as any;
      const activeShiftId = activeShift ? activeShift.id : null;

      // 5. Insert Sale Record
      const saleResult = db
        .prepare(`
          INSERT INTO sales (
            invoice_number, branch_id, shift_id, cashier_name, customer_id, sale_date, subtotal, tax_amount, discount_amount,
            grand_total, original_grand_total, net_total, returned_amount, cogs_total, gross_profit, paid_amount, due_amount,
            payment_method, payment_status, cashier_id, delivery_status
          ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          invoiceNumber,
          branch.id,
          activeShiftId,
          cashierName,
          customer.id,
          calculatedSubtotal,
          orderTax,
          orderDiscount,
          grandTotal,
          grandTotal,
          grandTotal,
          calculatedCogs,
          grossProfit,
          paid,
          due,
          payment_method,
          paymentStatus,
          session.userId,
          deliveryStatus
        );

      saleId = Number(saleResult.lastInsertRowid);

      // Update active shift running amounts if open
      if (activeShiftId) {
        if (payment_method === 'Cash') {
          db.prepare(`
            UPDATE cash_drawer_shifts
            SET cash_sales_amount = cash_sales_amount + ?,
                total_sales_amount = total_sales_amount + ?
            WHERE id = ?
          `).run(paid, grandTotal, activeShiftId);
        } else {
          db.prepare(`
            UPDATE cash_drawer_shifts
            SET other_sales_amount = other_sales_amount + ?,
                total_sales_amount = total_sales_amount + ?
            WHERE id = ?
          `).run(paid, grandTotal, activeShiftId);
        }
      }

      // 6. Insert Sale Items & Deduct Inventory (Branch-Wise and Global)
      const insertItemStmt = db.prepare(`
        INSERT INTO sale_items (
          sale_id, product_id, quantity, unit_cost, unit_price, discount, line_total, line_profit, returned_quantity, remaining_quantity, delivered_quantity
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `);

      const insertDeliveryLogStmt = db.prepare(`
        INSERT INTO sale_delivery_logs (
          sale_id, sale_item_id, delivered_quantity, total_delivered_after, remaining_after, notes, recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const ensureBranchStockStmt = db.prepare(`
        INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock, updated_at)
        VALUES (?, ?, 0, 5, CURRENT_TIMESTAMP)
        ON CONFLICT(branch_id, product_id) DO NOTHING
      `);

      const deductBranchStockStmt = db.prepare(`
        UPDATE branch_stocks
        SET current_stock = current_stock - ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE branch_id = ? AND product_id = ?
      `);

      const deductGlobalProductStockStmt = db.prepare(`
        UPDATE products 
        SET current_stock = current_stock - ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      const insertTxStmt = db.prepare(`
        INSERT INTO inventory_transactions (
          product_id, transaction_type, reference_type, reference_id,
          quantity, unit_cost, stock_before, stock_after, notes, created_by, branch_id
        ) VALUES (?, 'SALE', 'SALE', ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of validatedItems) {
        const itemResult = insertItemStmt.run(
          saleId,
          item.productId,
          item.quantity,
          item.unitCost,
          item.unitPrice,
          item.discount,
          item.lineTotal,
          item.lineProfit,
          item.quantity,
          item.deliveredQuantity
        );

        const saleItemId = Number(itemResult.lastInsertRowid);
        if (item.deliveredQuantity > 0) {
          insertDeliveryLogStmt.run(
            saleId,
            saleItemId,
            item.deliveredQuantity,
            item.deliveredQuantity,
            Math.max(0, item.quantity - item.deliveredQuantity),
            item.deliveredQuantity === item.quantity ? 'Initial full pickup at checkout' : 'Initial partial pickup at checkout',
            session.userId
          );
        }

        // Ensure row exists in branch_stocks, then deduct
        ensureBranchStockStmt.run(branch.id, item.productId);
        deductBranchStockStmt.run(item.quantity, branch.id, item.productId);

        // Deduct from overall products stock
        deductGlobalProductStockStmt.run(item.quantity, item.productId);

        // Record stock decrement transaction with branch_id
        insertTxStmt.run(
          item.productId,
          saleId,
          -item.quantity,
          item.unitCost,
          item.stockBefore,
          item.stockAfter,
          `Sale Invoice ${invoiceNumber} at ${branch.name}`,
          session.userId,
          branch.id
        );
      }

      // 7. Update Customer Ledger
      const newTotalPurchases = (customer.total_purchases || 0) + grandTotal;
      const newTotalPaid = (customer.total_paid || 0) + paid;
      const newOutstanding = (customer.outstanding_balance || 0) + due;

      db.prepare(`
        UPDATE customers
        SET 
          total_purchases = ?,
          total_paid = ?,
          outstanding_balance = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newTotalPurchases, newTotalPaid, newOutstanding, customer.id);

      // 8. If paid_amount > 0 and customer is non-walk-in, record into customer_payments
      if (paid > 0 && !customer.is_walk_in) {
        db.prepare(`
          INSERT INTO customer_payments (customer_id, sale_id, amount, payment_method, notes, received_by)
          VALUES (?, ?, ?, ?, 'Initial invoice settlement', ?)
        `).run(customer.id, saleId, paid, payment_method, session.userId);
      }

      // 9. Audit Log
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, module, record_id, details)
        VALUES (?, 'CREATE_SALE', 'Sales', ?, ?)
      `).run(
        session.userId,
        saleId,
        `Created invoice ${invoiceNumber} at ${branch.name} for ${customer.name}. Cashier: ${cashierName}. Grand Total: Rs. ${grandTotal.toLocaleString()}`
      );

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    // Fetch full completed invoice for frontend receipt print
    const completedInvoice = db
      .prepare(`
        SELECT 
          s.*,
          COALESCE(s.original_grand_total, s.grand_total) as original_grand_total,
          COALESCE(s.net_total, s.grand_total) as net_total,
          COALESCE(s.returned_amount, 0) as returned_amount,
          c.name as customer_name,
          c.phone as customer_phone,
          c.address as customer_address,
          c.outstanding_balance as customer_current_balance,
          c.is_walk_in,
          COALESCE(s.cashier_name, u.name, 'Terminal Cashier') as cashier_name,
          b.name as branch_name,
          b.code as branch_code,
          b.address as branch_address,
          b.phone as branch_phone
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.cashier_id = u.id
        LEFT JOIN branches b ON s.branch_id = b.id
        WHERE s.id = ?
      `)
      .get(saleId) as any;

    const savedItems = db
      .prepare(`
        SELECT 
          si.*,
          p.name as product_name,
          p.sku,
          p.unit,
          COALESCE(si.delivered_quantity, si.quantity) as delivered_quantity,
          MAX(0, si.quantity - COALESCE(si.returned_quantity, 0) - COALESCE(si.delivered_quantity, si.quantity)) as remaining_delivery,
          COALESCE(si.returned_quantity, 0) as returned_quantity,
          COALESCE(si.remaining_quantity, si.quantity) as remaining_quantity
        FROM sale_items si
        LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
      `)
      .all(saleId);

    // Get settings for print headers
    const settingsRows = db.prepare('SELECT key, value FROM settings').all() as any[];
    const settings: Record<string, string> = {};
    for (const r of settingsRows) {
      settings[r.key] = r.value;
    }

    return res.status(201).json({
      success: true,
      message: `Invoice ${invoiceNumber} generated successfully.`,
      data: {
        invoice: completedInvoice,
        items: savedItems,
        settings,
      },
    });
  } catch (error: any) {
    console.error('Error generating sale invoice:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to process sale.' });
  }
});

// GET /api/sales/lookup/:identifier - Lookup invoice by barcode or invoice number or ID
salesRouter.get('/lookup/:identifier', (req: Request, res: Response): any => {
  try {
    const rawIdentifier = (req.params.identifier || '').trim();
    if (!rawIdentifier) {
      return res.status(400).json({ success: false, message: 'Please provide an invoice number or barcode.' });
    }

    const numId = Number(rawIdentifier);
    const hasNum = !isNaN(numId) && numId > 0;

    // Search by exact invoice number, numeric id, or partial match
    let sale = db
      .prepare(`
        SELECT 
          s.*,
          COALESCE(s.original_grand_total, s.grand_total + COALESCE(s.returned_amount, 0)) as original_grand_total,
          COALESCE(s.net_total, s.grand_total) as net_total,
          COALESCE(s.returned_amount, 0) as returned_amount,
          c.name as customer_name,
          c.phone as customer_phone,
          c.address as customer_address,
          c.outstanding_balance as customer_current_balance,
          c.is_walk_in,
          u.name as cashier_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.cashier_id = u.id
        WHERE UPPER(s.invoice_number) = UPPER(?) 
           OR s.invoice_number = ?
           ${hasNum ? 'OR s.id = ?' : ''}
        LIMIT 1
      `)
      .get(...(hasNum ? [rawIdentifier, rawIdentifier, numId] : [rawIdentifier, rawIdentifier])) as any;

    if (!sale) {
      // Try suffix or contains match if prefix was scanned or entered with minor differences
      sale = db
        .prepare(`
          SELECT 
            s.*,
            COALESCE(s.original_grand_total, s.grand_total + COALESCE(s.returned_amount, 0)) as original_grand_total,
            COALESCE(s.net_total, s.grand_total) as net_total,
            COALESCE(s.returned_amount, 0) as returned_amount,
            c.name as customer_name,
            c.phone as customer_phone,
            c.address as customer_address,
            c.outstanding_balance as customer_current_balance,
            c.is_walk_in,
            u.name as cashier_name
          FROM sales s
          LEFT JOIN customers c ON s.customer_id = c.id
          LEFT JOIN users u ON s.cashier_id = u.id
          WHERE s.invoice_number LIKE ?
          ORDER BY s.id DESC
          LIMIT 1
        `)
        .get(`%${rawIdentifier}%`) as any;
    }

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: `No invoice found matching barcode / ID "${rawIdentifier}". Please verify the receipt.`,
      });
    }

    const items = db
      .prepare(`
        SELECT 
          si.*,
          p.name as product_name,
          p.sku,
          p.barcode,
          p.unit,
          p.current_stock,
          COALESCE(si.delivered_quantity, si.quantity) as delivered_quantity,
          MAX(0, si.quantity - COALESCE(si.returned_quantity, 0) - COALESCE(si.delivered_quantity, si.quantity)) as remaining_delivery,
          COALESCE(si.returned_quantity, 0) as returned_quantity,
          (si.quantity - COALESCE(si.returned_quantity, 0)) as remaining_quantity
        FROM sale_items si
        LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
      `)
      .all(sale.id);

    const returns = db
      .prepare(`
        SELECT 
          sr.*,
          u.name as processed_by_name
        FROM sales_returns sr
        LEFT JOIN users u ON sr.processed_by = u.id
        WHERE sr.sale_id = ?
        ORDER BY sr.id DESC
      `)
      .all(sale.id);

    const deliveryLogs = db
      .prepare(`
        SELECT 
          sdl.*,
          p.name as product_name,
          u.name as delivered_by_name
        FROM sale_delivery_logs sdl
        LEFT JOIN sale_items si ON sdl.sale_item_id = si.id
        LEFT JOIN products p ON si.product_id = p.id
        LEFT JOIN users u ON sdl.recorded_by = u.id
        WHERE sdl.sale_id = ?
        ORDER BY sdl.id DESC
      `)
      .all(sale.id);

    const settingsRows = db.prepare('SELECT key, value FROM settings').all() as any[];
    const settings: Record<string, string> = {};
    for (const r of settingsRows) {
      settings[r.key] = r.value;
    }

    return res.json({
      success: true,
      data: {
        ...sale,
        items,
        returns,
        delivery_logs: deliveryLogs,
        settings,
      },
    });
  } catch (error: any) {
    console.error('Error looking up invoice:', error);
    return res.status(500).json({ success: false, message: 'Failed to search invoice.' });
  }
});

// POST /api/sales/:id/delivery - Update delivered item quantities (Customer picking up remaining balance)
salesRouter.post('/:id/delivery', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session) {
      return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }

    const saleId = Number(req.params.id);
    const { deliveries, notes = '' } = req.body;

    if (!deliveries || !Array.isArray(deliveries) || deliveries.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide at least one item delivery update.' });
    }

    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as any;
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    db.exec('BEGIN');

    try {
      const updateItemStmt = db.prepare(`
        UPDATE sale_items 
        SET delivered_quantity = ?
        WHERE id = ? AND sale_id = ?
      `);

      const logDeliveryStmt = db.prepare(`
        INSERT INTO sale_delivery_logs (
          sale_id, sale_item_id, delivered_quantity, total_delivered_after, remaining_after, notes, recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      let totalUpdatedDelta = 0;

      for (const d of deliveries) {
        const saleItemId = Number(d.sale_item_id);
        const item = db.prepare('SELECT * FROM sale_items WHERE id = ? AND sale_id = ?').get(saleItemId, saleId) as any;
        if (!item) continue;

        const maxAvailable = Math.max(0, item.quantity - (item.returned_quantity || 0));
        const currentDelivered = item.delivered_quantity !== null && item.delivered_quantity !== undefined 
          ? Number(item.delivered_quantity) 
          : item.quantity;

        let newTotalDelivered: number;

        if (d.quantity_delivered_now !== undefined) {
          const qtyNow = Number(d.quantity_delivered_now);
          if (isNaN(qtyNow) || qtyNow <= 0) continue;
          newTotalDelivered = Math.min(maxAvailable, currentDelivered + qtyNow);
        } else if (d.new_total_delivered !== undefined) {
          const totalVal = Number(d.new_total_delivered);
          if (isNaN(totalVal) || totalVal < 0) continue;
          newTotalDelivered = Math.min(maxAvailable, totalVal);
        } else {
          continue;
        }

        const delta = Math.round((newTotalDelivered - currentDelivered) * 100) / 100;
        if (delta !== 0) {
          updateItemStmt.run(newTotalDelivered, saleItemId, saleId);
          const remainingAfter = Math.max(0, maxAvailable - newTotalDelivered);
          logDeliveryStmt.run(
            saleId,
            saleItemId,
            delta,
            newTotalDelivered,
            remainingAfter,
            d.notes || notes || `Customer picked up ${delta} units`,
            session.userId
          );
          totalUpdatedDelta += delta;
        }
      }

      // Check all items for this sale to compute updated overall delivery status
      const allItems = db.prepare('SELECT quantity, returned_quantity, delivered_quantity FROM sale_items WHERE sale_id = ?').all(saleId) as any[];
      let totalPurchased = 0;
      let totalDelivered = 0;
      let allDelivered = true;

      for (const it of allItems) {
        const netPurchased = Math.max(0, it.quantity - (it.returned_quantity || 0));
        const del = it.delivered_quantity !== null && it.delivered_quantity !== undefined 
          ? Math.min(netPurchased, Number(it.delivered_quantity)) 
          : netPurchased;
        totalPurchased += netPurchased;
        totalDelivered += del;
        if (del < netPurchased) {
          allDelivered = false;
        }
      }

      let newStatus: 'DELIVERED' | 'PARTIAL' | 'PENDING' = 'DELIVERED';
      if (allDelivered || totalDelivered >= totalPurchased) {
        newStatus = 'DELIVERED';
      } else if (totalDelivered > 0) {
        newStatus = 'PARTIAL';
      } else {
        newStatus = 'PENDING';
      }

      db.prepare('UPDATE sales SET delivery_status = ? WHERE id = ?').run(newStatus, saleId);

      // Audit Log
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, module, record_id, details)
        VALUES (?, 'UPDATE_DELIVERY', 'Sales', ?, ?)
      `).run(
        session.userId,
        saleId,
        `Updated delivery for invoice ${sale.invoice_number}. Status: ${newStatus}. Items delivered: ${totalUpdatedDelta}`
      );

      db.exec('COMMIT');

      // Return fresh invoice with items and logs
      const updatedSale = db
        .prepare(`
          SELECT 
            s.*,
            COALESCE(s.original_grand_total, s.grand_total + COALESCE(s.returned_amount, 0)) as original_grand_total,
            COALESCE(s.net_total, s.grand_total) as net_total,
            COALESCE(s.returned_amount, 0) as returned_amount,
            COALESCE(s.delivery_status, 'DELIVERED') as delivery_status,
            c.name as customer_name,
            c.phone as customer_phone,
            c.address as customer_address,
            c.outstanding_balance as customer_current_balance,
            c.is_walk_in,
            COALESCE(s.cashier_name, u.name, 'Terminal Cashier') as cashier_name,
            b.name as branch_name,
            b.code as branch_code,
            b.address as branch_address,
            b.phone as branch_phone
          FROM sales s
          LEFT JOIN customers c ON s.customer_id = c.id
          LEFT JOIN users u ON s.cashier_id = u.id
          LEFT JOIN branches b ON s.branch_id = b.id
          WHERE s.id = ?
        `)
        .get(saleId) as any;

      const updatedItems = db
        .prepare(`
          SELECT 
            si.*,
            p.name as product_name,
            p.sku,
            p.barcode,
            p.unit,
            p.current_stock,
            COALESCE(si.delivered_quantity, si.quantity) as delivered_quantity,
            MAX(0, si.quantity - COALESCE(si.returned_quantity, 0) - COALESCE(si.delivered_quantity, si.quantity)) as remaining_delivery,
            COALESCE(si.returned_quantity, 0) as returned_quantity,
            (si.quantity - COALESCE(si.returned_quantity, 0)) as remaining_quantity
          FROM sale_items si
          LEFT JOIN products p ON si.product_id = p.id
          WHERE si.sale_id = ?
        `)
        .all(saleId);

      const deliveryLogsRecord = db
        .prepare(`
          SELECT 
            sdl.*,
            p.name as product_name,
            u.name as delivered_by_name
          FROM sale_delivery_logs sdl
          LEFT JOIN sale_items si ON sdl.sale_item_id = si.id
          LEFT JOIN products p ON si.product_id = p.id
          LEFT JOIN users u ON sdl.recorded_by = u.id
          WHERE sdl.sale_id = ?
          ORDER BY sdl.id DESC
        `)
        .all(saleId);

      const returnsRecord = db
        .prepare(`
          SELECT sr.*, u.name as processed_by_name
          FROM sales_returns sr
          LEFT JOIN users u ON sr.processed_by = u.id
          WHERE sr.sale_id = ?
          ORDER BY sr.id DESC
        `)
        .all(saleId);

      const settingsRowsAll = db.prepare('SELECT key, value FROM settings').all() as any[];
      const settingsMap: Record<string, string> = {};
      for (const r of settingsRowsAll) {
        settingsMap[r.key] = r.value;
      }

      return res.json({
        success: true,
        message: 'Delivery pickup saved successfully. Remaining item balances updated.',
        data: {
          ...updatedSale,
          items: updatedItems,
          delivery_logs: deliveryLogsRecord,
          returns: returnsRecord,
          settings: settingsMap,
        },
      });
    } catch (err: any) {
      db.exec('ROLLBACK');
      throw err;
    }
  } catch (error: any) {
    console.error('Error updating delivery status:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update delivery.' });
  }
});

// POST /api/sales/:id/pay - Quick-Action: Pay / Settle UNPAID or PARTIAL Invoice
salesRouter.post('/:id/pay', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session) {
      return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }

    const saleId = Number(req.params.id);
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as any;

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    if (sale.due_amount <= 0) {
      return res.status(400).json({
        success: false,
        message: `Invoice ${sale.invoice_number} is already marked as FULLY PAID.`,
      });
    }

    const {
      amount,
      payment_method = 'Cash',
      notes = 'Settled via POS quick invoice payment',
    } = req.body;

    const paymentAmount = amount !== undefined && !isNaN(Number(amount)) && Number(amount) > 0
      ? Number(amount)
      : sale.due_amount;

    if (paymentAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    }

    const actualPayment = Math.min(paymentAmount, sale.due_amount);
    const newPaidAmount = sale.paid_amount + actualPayment;
    const newDueAmount = Math.max(0, sale.due_amount - actualPayment);
    const newStatus = newDueAmount <= 0.01 ? 'PAID' : 'PARTIAL';

    db.exec('BEGIN');
    try {
      // 1. Update sale record
      db.prepare(`
        UPDATE sales
        SET paid_amount = ?, due_amount = ?, payment_status = ?
        WHERE id = ?
      `).run(newPaidAmount, newDueAmount, newStatus, saleId);

      // 2. Update customer ledger
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(sale.customer_id) as any;
      if (customer) {
        const newCustPaid = (customer.total_paid || 0) + actualPayment;
        const newCustOutstanding = Math.max(0, (customer.outstanding_balance || 0) - actualPayment);

        db.prepare(`
          UPDATE customers
          SET total_paid = ?, outstanding_balance = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newCustPaid, newCustOutstanding, customer.id);

        // 3. Record in customer_payments
        db.prepare(`
          INSERT INTO customer_payments (customer_id, sale_id, amount, payment_method, notes, received_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(customer.id, saleId, actualPayment, payment_method, notes, session.userId);
      }

      // 4. Audit Log
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, module, record_id, details)
        VALUES (?, 'SETTLE_INVOICE_PAYMENT', 'Sales', ?, ?)
      `).run(
        session.userId,
        saleId,
        `Collected payment of Rs. ${actualPayment.toLocaleString()} for Invoice ${sale.invoice_number}. New status: ${newStatus}. Method: ${payment_method}`
      );

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    // Return updated sale
    const updatedSale = db
      .prepare(`
        SELECT 
          s.*,
          c.name as customer_name,
          c.phone as customer_phone,
          c.outstanding_balance as customer_current_balance,
          u.name as cashier_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.cashier_id = u.id
        WHERE s.id = ?
      `)
      .get(saleId);

    return res.json({
      success: true,
      message: `Payment of Rs. ${actualPayment.toLocaleString()} recorded. Invoice marked as ${newStatus}.`,
      data: updatedSale,
    });
  } catch (error: any) {
    console.error('Error settling invoice payment:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to process payment.' });
  }
});

// POST /api/sales/:id/returns - Process item returns, restock inventory & adjust financials
salesRouter.post('/:id/returns', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session) {
      return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }

    const saleId = Number(req.params.id);
    const sale = db
      .prepare(`
        SELECT s.*, c.name as customer_name, c.is_walk_in, c.outstanding_balance as customer_current_balance
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.id = ?
      `)
      .get(saleId) as any;

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const { items, refund_action = 'AUTO', notes = '' } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items specified for return.' });
    }

    // Validate return items against original sale_items
    const existingItems = db
      .prepare('SELECT * FROM sale_items WHERE sale_id = ?')
      .all(saleId) as any[];

    const validatedReturns: {
      saleItemId: number;
      productId: number;
      productName: string;
      returnQty: number;
      unitPrice: number;
      unitCost: number;
      refundLineTotal: number;
      stockBefore: number;
      stockAfter: number;
      reason: string;
    }[] = [];

    let totalRefundAmount = 0;

    for (const ret of items) {
      const saleItemId = Number(ret.sale_item_id);
      const returnQty = Number(ret.return_quantity);
      const reason = (ret.reason || notes || 'Customer return / exchange').trim();

      if (isNaN(returnQty) || returnQty <= 0) {
        continue;
      }

      const originalLine = existingItems.find((i) => i.id === saleItemId);
      if (!originalLine) {
        return res.status(400).json({
          success: false,
          message: `Item ID ${saleItemId} does not belong to Invoice ${sale.invoice_number}.`,
        });
      }

      const alreadyReturned = Number(originalLine.returned_quantity || 0);
      const maxReturnable = originalLine.quantity - alreadyReturned;

      if (returnQty > maxReturnable) {
        return res.status(400).json({
          success: false,
          message: `Cannot return ${returnQty} units. Only ${maxReturnable} units are returnable for this item.`,
        });
      }

      const product = db
        .prepare('SELECT id, name, current_stock, purchase_price FROM products WHERE id = ?')
        .get(originalLine.product_id) as any;

      if (!product) {
        return res.status(400).json({ success: false, message: `Product ${originalLine.product_id} not found.` });
      }

      // Unit price accounting for item-level discount if any
      const effectiveUnitPrice = originalLine.quantity > 0
        ? originalLine.line_total / originalLine.quantity
        : originalLine.unit_price;

      const refundLineTotal = Math.round(returnQty * effectiveUnitPrice * 100) / 100;
      totalRefundAmount += refundLineTotal;

      validatedReturns.push({
        saleItemId: originalLine.id,
        productId: product.id,
        productName: product.name,
        returnQty,
        unitPrice: originalLine.unit_price,
        unitCost: product.purchase_price || originalLine.unit_cost || 0,
        refundLineTotal,
        stockBefore: product.current_stock,
        stockAfter: product.current_stock + returnQty,
        reason,
      });
    }

    if (validatedReturns.length === 0) {
      return res.status(400).json({ success: false, message: 'Please specify a valid quantity greater than 0 to return.' });
    }

    // Generate sequential Return Number: e.g. RET-2026-0001
    const year = new Date().getFullYear();
    const lastReturn = db.prepare('SELECT id FROM sales_returns ORDER BY id DESC LIMIT 1').get() as any;
    const nextRetSeq = lastReturn ? lastReturn.id + 1001 : 1001;
    const returnNumber = `RET-${year}-${nextRetSeq}`;

    // Financial calculations:
    // Case 1: Original bill has pending due (UNPAID / PARTIAL)
    // Offset the due amount first, reducing customer's outstanding balance!
    let cashRefundAmount = 0;
    let ledgerCreditAmount = 0;
    let refundType: 'CASH_REFUND' | 'LEDGER_ADJUSTMENT' | 'MIXED' = 'CASH_REFUND';

    const currentDue = sale.due_amount || 0;

    if (currentDue > 0) {
      // Due covers all or part of the return value
      const dueDeduction = Math.min(currentDue, totalRefundAmount);
      const excessReturn = totalRefundAmount - dueDeduction;

      ledgerCreditAmount = dueDeduction;

      if (excessReturn > 0) {
        if (refund_action === 'LEDGER_ADJUSTMENT' && !sale.is_walk_in) {
          ledgerCreditAmount += excessReturn;
          refundType = 'LEDGER_ADJUSTMENT';
        } else {
          cashRefundAmount = excessReturn;
          refundType = 'MIXED';
        }
      } else {
        refundType = 'LEDGER_ADJUSTMENT';
      }
    } else {
      // Bill was FULLY PAID
      if (refund_action === 'LEDGER_ADJUSTMENT' && !sale.is_walk_in) {
        ledgerCreditAmount = totalRefundAmount;
        refundType = 'LEDGER_ADJUSTMENT';
      } else {
        cashRefundAmount = totalRefundAmount;
        refundType = 'CASH_REFUND';
      }
    }

    db.exec('BEGIN');
    let returnId: number;

    try {
      // 1. Insert into sales_returns
      const returnResult = db
        .prepare(`
          INSERT INTO sales_returns (
            return_number, sale_id, customer_id, total_refund_amount,
            refund_type, cash_refund_amount, ledger_credit_amount, reason, processed_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          returnNumber,
          saleId,
          sale.customer_id,
          totalRefundAmount,
          refundType,
          cashRefundAmount,
          ledgerCreditAmount,
          notes,
          session.userId
        );

      returnId = Number(returnResult.lastInsertRowid);

      // 2. Insert items, restock inventory, and update sale_items.returned_quantity
      const insertReturnItemStmt = db.prepare(`
        INSERT INTO sales_return_items (
          return_id, sale_item_id, product_id, returned_quantity, unit_price, refund_line_total
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      const saleBranchId = sale.branch_id || 1;

      const ensureBranchStockStmt = db.prepare(`
        INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock, updated_at)
        VALUES (?, ?, 0, 5, CURRENT_TIMESTAMP)
        ON CONFLICT(branch_id, product_id) DO NOTHING
      `);

      const restockBranchStockStmt = db.prepare(`
        UPDATE branch_stocks
        SET current_stock = current_stock + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE branch_id = ? AND product_id = ?
      `);

      const restockGlobalProductStockStmt = db.prepare(`
        UPDATE products 
        SET current_stock = current_stock + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      const insertTxStmt = db.prepare(`
        INSERT INTO inventory_transactions (
          product_id, transaction_type, reference_type, reference_id,
          quantity, unit_cost, stock_before, stock_after, notes, created_by, branch_id
        ) VALUES (?, 'SALE_RETURN', 'SALE_RETURN', ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updateSaleItemStmt = db.prepare(`
        UPDATE sale_items 
        SET 
          returned_quantity = COALESCE(returned_quantity, 0) + ?,
          remaining_quantity = MAX(0, quantity - (COALESCE(returned_quantity, 0) + ?))
        WHERE id = ?
      `);

      for (const item of validatedReturns) {
        insertReturnItemStmt.run(
          returnId,
          item.saleItemId,
          item.productId,
          item.returnQty,
          item.unitPrice,
          item.refundLineTotal
        );

        // Restock branch inventory
        ensureBranchStockStmt.run(saleBranchId, item.productId);
        restockBranchStockStmt.run(item.returnQty, saleBranchId, item.productId);

        // Restock global product current_stock
        restockGlobalProductStockStmt.run(item.returnQty, item.productId);

        // Record restock in inventory_transactions with branch_id
        insertTxStmt.run(
          item.productId,
          returnId,
          item.returnQty,
          item.unitCost,
          item.stockBefore,
          item.stockAfter,
          `Return Slip ${returnNumber} for Invoice ${sale.invoice_number} (${item.reason})`,
          session.userId,
          saleBranchId
        );

        // Mark quantity returned & remaining in sale_items
        updateSaleItemStmt.run(item.returnQty, item.returnQty, item.saleItemId);
      }

      // 3. Adjust Sale Financials (Recalculate Net Total, Grand Total, Due, and Paid)
      const originalGrandTotal = Number(sale.original_grand_total || (sale.grand_total + (sale.returned_amount || 0)));
      const newReturnedAmount = Number((sale.returned_amount || 0) + totalRefundAmount);
      // Net Payable Amount = Original Total - Total Returned Items Value
      const newNetTotal = Math.max(0, Math.round((originalGrandTotal - newReturnedAmount) * 100) / 100);
      const newGrandTotal = newNetTotal;

      const newDueAmount = Math.max(0, Math.round((currentDue - ledgerCreditAmount) * 100) / 100);
      const newPaidAmount = Math.max(0, Math.round((newNetTotal - newDueAmount) * 100) / 100);
      const newPaymentStatus = newDueAmount <= 0.01 ? 'PAID' : (newPaidAmount > 0 ? 'PARTIAL' : 'DUE');

      // Adjust COGS and Gross Profit
      let totalReturnedCogs = 0;
      for (const item of validatedReturns) {
        totalReturnedCogs += item.returnQty * item.unitCost;
      }
      const newCogs = Math.max(0, Math.round(((sale.cogs_total || 0) - totalReturnedCogs) * 100) / 100);
      const newGrossProfit = Math.max(0, Math.round((newNetTotal - newCogs) * 100) / 100);

      db.prepare(`
        UPDATE sales
        SET 
          original_grand_total = COALESCE(original_grand_total, ?),
          grand_total = ?,
          net_total = ?,
          returned_amount = ?,
          paid_amount = ?,
          due_amount = ?,
          payment_status = ?,
          cogs_total = ?,
          gross_profit = ?
        WHERE id = ?
      `).run(
        originalGrandTotal,
        newGrandTotal,
        newNetTotal,
        newReturnedAmount,
        newPaidAmount,
        newDueAmount,
        newPaymentStatus,
        newCogs,
        newGrossProfit,
        saleId
      );

      // 4. Adjust Customer Ledger if non-walk-in or if ledger was credited
      if (ledgerCreditAmount > 0) {
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(sale.customer_id) as any;
        if (customer) {
          const newCustOutstanding = Math.max(0, (customer.outstanding_balance || 0) - ledgerCreditAmount);
          db.prepare(`
            UPDATE customers
            SET outstanding_balance = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(newCustOutstanding, customer.id);
        }
      }

      // If cash was refunded, deduct from active branch cash drawer shift
      if (cashRefundAmount > 0) {
        const activeShift = db.prepare(`
          SELECT id FROM cash_drawer_shifts
          WHERE branch_id = ? AND status = 'OPEN'
          ORDER BY id DESC LIMIT 1
        `).get(saleBranchId) as any;
        if (activeShift) {
          db.prepare(`
            UPDATE cash_drawer_shifts
            SET cash_refunds_amount = cash_refunds_amount + ?
            WHERE id = ?
          `).run(cashRefundAmount, activeShift.id);
        }
      }

      // 5. Audit Log
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, module, record_id, details)
        VALUES (?, 'SALES_RETURN', 'Sales', ?, ?)
      `).run(
        session.userId,
        saleId,
        `Processed Return ${returnNumber} on Invoice ${sale.invoice_number}. Restocked ${validatedReturns.length} item types. Refund: Rs. ${totalRefundAmount.toLocaleString()} (Cash: Rs. ${cashRefundAmount.toLocaleString()}, Ledger Deduct: Rs. ${ledgerCreditAmount.toLocaleString()})`
      );

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    // Return the updated sale & return slip info
    const updatedInvoice = db
      .prepare(`
        SELECT 
          s.*,
          COALESCE(s.original_grand_total, s.grand_total + COALESCE(s.returned_amount, 0)) as original_grand_total,
          COALESCE(s.net_total, s.grand_total) as net_total,
          COALESCE(s.returned_amount, 0) as returned_amount,
          c.name as customer_name,
          c.phone as customer_phone,
          c.outstanding_balance as customer_current_balance,
          c.is_walk_in,
          u.name as cashier_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.cashier_id = u.id
        WHERE s.id = ?
      `)
      .get(saleId) as any;

    const updatedItems = db
      .prepare(`
        SELECT 
          si.*,
          p.name as product_name,
          p.sku,
          p.unit,
          p.current_stock,
          COALESCE(si.returned_quantity, 0) as returned_quantity,
          (si.quantity - COALESCE(si.returned_quantity, 0)) as remaining_quantity
        FROM sale_items si
        LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
      `)
      .all(saleId);

    return res.status(201).json({
      success: true,
      message: `Return ${returnNumber} processed successfully. Inventory restocked!`,
      data: {
        return_id: returnId,
        return_number: returnNumber,
        total_refund_amount: totalRefundAmount,
        cash_refund_amount: cashRefundAmount,
        ledger_credit_amount: ledgerCreditAmount,
        refund_type: refundType,
        invoice: updatedInvoice,
        items: updatedItems,
      },
    });
  } catch (error: any) {
    console.error('Error processing sales return:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to process return.' });
  }
});

