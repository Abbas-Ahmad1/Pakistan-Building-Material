import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { verifySession } from './auth.js';

export const customersRouter = Router();

// GET /api/customers - list customers with search & filter
customersRouter.get('/', (req: Request, res: Response): any => {
  try {
    const { search = '', has_dues = 'false' } = req.query;

    let query = `
      SELECT 
        id,
        name,
        phone,
        email,
        address,
        credit_limit,
        total_purchases,
        total_paid,
        outstanding_balance,
        is_walk_in,
        created_at,
        updated_at
      FROM customers
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (name LIKE ? OR phone LIKE ? OR address LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    if (has_dues === 'true') {
      query += ` AND outstanding_balance > 0`;
    }

    query += ` ORDER BY is_walk_in DESC, outstanding_balance DESC, name ASC`;

    const customers = db.prepare(query).all(...params);

    return res.json({ success: true, data: customers });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve customers.' });
  }
});

// GET /api/customers/:id - single customer details
customersRouter.get('/:id', (req: Request, res: Response): any => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(req.params.id));
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    return res.json({ success: true, data: customer });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve customer.' });
  }
});

// POST /api/customers - create customer
customersRouter.post('/', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    const { name, phone, email, address, credit_limit = 0, opening_balance = 0 } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required.' });
    }

    const creditLimitNum = Number(credit_limit) || 0;
    const openingBalNum = Number(opening_balance) || 0;

    const stmt = db.prepare(`
      INSERT INTO customers (
        name, phone, email, address, credit_limit, total_purchases, total_paid, outstanding_balance, is_walk_in
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0)
    `);

    const result = stmt.run(
      name.trim(),
      phone || '',
      email || '',
      address || '',
      creditLimitNum,
      openingBalNum,
      openingBalNum
    );

    const newId = Number(result.lastInsertRowid);

    if (session) {
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, module, record_id, details)
        VALUES (?, 'CREATE', 'Customers', ?, ?)
      `).run(session.userId, newId, `Added customer: ${name.trim()} with credit limit Rs. ${creditLimitNum}`);
    }

    const newCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(newId);
    return res.status(201).json({ success: true, message: 'Customer created successfully.', data: newCustomer });
  } catch (error: any) {
    console.error('Error creating customer:', error);
    return res.status(500).json({ success: false, message: 'Failed to create customer.' });
  }
});

// PUT /api/customers/:id - update customer
customersRouter.put('/:id', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const { name, phone, email, address, credit_limit } = req.body;

    db.prepare(`
      UPDATE customers 
      SET 
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        credit_limit = COALESCE(?, credit_limit),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name?.trim(),
      phone,
      email,
      address,
      credit_limit !== undefined ? Number(credit_limit) : existing.credit_limit,
      id
    );

    if (session) {
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, module, record_id, details)
        VALUES (?, 'UPDATE', 'Customers', ?, ?)
      `).run(session.userId, id, `Updated customer profile: ${name || existing.name}`);
    }

    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    return res.json({ success: true, message: 'Customer updated successfully.', data: updated });
  } catch (error: any) {
    console.error('Error updating customer:', error);
    return res.status(500).json({ success: false, message: 'Failed to update customer.' });
  }
});

// POST /api/customers/:id/payment - receive payment (Khata Vasooli)
customersRouter.post('/:id/payment', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    const customerId = Number(req.params.id);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const { amount, payment_method = 'Cash', reference_no = '', notes = '' } = req.body;
    const paymentAmount = Number(amount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    }

    db.exec('BEGIN');
    try {
      // 1. Insert customer payment record
      db.prepare(`
        INSERT INTO customer_payments (customer_id, amount, payment_method, reference_no, notes, received_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(customerId, paymentAmount, payment_method, reference_no, notes, session?.userId || 1);

      // 2. Update customer outstanding balance & total paid
      const newTotalPaid = (customer.total_paid || 0) + paymentAmount;
      const newOutstanding = Math.max(0, (customer.outstanding_balance || 0) - paymentAmount);

      db.prepare(`
        UPDATE customers 
        SET total_paid = ?, outstanding_balance = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newTotalPaid, newOutstanding, customerId);

      // 3. Log audit
      if (session) {
        db.prepare(`
          INSERT INTO audit_logs (user_id, action, module, record_id, details)
          VALUES (?, 'PAYMENT_RECEIVED', 'Customers', ?, ?)
        `).run(
          session.userId,
          customerId,
          `Received payment of Rs. ${paymentAmount.toLocaleString()} (${payment_method}) from ${customer.name}. New Due Balance: Rs. ${newOutstanding.toLocaleString()}`
        );
      }

      db.exec('COMMIT');

      const updatedCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
      return res.json({
        success: true,
        message: `Payment of Rs. ${paymentAmount.toLocaleString()} recorded successfully.`,
        data: {
          customer: updatedCustomer,
          amount_received: paymentAmount,
          new_balance: newOutstanding,
        },
      });
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  } catch (error: any) {
    console.error('Error recording payment:', error);
    return res.status(500).json({ success: false, message: 'Failed to record payment.' });
  }
});

// GET /api/customers/:id/ledger - full ledger / statement of customer khata
customersRouter.get('/:id/ledger', (req: Request, res: Response): any => {
  try {
    const customerId = Number(req.params.id);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId) as any;
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    // Invoices
    const sales = db.prepare(`
      SELECT 
        id, 
        invoice_number as reference, 
        sale_date as date, 
        grand_total as debit, 
        paid_amount as credit, 
        due_amount, 
        payment_status,
        payment_method,
        'INVOICE' as type
      FROM sales
      WHERE customer_id = ?
    `).all(customerId) as any[];

    // Payments
    const payments = db.prepare(`
      SELECT 
        id, 
        COALESCE(reference_no, 'PAY-' || id) as reference, 
        payment_date as date, 
        0 as debit, 
        amount as credit, 
        notes,
        payment_method,
        'PAYMENT' as type
      FROM customer_payments
      WHERE customer_id = ?
    `).all(customerId) as any[];

    // Combine and sort chronologically
    const combined = [...sales, ...payments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let runningBalance = 0;
    const ledger = combined.map((entry) => {
      if (entry.type === 'INVOICE') {
        runningBalance += (entry.due_amount || 0);
      } else {
        runningBalance -= (entry.credit || 0);
      }
      return {
        ...entry,
        running_balance: runningBalance,
      };
    });

    return res.json({
      success: true,
      data: {
        customer,
        ledger,
        current_outstanding: customer.outstanding_balance,
        total_purchases: customer.total_purchases,
        total_paid: customer.total_paid,
      },
    });
  } catch (error: any) {
    console.error('Error fetching customer ledger:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve ledger.' });
  }
});
