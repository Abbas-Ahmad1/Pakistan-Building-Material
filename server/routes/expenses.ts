import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { verifySession } from './auth.js';

export const expensesRouter = Router();

const DEFAULT_CATEGORIES = [
  'Electricity (LESCO / K-Electric)',
  'Shop Rent',
  'Salaries & Daily Wages',
  'Transportation & Suzuki Freight',
  'Tea & Refreshments (Chaye Kharcha)',
  'Shop Repairs & Maintenance',
  'Packaging Materials & Tape',
  'Office Stationery & Printing',
  'Generator Fuel & Solar Maintenance',
  'Loading & Unloading Labor (Mazdoori)',
  'Miscellaneous',
];

// GET /api/expenses
expensesRouter.get('/', (req: Request, res: Response): any => {
  try {
    const {
      search = '',
      category = 'all',
      payment_method = 'all',
      date_from = '',
      date_to = '',
    } = req.query;

    let query = `
      SELECT 
        e.id,
        e.title,
        e.category,
        e.amount,
        e.expense_date,
        e.payment_method,
        e.description,
        e.recorded_by,
        u.name as recorder_name,
        e.created_at
      FROM expenses e
      LEFT JOIN users u ON e.recorded_by = u.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (search) {
      query += ` AND (e.title LIKE ? OR e.description LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term);
    }

    if (category !== 'all' && category) {
      query += ` AND e.category = ?`;
      params.push(category);
    }

    if (payment_method !== 'all' && payment_method) {
      query += ` AND e.payment_method = ?`;
      params.push(payment_method);
    }

    if (date_from) {
      query += ` AND date(e.expense_date) >= date(?)`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND date(e.expense_date) <= date(?)`;
      params.push(date_to);
    }

    query += ` ORDER BY e.expense_date DESC, e.id DESC`;

    const expenses = db.prepare(query).all(...params);

    // Calculate Summaries
    const totalRow = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM expenses`).get() as any;
    const todayRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as today 
      FROM expenses 
      WHERE date(expense_date) = date('now', 'localtime')
    `).get() as any;
    const monthRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as month 
      FROM expenses 
      WHERE strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now', 'localtime')
    `).get() as any;

    const categoryBreakdown = db.prepare(`
      SELECT category, COUNT(*) as count, SUM(amount) as total_amount
      FROM expenses
      GROUP BY category
      ORDER BY total_amount DESC
    `).all() as any[];

    return res.json({
      success: true,
      data: expenses,
      summary: {
        total_all_time: totalRow?.total || 0,
        today_expenses: todayRow?.today || 0,
        this_month_expenses: monthRow?.month || 0,
        category_breakdown: categoryBreakdown || [],
      },
    });
  } catch (err: any) {
    console.error('Error fetching expenses:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch expenses: ' + err.message });
  }
});

// GET /api/expenses/categories
expensesRouter.get('/categories', (_req: Request, res: Response): any => {
  try {
    const existing = db.prepare(`SELECT DISTINCT category FROM expenses WHERE category IS NOT NULL`).all() as any[];
    const existingCats = existing.map((r) => r.category);
    const set = new Set([...DEFAULT_CATEGORIES, ...existingCats]);
    return res.json({ success: true, data: Array.from(set) });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/expenses - Add new expense
expensesRouter.post('/', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);
    const userId = session?.userId || 1;

    const {
      title,
      category,
      amount,
      payment_method = 'Cash',
      expense_date,
      description = '',
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Expense title is required.' });
    }

    if (!category) {
      return res.status(400).json({ success: false, message: 'Category is required.' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a positive number.' });
    }

    const dateVal = expense_date ? expense_date : new Date().toISOString();

    const insert = db.prepare(`
      INSERT INTO expenses (title, category, amount, expense_date, payment_method, description, recorded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      title.trim(),
      category,
      numAmount,
      dateVal,
      payment_method,
      description?.trim() || null,
      userId
    );

    const expenseId = Number(result.lastInsertRowid);

    // Audit Log
    try {
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, module, record_id, details)
        VALUES (?, 'CREATE_EXPENSE', 'Expenses', ?, ?)
      `).run(
        userId,
        expenseId,
        `Recorded expense: "${title.trim()}" in ${category} for Rs. ${numAmount.toLocaleString()} via ${payment_method}`
      );
    } catch (_) {}

    return res.json({
      success: true,
      message: 'Expense recorded successfully.',
      data: { id: expenseId },
    });
  } catch (err: any) {
    console.error('Error recording expense:', err);
    return res.status(500).json({ success: false, message: 'Failed to record expense: ' + err.message });
  }
});

// DELETE /api/expenses/:id
expensesRouter.delete('/:id', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (session?.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only store administrators can delete expense records.' });
    }

    const id = Number(req.params.id);
    const existing = db.prepare(`SELECT * FROM expenses WHERE id = ?`).get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Expense record not found.' });
    }

    db.prepare(`DELETE FROM expenses WHERE id = ?`).run(id);

    // Audit Log
    try {
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, module, record_id, details)
        VALUES (?, 'DELETE_EXPENSE', 'Expenses', ?, ?)
      `).run(
        session.userId,
        id,
        `Deleted expense #${id} ("${existing.title}", Rs. ${existing.amount})`
      );
    } catch (_) {}

    return res.json({ success: true, message: 'Expense deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});
