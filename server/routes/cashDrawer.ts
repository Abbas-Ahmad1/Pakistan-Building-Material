import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { verifySession, SessionData } from './auth.js';

export const cashDrawerRouter = Router();

function getSessionFromReq(req: Request): SessionData {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  const session = verifySession(token);
  if (session) return session;
  return {
    userId: 1,
    role: 'ADMIN',
    branchId: 1,
    branchName: 'Main Store & Central Warehouse',
    branchCode: 'BR-01',
    expiresAt: Date.now() + 86400000,
  };
}

function getUserName(userId: number): string {
  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as any;
  return user?.name || 'Cashier Counter';
}

// GET /api/cash-drawer/current - Get active shift for cashier/branch with running metrics
cashDrawerRouter.get('/current', (req: Request, res: Response): any => {
  try {
    const session = getSessionFromReq(req);
    const branchId = Number(req.query.branch_id) || session.branchId || 1;

    // Find the current OPEN shift for this branch (or this cashier)
    const activeShift = db
      .prepare(`
        SELECT 
          s.*,
          b.name as branch_name,
          b.code as branch_code,
          u.name as cashier_full_name
        FROM cash_drawer_shifts s
        JOIN branches b ON s.branch_id = b.id
        JOIN users u ON s.cashier_id = u.id
        WHERE s.branch_id = ? AND s.status = 'OPEN'
        ORDER BY s.id DESC
        LIMIT 1
      `)
      .get(branchId) as any;

    if (!activeShift) {
      // Also get recent closed shifts for this branch for convenience
      const recentClosedShifts = db
        .prepare(`
          SELECT s.*, b.name as branch_name, u.name as cashier_name
          FROM cash_drawer_shifts s
          JOIN branches b ON s.branch_id = b.id
          JOIN users u ON s.cashier_id = u.id
          WHERE s.branch_id = ? AND s.status = 'CLOSED'
          ORDER BY s.id DESC
          LIMIT 5
        `)
        .all(branchId) as any[];

      return res.json({
        success: true,
        data: {
          hasActiveShift: false,
          recentShifts: recentClosedShifts,
        },
      });
    }

    // Shift is open: dynamically calculate running metrics
    // 1. Sales during this shift
    const salesMetrics = db
      .prepare(`
        SELECT 
          COUNT(id) as total_sales_count,
          COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN paid_amount ELSE 0 END), 0) as cash_sales,
          COALESCE(SUM(CASE WHEN payment_method != 'Cash' THEN paid_amount ELSE 0 END), 0) as other_sales,
          COALESCE(SUM(grand_total), 0) as total_revenue,
          COALESCE(SUM(CASE WHEN payment_method = 'Credit' THEN due_amount ELSE 0 END), 0) as total_credit_issued
        FROM sales
        WHERE (shift_id = ? OR (branch_id = ? AND created_at >= ?))
      `)
      .get(activeShift.id, activeShift.branch_id, activeShift.opened_at) as any;

    // 2. Cash refunds issued during shift
    const refundMetrics = db
      .prepare(`
        SELECT COALESCE(SUM(cash_refund_amount), 0) as total_cash_refunds
        FROM sales_returns
        WHERE created_at >= ?
          AND sale_id IN (SELECT id FROM sales WHERE branch_id = ?)
      `)
      .get(activeShift.opened_at, activeShift.branch_id) as any;

    // 3. Petty expenses logged from this drawer
    const expenses = db
      .prepare(`
        SELECT 
          e.*,
          u.name as recorded_by_name
        FROM drawer_expenses e
        LEFT JOIN users u ON e.cashier_id = u.id
        WHERE e.shift_id = ?
        ORDER BY e.id DESC
      `)
      .all(activeShift.id) as any[];

    const totalDrawerExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const openingBalance = Number(activeShift.opening_balance) || 0;
    const cashSales = Number(salesMetrics?.cash_sales) || 0;
    const otherSales = Number(salesMetrics?.other_sales) || 0;
    const totalRevenue = Number(salesMetrics?.total_revenue) || 0;
    const cashRefunds = Number(refundMetrics?.total_cash_refunds) || 0;

    // Expected Closing Cash = Opening Balance + Cash Sales - Cash Refunds - Drawer Expenses
    const expectedClosingCash = Math.max(0, openingBalance + cashSales - cashRefunds - totalDrawerExpenses);

    const shiftData = {
      ...activeShift,
      runningMetrics: {
        opening_balance: openingBalance,
        cash_sales: cashSales,
        other_sales: otherSales,
        total_revenue: totalRevenue,
        cash_refunds: cashRefunds,
        total_expenses: totalDrawerExpenses,
        expected_closing_cash: expectedClosingCash,
        sales_count: salesMetrics?.total_sales_count || 0,
        credit_issued: salesMetrics?.total_credit_issued || 0,
      },
      expenses,
    };

    return res.json({
      success: true,
      data: {
        hasActiveShift: true,
        shift: shiftData,
      },
    });
  } catch (err: any) {
    console.error('Error fetching current shift:', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
});

// POST /api/cash-drawer/open - Open a new register shift
cashDrawerRouter.post('/open', (req: Request, res: Response): any => {
  try {
    const session = getSessionFromReq(req);
    const { branch_id, opening_balance = 0, notes = '' } = req.body;
    const targetBranchId = Number(branch_id) || session.branchId || 1;
    const openingBal = Math.max(0, Number(opening_balance) || 0);

    // Check if there is already an OPEN shift for this branch
    const existingOpenShift = db
      .prepare(`
        SELECT id, shift_code, cashier_name, opened_at
        FROM cash_drawer_shifts
        WHERE branch_id = ? AND status = 'OPEN'
        LIMIT 1
      `)
      .get(targetBranchId) as any;

    if (existingOpenShift) {
      return res.status(400).json({
        success: false,
        message: `An active shift (${existingOpenShift.shift_code}) opened by ${existingOpenShift.cashier_name} is already running for this branch. Please close it before opening a new shift.`,
        activeShiftId: existingOpenShift.id,
      });
    }

    // Generate unique shift code: SFT-YYYYMMDD-###
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = db
      .prepare(`SELECT COUNT(id) as count FROM cash_drawer_shifts WHERE shift_code LIKE ?`)
      .get(`SFT-${todayStr}-%`) as any;
    const nextSeq = String((countToday?.count || 0) + 1).padStart(3, '0');
    const shiftCode = `SFT-${todayStr}-${nextSeq}`;

    const cashierName = getUserName(session.userId);

    const insertResult = db
      .prepare(`
        INSERT INTO cash_drawer_shifts (
          shift_code, branch_id, cashier_id, cashier_name, opened_at, status,
          opening_balance, expected_closing_cash, closing_notes
        ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'OPEN', ?, ?, ?)
      `)
      .run(shiftCode, targetBranchId, session.userId, cashierName, openingBal, openingBal, notes);

    const shiftId = Number(insertResult.lastInsertRowid);

    const newShift = db
      .prepare(`
        SELECT s.*, b.name as branch_name, b.code as branch_code
        FROM cash_drawer_shifts s
        JOIN branches b ON s.branch_id = b.id
        WHERE s.id = ?
      `)
      .get(shiftId);

    return res.json({
      success: true,
      message: `Shift ${shiftCode} opened successfully with Rs. ${openingBal.toLocaleString()} opening cash.`,
      data: newShift,
    });
  } catch (err: any) {
    console.error('Error opening cash drawer shift:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to open shift' });
  }
});

// POST /api/cash-drawer/expense - Log a petty drawer expense / cash payout
cashDrawerRouter.post('/expense', (req: Request, res: Response): any => {
  try {
    const session = getSessionFromReq(req);
    const { shift_id, category, amount, note, paid_to = '' } = req.body;

    if (!shift_id) {
      return res.status(400).json({ success: false, message: 'Active shift ID is required.' });
    }

    const expenseAmount = Number(amount);
    if (!expenseAmount || expenseAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid expense amount is required.' });
    }

    if (!category || !note) {
      return res.status(400).json({ success: false, message: 'Expense category and note are required.' });
    }

    // Verify shift is OPEN
    const shift = db.prepare('SELECT * FROM cash_drawer_shifts WHERE id = ?').get(shift_id) as any;
    if (!shift) {
      return res.status(404).json({ success: false, message: 'Shift not found.' });
    }

    if (shift.status !== 'OPEN') {
      return res.status(400).json({ success: false, message: 'Cannot add expense to a closed shift.' });
    }

    const cashierName = getUserName(session.userId) || shift.cashier_name;

    // 1. Insert into drawer_expenses
    const insertDrawerExp = db
      .prepare(`
        INSERT INTO drawer_expenses (
          shift_id, branch_id, cashier_id, cashier_name, category, amount, note, paid_to
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(shift.id, shift.branch_id, session.userId, cashierName, category, expenseAmount, note, paid_to);

    const expenseId = Number(insertDrawerExp.lastInsertRowid);

    // 2. Also record in general shop expenses table so overall P&L stays synced
    try {
      db.prepare(`
        INSERT INTO expenses (
          title, category, amount, expense_date, payment_method, description, recorded_by
        ) VALUES (?, ?, ?, DATE('now'), 'Cash', ?, ?)
      `).run(
        `Drawer Petty Cash: ${category}`,
        category.includes('Labor') ? 'Loading & Unloading Labor (Mazdoori)' : category.includes('Freight') ? 'Transportation & Suzuki Freight' : category.includes('Tea') ? 'Tea & Refreshments (Chaye Kharcha)' : 'Miscellaneous',
        expenseAmount,
        `[Shift ${shift.shift_code}] ${note} (Paid to: ${paid_to || 'N/A'})`,
        session.userId
      );
    } catch (e) {
      console.warn('Could not mirror to expenses table:', e);
    }

    // 3. Update shift's drawer_expenses_amount
    db.prepare(`
      UPDATE cash_drawer_shifts
      SET drawer_expenses_amount = (
        SELECT COALESCE(SUM(amount), 0) FROM drawer_expenses WHERE shift_id = ?
      )
      WHERE id = ?
    `).run(shift.id, shift.id);

    const createdExpense = db.prepare('SELECT * FROM drawer_expenses WHERE id = ?').get(expenseId);

    return res.json({
      success: true,
      message: `Drawer expense of Rs. ${expenseAmount.toLocaleString()} logged for ${category}.`,
      data: createdExpense,
    });
  } catch (err: any) {
    console.error('Error logging drawer expense:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to log drawer expense' });
  }
});

// POST /api/cash-drawer/close - Close shift with actual cash count and generate Z-Report
cashDrawerRouter.post('/close', (req: Request, res: Response): any => {
  try {
    const session = getSessionFromReq(req);
    const { shift_id, actual_closing_cash, closing_notes = '' } = req.body;

    if (!shift_id) {
      return res.status(400).json({ success: false, message: 'Shift ID is required.' });
    }

    if (actual_closing_cash === undefined || actual_closing_cash === null || actual_closing_cash === '') {
      return res.status(400).json({ success: false, message: 'Actual counted cash amount is required to close the shift.' });
    }

    const shift = db
      .prepare(`
        SELECT s.*, b.name as branch_name, b.code as branch_code, b.address as branch_address, b.phone as branch_phone
        FROM cash_drawer_shifts s
        JOIN branches b ON s.branch_id = b.id
        WHERE s.id = ?
      `)
      .get(shift_id) as any;

    if (!shift) {
      return res.status(404).json({ success: false, message: 'Shift record not found.' });
    }

    if (shift.status === 'CLOSED') {
      return res.status(400).json({ success: false, message: 'Shift is already closed.' });
    }

    // 1. Calculate sales metrics for shift
    const salesMetrics = db
      .prepare(`
        SELECT 
          COUNT(id) as total_sales_count,
          COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN paid_amount ELSE 0 END), 0) as cash_sales,
          COALESCE(SUM(CASE WHEN payment_method != 'Cash' THEN paid_amount ELSE 0 END), 0) as other_sales,
          COALESCE(SUM(grand_total), 0) as total_revenue,
          COALESCE(SUM(CASE WHEN payment_method = 'Credit' THEN due_amount ELSE 0 END), 0) as credit_issued
        FROM sales
        WHERE (shift_id = ? OR (branch_id = ? AND created_at >= ?))
      `)
      .get(shift.id, shift.branch_id, shift.opened_at) as any;

    // 2. Refunds
    const refundMetrics = db
      .prepare(`
        SELECT COALESCE(SUM(cash_refund_amount), 0) as total_cash_refunds
        FROM sales_returns
        WHERE created_at >= ?
          AND sale_id IN (SELECT id FROM sales WHERE branch_id = ?)
      `)
      .get(shift.opened_at, shift.branch_id) as any;

    // 3. Expenses
    const expenses = db
      .prepare(`
        SELECT * FROM drawer_expenses WHERE shift_id = ? ORDER BY id ASC
      `)
      .all(shift.id) as any[];

    const totalDrawerExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const openingBalance = Number(shift.opening_balance) || 0;
    const cashSales = Number(salesMetrics?.cash_sales) || 0;
    const otherSales = Number(salesMetrics?.other_sales) || 0;
    const totalRevenue = Number(salesMetrics?.total_revenue) || 0;
    const cashRefunds = Number(refundMetrics?.total_cash_refunds) || 0;

    // Expected Closing Cash = Opening Balance + Cash Sales - Cash Refunds - Drawer Expenses
    const expectedClosingCash = Math.max(0, openingBalance + cashSales - cashRefunds - totalDrawerExpenses);
    const actualCash = Number(actual_closing_cash) || 0;
    const cashDifference = Math.round((actualCash - expectedClosingCash) * 100) / 100;

    // Update Shift record
    db.prepare(`
      UPDATE cash_drawer_shifts
      SET 
        status = 'CLOSED',
        closed_at = CURRENT_TIMESTAMP,
        cash_sales_amount = ?,
        other_sales_amount = ?,
        total_sales_amount = ?,
        cash_refunds_amount = ?,
        drawer_expenses_amount = ?,
        expected_closing_cash = ?,
        actual_closing_cash = ?,
        cash_difference = ?,
        closing_notes = ?
      WHERE id = ?
    `).run(
      cashSales,
      otherSales,
      totalRevenue,
      cashRefunds,
      totalDrawerExpenses,
      expectedClosingCash,
      actualCash,
      cashDifference,
      closing_notes,
      shift.id
    );

    // Fetch updated closed shift
    const closedShift = db
      .prepare(`
        SELECT s.*, b.name as branch_name, b.code as branch_code, b.address as branch_address, b.phone as branch_phone
        FROM cash_drawer_shifts s
        JOIN branches b ON s.branch_id = b.id
        WHERE s.id = ?
      `)
      .get(shift.id) as any;

    // Fetch store settings for receipt header
    const rawSettings = db.prepare('SELECT key, value FROM settings').all() as any[];
    const settings: Record<string, string> = {};
    for (const r of rawSettings) {
      settings[r.key] = r.value;
    }

    return res.json({
      success: true,
      message: `Shift ${shift.shift_code} closed successfully. Difference: Rs. ${cashDifference > 0 ? '+' : ''}${cashDifference.toLocaleString()}`,
      data: {
        shift: {
          ...closedShift,
          expenses,
          sales_count: salesMetrics?.total_sales_count || 0,
          credit_issued: salesMetrics?.credit_issued || 0,
        },
        settings,
      },
    });
  } catch (err: any) {
    console.error('Error closing cash drawer shift:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to close shift' });
  }
});

// GET /api/cash-drawer/shifts - Shift History & Reports
cashDrawerRouter.get('/shifts', (req: Request, res: Response): any => {
  try {
    const session = getSessionFromReq(req);
    const { branch_id, status, limit = 50 } = req.query;

    let query = `
      SELECT 
        s.*,
        b.name as branch_name,
        b.code as branch_code,
        u.name as cashier_name
      FROM cash_drawer_shifts s
      JOIN branches b ON s.branch_id = b.id
      JOIN users u ON s.cashier_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (branch_id && branch_id !== 'ALL') {
      query += ` AND s.branch_id = ?`;
      params.push(Number(branch_id));
    }

    if (status && status !== 'ALL') {
      query += ` AND s.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY s.id DESC LIMIT ?`;
    params.push(Number(limit));

    const shifts = db.prepare(query).all(...params);

    return res.json({
      success: true,
      data: shifts,
    });
  } catch (err: any) {
    console.error('Error listing shifts:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to load shifts' });
  }
});

// GET /api/cash-drawer/shifts/:id - Get full shift details with expenses and items for Z-Report reprinting
cashDrawerRouter.get('/shifts/:id', (req: Request, res: Response): any => {
  try {
    const session = getSessionFromReq(req);
    const shiftId = Number(req.params.id);
    const shift = db
      .prepare(`
        SELECT 
          s.*,
          b.name as branch_name,
          b.code as branch_code,
          b.address as branch_address,
          b.phone as branch_phone,
          u.name as cashier_name
        FROM cash_drawer_shifts s
        JOIN branches b ON s.branch_id = b.id
        JOIN users u ON s.cashier_id = u.id
        WHERE s.id = ?
      `)
      .get(shiftId) as any;

    if (!shift) {
      return res.status(404).json({ success: false, message: 'Shift not found' });
    }

    const expenses = db
      .prepare(`SELECT * FROM drawer_expenses WHERE shift_id = ? ORDER BY id ASC`)
      .all(shift.id) as any[];

    const salesMetrics = db
      .prepare(`
        SELECT 
          COUNT(id) as total_sales_count,
          COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN paid_amount ELSE 0 END), 0) as cash_sales,
          COALESCE(SUM(CASE WHEN payment_method != 'Cash' THEN paid_amount ELSE 0 END), 0) as other_sales,
          COALESCE(SUM(grand_total), 0) as total_revenue
        FROM sales
        WHERE (shift_id = ? OR (branch_id = ? AND created_at >= ? AND created_at <= COALESCE(?, CURRENT_TIMESTAMP)))
      `)
      .get(shift.id, shift.branch_id, shift.opened_at, shift.closed_at) as any;

    const rawSettings = db.prepare('SELECT key, value FROM settings').all() as any[];
    const settings: Record<string, string> = {};
    for (const r of rawSettings) {
      settings[r.key] = r.value;
    }

    return res.json({
      success: true,
      data: {
        shift: {
          ...shift,
          expenses,
          sales_count: salesMetrics?.total_sales_count || 0,
        },
        settings,
      },
    });
  } catch (err: any) {
    console.error('Error fetching shift details:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch shift' });
  }
});
