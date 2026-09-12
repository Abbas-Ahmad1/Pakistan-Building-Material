import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { verifySession } from './auth.js';

export const dashboardRouter = Router();

// GET /api/dashboard/metrics
dashboardRouter.get('/metrics', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const range = (req.query.range as string) || '7days'; // 'today', '7days', '30days', 'year'
    const isCashier = session.role === 'CASHIER';

    // 1. Today's Core KPIs
    const todaySalesRow = db
      .prepare(`
        SELECT 
          COALESCE(SUM(grand_total), 0) as todaySales,
          COALESCE(SUM(gross_profit), 0) as todayProfit,
          COUNT(*) as todayOrdersCount
        FROM sales
        WHERE date(sale_date, 'localtime') = date('now', 'localtime')
        ${isCashier ? 'AND cashier_id = ?' : ''}
      `)
      .get(...(isCashier ? [session.userId] : [])) as any;

    const todayExpenseRow = db
      .prepare(`
        SELECT COALESCE(SUM(amount), 0) as todayExpenses
        FROM expenses
        WHERE date(expense_date, 'localtime') = date('now', 'localtime')
      `)
      .get() as any;

    // 2. Inventory Metrics
    const inventoryRow = db
      .prepare(`
        SELECT 
          COUNT(*) as totalProducts,
          COALESCE(SUM(current_stock * purchase_price), 0) as totalInventoryCostValue,
          COALESCE(SUM(current_stock * selling_price), 0) as totalInventoryRetailValue,
          COUNT(CASE WHEN current_stock <= minimum_stock AND current_stock > 0 THEN 1 END) as lowStockCount,
          COUNT(CASE WHEN current_stock <= 0 THEN 1 END) as outOfStockCount
        FROM products
        WHERE status = 'active'
      `)
      .get() as any;

    // 3. Customers & Suppliers Ledgers
    const customerRow = db
      .prepare(`
        SELECT 
          COUNT(*) as totalCustomers,
          COALESCE(SUM(outstanding_balance), 0) as customerOutstandingBalance
        FROM customers
      `)
      .get() as any;

    const supplierRow = db
      .prepare(`
        SELECT 
          COUNT(*) as totalSuppliers,
          COALESCE(SUM(payable_balance), 0) as supplierPayableBalance
        FROM suppliers
      `)
      .get() as any;

    // 4. Sales Trends (Daily / Weekly / Monthly)
    let daysCount = 7;
    if (range === '30days') daysCount = 30;
    else if (range === 'year') daysCount = 365;
    else if (range === 'today') daysCount = 1;

    // Generate date series for sales and expenses
    const rawSales = db
      .prepare(`
        SELECT 
          date(sale_date, 'localtime') as day,
          COALESCE(SUM(grand_total), 0) as sales,
          COALESCE(SUM(gross_profit), 0) as profit
        FROM sales
        WHERE sale_date >= datetime('now', '-${daysCount} days')
        ${isCashier ? 'AND cashier_id = ?' : ''}
        GROUP BY date(sale_date, 'localtime')
        ORDER BY date(sale_date, 'localtime') ASC
      `)
      .all(...(isCashier ? [session.userId] : [])) as any[];

    const rawExpenses = db
      .prepare(`
        SELECT 
          date(expense_date, 'localtime') as day,
          COALESCE(SUM(amount), 0) as expenses
        FROM expenses
        WHERE expense_date >= datetime('now', '-${daysCount} days')
        GROUP BY date(expense_date, 'localtime')
      `)
      .all() as any[];

    // Map into unified timeline
    const expenseMap = new Map<string, number>();
    for (const exp of rawExpenses) {
      expenseMap.set(exp.day, exp.expenses);
    }

    const chartData = rawSales.map((s) => ({
      label: s.day,
      sales: Math.round(s.sales),
      profit: isCashier ? 0 : Math.round(s.profit),
      expenses: isCashier ? 0 : Math.round(expenseMap.get(s.day) || 0),
    }));

    // If chartData is empty or short, ensure at least today
    if (chartData.length === 0) {
      chartData.push({
        label: new Date().toISOString().split('T')[0],
        sales: Math.round(todaySalesRow.todaySales),
        profit: isCashier ? 0 : Math.round(todaySalesRow.todayProfit),
        expenses: isCashier ? 0 : Math.round(todayExpenseRow.todayExpenses),
      });
    }

    // 5. Recent Sales
    const recentSales = db
      .prepare(`
        SELECT 
          s.id,
          s.invoice_number,
          c.name as customer_name,
          s.grand_total,
          s.paid_amount,
          s.due_amount,
          s.payment_method,
          s.payment_status,
          s.sale_date as created_at,
          u.name as cashier_name
        FROM sales s
        JOIN customers c ON s.customer_id = c.id
        JOIN users u ON s.cashier_id = u.id
        ${isCashier ? 'WHERE s.cashier_id = ?' : ''}
        ORDER BY s.sale_date DESC
        LIMIT 6
      `)
      .all(...(isCashier ? [session.userId] : [])) as any[];

    // 6. Low Stock Products
    const lowStockProducts = db
      .prepare(`
        SELECT 
          p.id,
          p.sku,
          p.name,
          c.name as category_name,
          p.unit,
          p.current_stock,
          p.minimum_stock,
          p.purchase_price,
          p.selling_price
        FROM products p
        JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'active' AND p.current_stock <= p.minimum_stock
        ORDER BY p.current_stock ASC
        LIMIT 10
      `)
      .all() as any[];

    // Sanitized output based on role:
    // Cashier does not see store net profits, expenses, purchase valuation or supplier payables
    const metrics = {
      todaySales: todaySalesRow.todaySales,
      todayProfit: isCashier ? 0 : todaySalesRow.todayProfit,
      todayExpenses: isCashier ? 0 : todayExpenseRow.todayExpenses,
      todayOrdersCount: todaySalesRow.todayOrdersCount,
      totalProducts: inventoryRow.totalProducts,
      totalInventoryCostValue: isCashier ? 0 : inventoryRow.totalInventoryCostValue,
      totalInventoryRetailValue: inventoryRow.totalInventoryRetailValue,
      lowStockCount: inventoryRow.lowStockCount,
      outOfStockCount: inventoryRow.outOfStockCount,
      totalCustomers: customerRow.totalCustomers,
      totalSuppliers: isCashier ? 0 : supplierRow.totalSuppliers,
      customerOutstandingBalance: customerRow.customerOutstandingBalance,
      supplierPayableBalance: isCashier ? 0 : supplierRow.supplierPayableBalance,
      chartData,
      recentSales,
      lowStockProducts,
    };

    return res.json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    console.error('Error fetching dashboard metrics:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to compute dashboard metrics from database.',
    });
  }
});
