import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { verifySession } from './auth.js';

export const purchasesRouter = Router();

// GET /api/purchases - list purchases with supplier info
purchasesRouter.get('/', (req: Request, res: Response): any => {
  try {
    const { search = '', supplier_id, payment_status, limit = '50', offset = '0' } = req.query;

    let query = `
      SELECT 
        p.id,
        p.purchase_number,
        p.supplier_id,
        s.name as supplier_name,
        s.company as supplier_company,
        p.purchase_date,
        p.subtotal,
        p.tax_amount,
        p.discount_amount,
        p.grand_total,
        p.paid_amount,
        p.due_amount,
        p.payment_status,
        p.notes,
        p.created_by,
        u.name as created_by_name,
        (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) as items_count
      FROM purchases p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN users u ON p.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (p.purchase_number LIKE ? OR s.name LIKE ? OR s.company LIKE ?)`;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }

    if (supplier_id) {
      query += ` AND p.supplier_id = ?`;
      params.push(Number(supplier_id));
    }

    if (payment_status && payment_status !== 'ALL') {
      query += ` AND p.payment_status = ?`;
      params.push(payment_status);
    }

    query += ` ORDER BY p.purchase_date DESC, p.id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit) || 50, Number(offset) || 0);

    const purchases = db.prepare(query).all(...params);

    const summary = db
      .prepare(`
        SELECT 
          COUNT(*) as total_orders,
          COALESCE(SUM(grand_total), 0) as total_purchases_amount,
          COALESCE(SUM(paid_amount), 0) as total_paid,
          COALESCE(SUM(due_amount), 0) as total_payable
        FROM purchases
      `)
      .get() as any;

    return res.json({
      success: true,
      data: purchases,
      summary,
    });
  } catch (error: any) {
    console.error('Error fetching purchases:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve purchases.' });
  }
});

// GET /api/purchases/:id - single purchase bill with line items
purchasesRouter.get('/:id', (req: Request, res: Response): any => {
  try {
    const purchaseId = Number(req.params.id);

    const purchase = db
      .prepare(`
        SELECT 
          p.*,
          s.name as supplier_name,
          s.company as supplier_company,
          s.phone as supplier_phone,
          s.payable_balance as supplier_current_balance,
          u.name as created_by_name
        FROM purchases p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.id = ?
      `)
      .get(purchaseId) as any;

    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase bill not found.' });
    }

    const items = db
      .prepare(`
        SELECT 
          pi.*,
          pr.name as product_name,
          pr.sku,
          pr.unit
        FROM purchase_items pi
        LEFT JOIN products pr ON pi.product_id = pr.id
        WHERE pi.purchase_id = ?
      `)
      .all(purchaseId);

    return res.json({
      success: true,
      data: {
        ...purchase,
        items,
      },
    });
  } catch (error: any) {
    console.error('Error fetching purchase details:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve purchase bill.' });
  }
});

// POST /api/purchases - record new stock inward / purchase bill
purchasesRouter.post('/', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (session?.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only admins can record stock purchases.' });
    }

    const {
      supplier_id,
      items,
      discount_amount = 0,
      tax_amount = 0,
      paid_amount = 0,
      notes = '',
    } = req.body;

    if (!supplier_id) {
      return res.status(400).json({ success: false, message: 'Supplier is required.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one product item is required.' });
    }

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(Number(supplier_id)) as any;
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found.' });
    }

    // Generate Purchase Order Number: e.g. PO-2026-1002
    const year = new Date().getFullYear();
    const lastPO = db.prepare('SELECT id FROM purchases ORDER BY id DESC LIMIT 1').get() as any;
    const nextSeq = lastPO ? lastPO.id + 1001 : 1001;
    const poNumber = `PO-${year}-${nextSeq}`;

    // Validate and calculate totals
    let calculatedSubtotal = 0;
    const validatedItems: {
      productId: number;
      productName: string;
      quantity: number;
      unitCost: number;
      lineTotal: number;
      newSellingPrice?: number;
      stockBefore: number;
      stockAfter: number;
    }[] = [];

    for (const item of items) {
      const prodId = Number(item.product_id);
      const qty = Number(item.quantity);
      const cost = Number(item.unit_cost);

      if (!prodId || isNaN(qty) || qty <= 0 || isNaN(cost) || cost < 0) {
        return res.status(400).json({ success: false, message: 'Invalid product item, quantity, or cost.' });
      }

      const product = db
        .prepare('SELECT id, name, current_stock, purchase_price, selling_price FROM products WHERE id = ?')
        .get(prodId) as any;

      if (!product) {
        return res.status(400).json({ success: false, message: `Product ID ${prodId} not found.` });
      }

      const lineTotal = qty * cost;
      calculatedSubtotal += lineTotal;

      validatedItems.push({
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitCost: cost,
        lineTotal,
        newSellingPrice: item.new_selling_price ? Number(item.new_selling_price) : undefined,
        stockBefore: product.current_stock,
        stockAfter: product.current_stock + qty,
      });
    }

    const orderDiscount = Math.max(0, Number(discount_amount) || 0);
    const orderTax = Math.max(0, Number(tax_amount) || 0);
    const grandTotal = Math.max(0, calculatedSubtotal - orderDiscount + orderTax);

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

    const branchId = Number(req.body.branch_id) || 1;

    // Execute Database Transaction
    db.exec('BEGIN');
    let purchaseId: number;

    try {
      // 1. Insert Purchase
      const poResult = db
        .prepare(`
          INSERT INTO purchases (
            purchase_number, supplier_id, purchase_date, subtotal, tax_amount,
            discount_amount, grand_total, paid_amount, due_amount,
            payment_status, notes, created_by
          ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          poNumber,
          supplier.id,
          calculatedSubtotal,
          orderTax,
          orderDiscount,
          grandTotal,
          paid,
          due,
          paymentStatus,
          notes,
          session.userId
        );

      purchaseId = Number(poResult.lastInsertRowid);

      // 2. Insert line items, update stock & purchase cost
      const insertItemStmt = db.prepare(`
        INSERT INTO purchase_items (
          purchase_id, product_id, quantity, unit_cost, line_total
        ) VALUES (?, ?, ?, ?, ?)
      `);

      const updateStockStmt = db.prepare(`
        UPDATE products 
        SET 
          current_stock = ?,
          purchase_price = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      const updateStockWithSellingStmt = db.prepare(`
        UPDATE products 
        SET 
          current_stock = ?,
          purchase_price = ?,
          selling_price = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      const updateBranchStockStmt = db.prepare(`
        INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock, updated_at)
        VALUES (?, ?, ?, 5, CURRENT_TIMESTAMP)
        ON CONFLICT(branch_id, product_id) DO UPDATE SET 
          current_stock = current_stock + excluded.current_stock,
          updated_at = CURRENT_TIMESTAMP
      `);

      const insertTxStmt = db.prepare(`
        INSERT INTO inventory_transactions (
          product_id, transaction_type, reference_type, reference_id,
          quantity, unit_cost, stock_before, stock_after, notes, created_by, branch_id
        ) VALUES (?, 'PURCHASE', 'PURCHASE', ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of validatedItems) {
        insertItemStmt.run(purchaseId, item.productId, item.quantity, item.unitCost, item.lineTotal);

        if (item.newSellingPrice && item.newSellingPrice > 0) {
          updateStockWithSellingStmt.run(item.stockAfter, item.unitCost, item.newSellingPrice, item.productId);
        } else {
          updateStockStmt.run(item.stockAfter, item.unitCost, item.productId);
        }

        updateBranchStockStmt.run(branchId, item.productId, item.quantity);

        insertTxStmt.run(
          item.productId,
          purchaseId,
          item.quantity,
          item.unitCost,
          item.stockBefore,
          item.stockAfter,
          `Stock Inward from ${supplier.name} (${poNumber})`,
          session.userId,
          branchId
        );
      }

      // 3. Update Supplier Payable Balance
      const newPayable = (supplier.payable_balance || 0) + due;
      db.prepare(`
        UPDATE suppliers 
        SET payable_balance = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(newPayable, supplier.id);

      // 4. If paid > 0, record in supplier_payments
      if (paid > 0) {
        db.prepare(`
          INSERT INTO supplier_payments (supplier_id, purchase_id, amount, payment_method, notes, paid_by)
          VALUES (?, ?, ?, 'Cash', 'Upfront payment on stock inward', ?)
        `).run(supplier.id, purchaseId, paid, session.userId);
      }

      // 5. Audit Log
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, module, record_id, details)
        VALUES (?, 'PURCHASE_STOCK_IN', 'Purchases', ?, ?)
      `).run(
        session.userId,
        purchaseId,
        `Recorded stock inward bill ${poNumber} from ${supplier.name}. Grand Total: Rs. ${grandTotal.toLocaleString()}, Due: Rs. ${due.toLocaleString()}`
      );

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return res.status(201).json({
      success: true,
      message: `Purchase bill ${poNumber} saved successfully and inventory updated.`,
      data: {
        purchase_id: purchaseId,
        purchase_number: poNumber,
      },
    });
  } catch (error: any) {
    console.error('Error creating purchase order:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to record purchase.' });
  }
});
