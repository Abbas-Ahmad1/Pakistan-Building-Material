import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { verifySession } from './auth.js';

export const suppliersRouter = Router();

// GET /api/suppliers - list suppliers with search and balance
suppliersRouter.get('/', (req: Request, res: Response): any => {
  try {
    const { search = '', has_payable } = req.query;

    let query = `
      SELECT 
        id, 
        name, 
        company, 
        phone, 
        email, 
        address, 
        payable_balance, 
        COALESCE(status, 'ACTIVE') as status,
        created_at,
        (SELECT COUNT(*) FROM purchases p WHERE p.supplier_id = suppliers.id) as purchases_count
      FROM suppliers
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (name LIKE ? OR company LIKE ? OR phone LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    if (has_payable === 'true') {
      query += ` AND payable_balance > 0`;
    }

    query += ` ORDER BY name ASC`;

    const suppliers = db.prepare(query).all(...params);
    return res.json({ success: true, data: suppliers });
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve suppliers.' });
  }
});

// POST /api/suppliers - create new supplier/vendor
suppliersRouter.post('/', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (session?.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only store admins can add suppliers.' });
    }

    const { name, company, phone, email, address, opening_balance = 0 } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier contact person or company name is required.' });
    }

    const initialPayable = Number(opening_balance) || 0;

    const result = db
      .prepare(`
        INSERT INTO suppliers (name, company, phone, email, address, payable_balance, status)
        VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
      `)
      .run(
        name.trim(),
        company?.trim() || name.trim(),
        phone?.trim() || '',
        email?.trim() || null,
        address?.trim() || null,
        initialPayable
      );

    const supplierId = Number(result.lastInsertRowid);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, module, record_id, details)
      VALUES (?, 'CREATE_SUPPLIER', 'Suppliers', ?, ?)
    `).run(session.userId, supplierId, `Registered new supplier ${name.trim()} (${company || ''})`);

    const newSupplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
    return res.status(201).json({ success: true, data: newSupplier });
  } catch (error: any) {
    console.error('Error creating supplier:', error);
    return res.status(500).json({ success: false, message: 'Failed to create supplier.' });
  }
});

// PUT /api/suppliers/:id - update supplier details
suppliersRouter.put('/:id', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (session?.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only store admins can update suppliers.' });
    }

    const supplierId = Number(req.params.id);
    const { name, company, phone, email, address, status = 'ACTIVE' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Supplier contact person or company name is required.' });
    }

    const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Supplier not found.' });
    }

    db.prepare(`
      UPDATE suppliers
      SET 
        name = ?,
        company = ?,
        phone = ?,
        email = ?,
        address = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name.trim(),
      company?.trim() || name.trim(),
      phone?.trim() || '',
      email?.trim() || null,
      address?.trim() || null,
      status || 'ACTIVE',
      supplierId
    );

    const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
    return res.json({ success: true, data: updated, message: 'Supplier updated successfully.' });
  } catch (error: any) {
    console.error('Error updating supplier:', error);
    return res.status(500).json({ success: false, message: 'Failed to update supplier.' });
  }
});

// POST /api/suppliers/:id/payment - record payment to supplier (Khata payment)
suppliersRouter.post('/:id/payment', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (session?.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only store admins can record supplier payments.' });
    }

    const supplierId = Number(req.params.id);
    const { amount, payment_method = 'Cash', reference_no = '', notes = '' } = req.body;

    const paymentAmount = Number(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid payment amount is required.' });
    }

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId) as any;
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found.' });
    }

    db.exec('BEGIN');
    try {
      // 1. Insert into supplier_payments
      db.prepare(`
        INSERT INTO supplier_payments (supplier_id, amount, payment_method, reference_no, notes, paid_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(supplierId, paymentAmount, payment_method, reference_no, notes, session.userId);

      // 2. Reduce payable_balance
      const newPayable = Math.max(0, (supplier.payable_balance || 0) - paymentAmount);
      db.prepare(`
        UPDATE suppliers 
        SET payable_balance = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(newPayable, supplierId);

      // 3. Audit log
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, module, record_id, details)
        VALUES (?, 'SUPPLIER_PAYMENT', 'Suppliers', ?, ?)
      `).run(
        session.userId,
        supplierId,
        `Paid Rs. ${paymentAmount.toLocaleString()} to supplier ${supplier.name}. New payable: Rs. ${newPayable.toLocaleString()}`
      );

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return res.json({
      success: true,
      message: `Payment of Rs. ${paymentAmount.toLocaleString()} recorded successfully.`,
    });
  } catch (error: any) {
    console.error('Error recording supplier payment:', error);
    return res.status(500).json({ success: false, message: 'Failed to record supplier payment.' });
  }
});

// GET /api/suppliers/:id/ledger - full purchase & payment ledger
suppliersRouter.get('/:id/ledger', (req: Request, res: Response): any => {
  try {
    const supplierId = Number(req.params.id);

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId) as any;
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found.' });
    }

    const purchases = db
      .prepare(`
        SELECT 
          id,
          purchase_number as reference,
          purchase_date as date,
          grand_total as credit,
          0 as debit,
          paid_amount,
          due_amount,
          payment_status,
          notes,
          'PURCHASE' as type
        FROM purchases
        WHERE supplier_id = ?
        ORDER BY purchase_date ASC
      `)
      .all(supplierId) as any[];

    const payments = db
      .prepare(`
        SELECT 
          id,
          COALESCE(reference_no, 'PMT-' || id) as reference,
          payment_date as date,
          0 as credit,
          amount as debit,
          amount as paid_amount,
          0 as due_amount,
          'PAID' as payment_status,
          notes,
          payment_method,
          'PAYMENT' as type
        FROM supplier_payments
        WHERE supplier_id = ?
        ORDER BY payment_date ASC
      `)
      .all(supplierId) as any[];

    // Combine and sort chronologically
    const combined = [...purchases, ...payments].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let runningBalance = 0;
    const ledger = combined.map((entry) => {
      runningBalance += (entry.credit || 0) - (entry.debit || 0);
      return {
        ...entry,
        running_balance: runningBalance,
      };
    });

    return res.json({
      success: true,
      data: {
        supplier,
        ledger,
      },
    });
  } catch (error: any) {
    console.error('Error generating supplier ledger:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate supplier ledger.' });
  }
});
