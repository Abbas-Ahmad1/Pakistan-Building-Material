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
      customer_id,
      date_from,
      date_to,
      limit = '50',
      offset = '0',
    } = req.query;

    let query = `
      SELECT 
        s.id,
        s.invoice_number,
        s.customer_id,
        c.name as customer_name,
        c.phone as customer_phone,
        c.is_walk_in,
        s.sale_date,
        s.subtotal,
        s.tax_amount,
        s.discount_amount,
        s.grand_total,
        ${isAdmin ? 's.cogs_total, s.gross_profit,' : '0 as cogs_total, 0 as gross_profit,'}
        s.paid_amount,
        s.due_amount,
        s.payment_method,
        s.payment_status,
        s.cashier_id,
        u.name as cashier_name,
        (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) as items_count
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.cashier_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (s.invoice_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (payment_status && payment_status !== 'ALL') {
      query += ` AND s.payment_status = ?`;
      params.push(payment_status);
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
          c.name as customer_name,
          c.phone as customer_phone,
          c.address as customer_address,
          c.outstanding_balance as customer_current_balance,
          u.name as cashier_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.cashier_id = u.id
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
          si.unit_price,
          ${isAdmin ? 'si.unit_cost, si.line_profit,' : '0 as unit_cost, 0 as line_profit,'}
          si.discount,
          si.line_total
        FROM sale_items si
        LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
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
      const lineTotal = Math.max(0, qty * price - lineDisc);
      const unitCost = product.purchase_price || 0;
      const cogs = qty * unitCost;
      const profit = lineTotal - cogs;

      calculatedSubtotal += lineTotal;
      calculatedCogs += cogs;

      validatedItems.push({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unit: product.unit,
        quantity: qty,
        unitPrice: price,
        unitCost,
        discount: lineDisc,
        lineTotal,
        lineProfit: profit,
        stockBefore: product.current_stock,
        stockAfter: product.current_stock - qty,
      });
    }

    const orderDiscount = Math.max(0, Number(discount_amount) || 0);
    const orderTax = Math.max(0, Number(tax_amount) || 0);
    const grandTotal = Math.max(0, calculatedSubtotal - orderDiscount + orderTax);
    const grossProfit = grandTotal - calculatedCogs;

    const enteredPaid = Number(paid_amount);
    const paid = isNaN(enteredPaid) ? 0 : enteredPaid;
    const due = Math.max(0, grandTotal - paid);

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
      // 5. Insert Sale Record
      const saleResult = db
        .prepare(`
          INSERT INTO sales (
            invoice_number, customer_id, sale_date, subtotal, tax_amount, discount_amount,
            grand_total, cogs_total, gross_profit, paid_amount, due_amount,
            payment_method, payment_status, cashier_id
          ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          invoiceNumber,
          customer.id,
          calculatedSubtotal,
          orderTax,
          orderDiscount,
          grandTotal,
          calculatedCogs,
          grossProfit,
          paid,
          due,
          payment_method,
          paymentStatus,
          session.userId
        );

      saleId = Number(saleResult.lastInsertRowid);

      // 6. Insert Sale Items & Deduct Inventory
      const insertItemStmt = db.prepare(`
        INSERT INTO sale_items (
          sale_id, product_id, quantity, unit_cost, unit_price, discount, line_total, line_profit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updateStockStmt = db.prepare(`
        UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `);

      const insertTxStmt = db.prepare(`
        INSERT INTO inventory_transactions (
          product_id, transaction_type, reference_type, reference_id,
          quantity, unit_cost, stock_before, stock_after, notes, created_by
        ) VALUES (?, 'SALE', 'SALE', ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of validatedItems) {
        insertItemStmt.run(
          saleId,
          item.productId,
          item.quantity,
          item.unitCost,
          item.unitPrice,
          item.discount,
          item.lineTotal,
          item.lineProfit
        );

        // Update product stock balance
        updateStockStmt.run(item.stockAfter, item.productId);

        // Record stock decrement transaction
        insertTxStmt.run(
          item.productId,
          saleId,
          -item.quantity,
          item.unitCost,
          item.stockBefore,
          item.stockAfter,
          `Sale Invoice ${invoiceNumber}`,
          session.userId
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
        `Created invoice ${invoiceNumber} for ${customer.name}. Grand Total: Rs. ${grandTotal.toLocaleString()}, Paid: Rs. ${paid.toLocaleString()}, Due: Rs. ${due.toLocaleString()}`
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
          c.name as customer_name,
          c.phone as customer_phone,
          c.address as customer_address,
          c.outstanding_balance as customer_current_balance,
          u.name as cashier_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.cashier_id = u.id
        WHERE s.id = ?
      `)
      .get(saleId) as any;

    const savedItems = db
      .prepare(`
        SELECT 
          si.*,
          p.name as product_name,
          p.sku,
          p.unit
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
