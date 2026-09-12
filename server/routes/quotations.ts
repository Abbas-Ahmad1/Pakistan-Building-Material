import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { verifySession } from './auth.js';

export const quotationsRouter = Router();

// GET /api/quotations
quotationsRouter.get('/', (req: Request, res: Response): any => {
  try {
    const { search = '', status = 'all' } = req.query;

    let query = `
      SELECT 
        q.id,
        q.quotation_number,
        q.customer_id,
        q.customer_name,
        q.customer_phone,
        q.project_title,
        q.valid_until,
        q.subtotal,
        q.discount_amount,
        q.grand_total,
        q.status,
        q.notes,
        q.created_by,
        u.name as creator_name,
        q.created_at,
        (SELECT COUNT(*) FROM quotation_items qi WHERE qi.quotation_id = q.id) as items_count
      FROM quotations q
      LEFT JOIN users u ON q.created_by = u.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (search) {
      query += ` AND (q.quotation_number LIKE ? OR q.customer_name LIKE ? OR q.customer_phone LIKE ? OR q.project_title LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (status !== 'all' && status) {
      query += ` AND q.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY q.id DESC`;

    const quotations = db.prepare(query).all(...params);

    return res.json({ success: true, data: quotations });
  } catch (err: any) {
    console.error('Error fetching quotations:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/quotations/:id
quotationsRouter.get('/:id', (req: Request, res: Response): any => {
  try {
    const id = Number(req.params.id);
    const quotation = db.prepare(`
      SELECT 
        q.*,
        u.name as creator_name
      FROM quotations q
      LEFT JOIN users u ON q.created_by = u.id
      WHERE q.id = ?
    `).get(id) as any;

    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    const items = db.prepare(`
      SELECT 
        qi.*,
        p.name as product_name,
        p.sku,
        p.unit,
        p.brand,
        p.current_stock
      FROM quotation_items qi
      JOIN products p ON qi.product_id = p.id
      WHERE qi.quotation_id = ?
    `).all(id);

    return res.json({
      success: true,
      data: {
        ...quotation,
        items,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/quotations - Create new quotation
quotationsRouter.post('/', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);
    const userId = session?.userId || 1;

    const {
      customer_id,
      customer_name,
      customer_phone,
      project_title,
      valid_until,
      discount_amount = 0,
      notes = '',
      items = [],
    } = req.body;

    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ success: false, message: 'Customer or contractor name is required.' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one item is required in the estimate.' });
    }

    // Generate quotation number (QT-YYYY-XXXX)
    const year = new Date().getFullYear();
    const countRow = db.prepare(`SELECT COUNT(*) as count FROM quotations`).get() as any;
    const nextSeq = (countRow?.count || 0) + 1;
    const quotationNumber = `QT-${year}-${String(nextSeq).padStart(4, '0')}`;

    let subtotal = 0;
    for (const it of items) {
      subtotal += Number(it.quantity) * Number(it.unit_price);
    }
    const discount = Number(discount_amount) || 0;
    const grandTotal = Math.max(0, subtotal - discount);

    const validDate = valid_until || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Insert quotation
    const insQuot = db.prepare(`
      INSERT INTO quotations (
        quotation_number, customer_id, customer_name, customer_phone,
        project_title, valid_until, subtotal, discount_amount, grand_total,
        status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SENT', ?, ?)
    `);

    const result = insQuot.run(
      quotationNumber,
      customer_id || null,
      customer_name.trim(),
      customer_phone?.trim() || null,
      project_title?.trim() || 'General Construction / Renovation Estimate',
      validDate,
      subtotal,
      discount,
      grandTotal,
      notes?.trim() || null,
      userId
    );

    const quotationId = Number(result.lastInsertRowid);

    // Insert items
    const insItem = db.prepare(`
      INSERT INTO quotation_items (quotation_id, product_id, quantity, unit_price, line_total)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const it of items) {
      const lineTotal = Number(it.quantity) * Number(it.unit_price);
      insItem.run(quotationId, Number(it.product_id), Number(it.quantity), Number(it.unit_price), lineTotal);
    }

    // Audit log
    try {
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, module, record_id, details)
        VALUES (?, 'CREATE_QUOTATION', 'Quotations', ?, ?)
      `).run(
        userId,
        quotationId,
        `Generated quotation ${quotationNumber} for ${customer_name} (Total: Rs. ${grandTotal.toLocaleString()})`
      );
    } catch (_) {}

    return res.json({
      success: true,
      message: 'Quotation created successfully.',
      data: { id: quotationId, quotation_number: quotationNumber },
    });
  } catch (err: any) {
    console.error('Error creating quotation:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/quotations/:id/convert-to-sale - One click convert to confirmed invoice
quotationsRouter.post('/:id/convert-to-sale', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);
    const userId = session?.userId || 1;

    const id = Number(req.params.id);
    const { payment_method = 'Cash', paid_amount } = req.body;

    const quotation = db.prepare(`SELECT * FROM quotations WHERE id = ?`).get(id) as any;
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    if (quotation.status === 'CONVERTED') {
      return res.status(400).json({ success: false, message: 'This quotation has already been converted into a sale.' });
    }

    const items = db.prepare(`
      SELECT qi.*, p.purchase_price, p.current_stock
      FROM quotation_items qi
      JOIN products p ON qi.product_id = p.id
      WHERE qi.quotation_id = ?
    `).all(id) as any[];

    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'Quotation has no items.' });
    }

    // Generate Invoice Number
    const year = new Date().getFullYear();
    const countRow = db.prepare(`SELECT COUNT(*) as count FROM sales`).get() as any;
    const nextInvoiceSeq = (countRow?.count || 0) + 1001;
    const invoiceNumber = `INV-${year}-${nextInvoiceSeq}`;

    let totalCogs = 0;
    for (const it of items) {
      totalCogs += Math.round(Number(it.quantity) * Number(it.purchase_price || 0) * 100) / 100;
    }

    const grandTotal = Math.round(Number(quotation.grand_total) * 100) / 100;
    const actualPaid = paid_amount !== undefined ? Math.round(Number(paid_amount) * 100) / 100 : grandTotal;
    const dueAmount = Math.max(0, Math.round((grandTotal - actualPaid) * 100) / 100);
    const paymentStatus = dueAmount <= 0.01 ? 'PAID' : actualPaid > 0 ? 'PARTIAL' : 'DUE';
    const grossProfit = Math.round((grandTotal - totalCogs) * 100) / 100;

    // Use existing or default customer
    let custId = quotation.customer_id;
    if (!custId) {
      // Find or create customer
      const existingCust = db.prepare(`SELECT id FROM customers WHERE phone = ?`).get(quotation.customer_phone) as any;
      if (existingCust) {
        custId = existingCust.id;
      } else {
        const insCust = db.prepare(`
          INSERT INTO customers (name, phone, address, credit_limit, is_walk_in)
          VALUES (?, ?, 'From Quotation', 50000, 0)
        `).run(quotation.customer_name, quotation.customer_phone || '');
        custId = Number(insCust.lastInsertRowid);
      }
    }

    const branchId = 1;

    db.exec('BEGIN');
    let saleId: number;

    try {
      // Insert Sale
      const insSale = db.prepare(`
        INSERT INTO sales (
          invoice_number, customer_id, branch_id, sale_date, subtotal, tax_amount, discount_amount,
          grand_total, original_grand_total, net_total, returned_amount, cogs_total, gross_profit,
          paid_amount, due_amount, payment_method, payment_status, cashier_id
        ) VALUES (?, ?, ?, datetime('now'), ?, 0, ?, ?, ?, ?, 0.00, ?, ?, ?, ?, ?, ?, ?)
      `);

      const saleRes = insSale.run(
        invoiceNumber,
        custId,
        branchId,
        quotation.subtotal,
        quotation.discount_amount,
        grandTotal,
        grandTotal,
        grandTotal,
        totalCogs,
        grossProfit,
        actualPaid,
        dueAmount,
        payment_method,
        paymentStatus,
        userId
      );

      saleId = Number(saleRes.lastInsertRowid);

      // Insert Sale Items & Deduct Stock from both branch_stocks and products
      const insSaleItem = db.prepare(`
        INSERT INTO sale_items (
          sale_id, product_id, quantity, unit_cost, unit_price, discount, line_total, line_profit,
          returned_quantity, remaining_quantity
        ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, 0.00, ?)
      `);

      const updateGlobalStock = db.prepare(`
        UPDATE products SET current_stock = current_stock - ?, updated_at = datetime('now') WHERE id = ?
      `);

      const updateBranchStock = db.prepare(`
        INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock, updated_at)
        VALUES (?, ?, -?, 5, CURRENT_TIMESTAMP)
        ON CONFLICT(branch_id, product_id) DO UPDATE SET 
          current_stock = current_stock - excluded.current_stock,
          updated_at = CURRENT_TIMESTAMP
      `);

      const insertTxStmt = db.prepare(`
        INSERT INTO inventory_transactions (
          product_id, transaction_type, reference_type, reference_id,
          quantity, unit_cost, stock_before, stock_after, notes, created_by, branch_id
        ) VALUES (?, 'SALE', 'INVOICE', ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const it of items) {
        const qty = Number(it.quantity);
        const lineCost = Math.round(qty * Number(it.purchase_price || 0) * 100) / 100;
        const lineTotal = Math.round(Number(it.line_total) * 100) / 100;
        const lineProfit = Math.round((lineTotal - lineCost) * 100) / 100;

        insSaleItem.run(saleId, it.product_id, qty, it.purchase_price, it.unit_price, lineTotal, lineProfit, qty);
        updateGlobalStock.run(qty, it.product_id);
        updateBranchStock.run(branchId, it.product_id, qty);

        insertTxStmt.run(
          it.product_id,
          saleId,
          -qty,
          it.purchase_price || 0,
          it.current_stock || 0,
          (it.current_stock || 0) - qty,
          `Sale from Quotation conversion ${quotation.quotation_number} (${invoiceNumber})`,
          userId,
          branchId
        );
      }

      // Update Customer Khata if due
      if (dueAmount > 0) {
        db.prepare(`
          UPDATE customers 
          SET total_purchases = total_purchases + ?,
              total_paid = total_paid + ?,
              outstanding_balance = outstanding_balance + ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(grandTotal, actualPaid, dueAmount, custId);
      } else {
        db.prepare(`
          UPDATE customers 
          SET total_purchases = total_purchases + ?,
              total_paid = total_paid + ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(grandTotal, actualPaid, custId);
      }

      // Mark quotation as CONVERTED
      db.prepare(`UPDATE quotations SET status = 'CONVERTED' WHERE id = ?`).run(id);

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, module, record_id, details)
        VALUES (?, 'CONVERT_QUOTATION_TO_SALE', 'Quotations', ?, ?)
      `).run(
        userId,
        saleId,
        `Converted quotation ${quotation.quotation_number} to invoice ${invoiceNumber} for Rs. ${grandTotal.toLocaleString()}`
      );

      db.exec('COMMIT');
    } catch (txErr) {
      db.exec('ROLLBACK');
      throw txErr;
    }

    return res.json({
      success: true,
      message: `Quotation converted to Invoice ${invoiceNumber} successfully!`,
      data: {
        sale_id: saleId,
        invoice_number: invoiceNumber,
      },
    });
  } catch (err: any) {
    console.error('Error converting quotation to sale:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/quotations/:id
quotationsRouter.delete('/:id', (req: Request, res: Response): any => {
  try {
    const id = Number(req.params.id);
    db.prepare(`DELETE FROM quotations WHERE id = ?`).run(id);
    return res.json({ success: true, message: 'Quotation deleted.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
