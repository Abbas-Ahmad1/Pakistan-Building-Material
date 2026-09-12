import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { verifySession } from './auth.js';

export const reportsRouter = Router();

// Helper to resolve date ranges for SQLite
function getDateFilter(range: string, dateFrom?: string, dateTo?: string) {
  let dateConditionSales = '';
  let dateConditionExpenses = '';
  const paramsSales: any[] = [];
  const paramsExpenses: any[] = [];

  switch (range) {
    case 'today':
      dateConditionSales = ` AND date(sale_date, 'localtime') = date('now', 'localtime')`;
      dateConditionExpenses = ` AND date(expense_date, 'localtime') = date('now', 'localtime')`;
      break;
    case 'yesterday':
      dateConditionSales = ` AND date(sale_date, 'localtime') = date('now', 'localtime', '-1 day')`;
      dateConditionExpenses = ` AND date(expense_date, 'localtime') = date('now', 'localtime', '-1 day')`;
      break;
    case 'this_week':
      dateConditionSales = ` AND date(sale_date, 'localtime') >= date('now', 'localtime', '-7 days')`;
      dateConditionExpenses = ` AND date(expense_date, 'localtime') >= date('now', 'localtime', '-7 days')`;
      break;
    case 'this_month':
      dateConditionSales = ` AND strftime('%Y-%m', sale_date, 'localtime') = strftime('%Y-%m', 'now', 'localtime')`;
      dateConditionExpenses = ` AND strftime('%Y-%m', expense_date, 'localtime') = strftime('%Y-%m', 'now', 'localtime')`;
      break;
    case 'last_month':
      dateConditionSales = ` AND strftime('%Y-%m', sale_date, 'localtime') = strftime('%Y-%m', 'now', 'localtime', '-1 month')`;
      dateConditionExpenses = ` AND strftime('%Y-%m', expense_date, 'localtime') = strftime('%Y-%m', 'now', 'localtime', '-1 month')`;
      break;
    case 'this_year':
      dateConditionSales = ` AND strftime('%Y', sale_date, 'localtime') = strftime('%Y', 'now', 'localtime')`;
      dateConditionExpenses = ` AND strftime('%Y', expense_date, 'localtime') = strftime('%Y', 'now', 'localtime')`;
      break;
    case 'custom':
      if (dateFrom) {
        dateConditionSales += ` AND date(sale_date) >= date(?)`;
        dateConditionExpenses += ` AND date(expense_date) >= date(?)`;
        paramsSales.push(dateFrom);
        paramsExpenses.push(dateFrom);
      }
      if (dateTo) {
        dateConditionSales += ` AND date(sale_date) <= date(?)`;
        dateConditionExpenses += ` AND date(expense_date) <= date(?)`;
        paramsSales.push(dateTo);
        paramsExpenses.push(dateTo);
      }
      break;
    case 'all':
    default:
      // No date filter
      break;
  }

  return { dateConditionSales, dateConditionExpenses, paramsSales, paramsExpenses };
}

// GET /api/reports/profit-loss
reportsRouter.get('/profit-loss', (req: Request, res: Response): any => {
  try {
    const { range = 'this_month', date_from = '', date_to = '' } = req.query;

    const { dateConditionSales, dateConditionExpenses, paramsSales, paramsExpenses } = getDateFilter(
      String(range),
      String(date_from),
      String(date_to)
    );

    // 1. Sales Performance
    const salesAgg = db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(grand_total), 0) as gross_sales,
        COALESCE(SUM(subtotal), 0) as total_subtotal,
        COALESCE(SUM(discount_amount), 0) as total_discounts,
        COALESCE(SUM(cogs_total), 0) as total_cogs,
        COALESCE(SUM(gross_profit), 0) as gross_profit,
        COALESCE(SUM(paid_amount), 0) as total_collected,
        COALESCE(SUM(due_amount), 0) as total_uncollected
      FROM sales
      WHERE 1=1 ${dateConditionSales}
    `).get(...paramsSales) as any;

    // 2. Expenses
    const expensesAgg = db.prepare(`
      SELECT 
        COUNT(*) as expense_count,
        COALESCE(SUM(amount), 0) as total_expenses
      FROM expenses
      WHERE 1=1 ${dateConditionExpenses}
    `).get(...paramsExpenses) as any;

    // Expense breakdown by category
    const expenseBreakdown = db.prepare(`
      SELECT category, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
      FROM expenses
      WHERE 1=1 ${dateConditionExpenses}
      GROUP BY category
      ORDER BY total_amount DESC
    `).all(...paramsExpenses) as any[];

    // 3. Daily trends for the selected period
    const dailySales = db.prepare(`
      SELECT 
        date(sale_date, 'localtime') as day,
        COALESCE(SUM(grand_total), 0) as revenue,
        COALESCE(SUM(cogs_total), 0) as cogs,
        COALESCE(SUM(gross_profit), 0) as gross_profit
      FROM sales
      WHERE 1=1 ${dateConditionSales}
      GROUP BY date(sale_date, 'localtime')
      ORDER BY day ASC
    `).all(...paramsSales) as any[];

    const dailyExpenses = db.prepare(`
      SELECT 
        date(expense_date, 'localtime') as day,
        COALESCE(SUM(amount), 0) as expense
      FROM expenses
      WHERE 1=1 ${dateConditionExpenses}
      GROUP BY date(expense_date, 'localtime')
      ORDER BY day ASC
    `).all(...paramsExpenses) as any[];

    // Merge daily trends
    const dayMap = new Map<string, { day: string; revenue: number; cogs: number; gross_profit: number; expense: number; net_profit: number }>();

    dailySales.forEach((s) => {
      dayMap.set(s.day, {
        day: s.day,
        revenue: s.revenue,
        cogs: s.cogs,
        gross_profit: s.gross_profit,
        expense: 0,
        net_profit: s.gross_profit,
      });
    });

    dailyExpenses.forEach((e) => {
      const existing = dayMap.get(e.day);
      if (existing) {
        existing.expense = e.expense;
        existing.net_profit = existing.gross_profit - e.expense;
      } else {
        dayMap.set(e.day, {
          day: e.day,
          revenue: 0,
          cogs: 0,
          gross_profit: 0,
          expense: e.expense,
          net_profit: -e.expense,
        });
      }
    });

    const dailyTimeline = Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day));

    // Summary calculation
    const grossSales = salesAgg?.gross_sales || 0;
    const cogs = salesAgg?.total_cogs || 0;
    const grossProfit = salesAgg?.gross_profit || 0;
    const totalExpenses = expensesAgg?.total_expenses || 0;
    const netProfit = grossProfit - totalExpenses;
    const grossMarginPct = grossSales > 0 ? (grossProfit / grossSales) * 100 : 0;
    const netMarginPct = grossSales > 0 ? (netProfit / grossSales) * 100 : 0;

    return res.json({
      success: true,
      data: {
        range,
        summary: {
          total_orders: salesAgg?.total_orders || 0,
          gross_sales: grossSales,
          total_subtotal: salesAgg?.total_subtotal || 0,
          total_discounts: salesAgg?.total_discounts || 0,
          total_cogs: cogs,
          gross_profit: grossProfit,
          gross_margin_pct: Number(grossMarginPct.toFixed(2)),
          total_expenses: totalExpenses,
          net_profit: netProfit,
          net_margin_pct: Number(netMarginPct.toFixed(2)),
          total_collected: salesAgg?.total_collected || 0,
          total_uncollected: salesAgg?.total_uncollected || 0,
        },
        expense_breakdown: expenseBreakdown || [],
        daily_timeline: dailyTimeline,
      },
    });
  } catch (err: any) {
    console.error('Error generating Profit & Loss report:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate Profit & Loss: ' + err.message });
  }
});

// GET /api/reports/bestsellers
reportsRouter.get('/bestsellers', (req: Request, res: Response): any => {
  try {
    const { limit = '15' } = req.query;
    const limitNum = Math.min(Number(limit) || 15, 50);

    // Top selling items
    const bestsellers = db.prepare(`
      SELECT 
        p.id as product_id,
        p.sku,
        p.name as product_name,
        p.brand,
        p.unit,
        p.current_stock,
        p.selling_price,
        p.purchase_price,
        c.name as category_name,
        COALESCE(SUM(si.quantity), 0) as units_sold,
        COALESCE(SUM(si.line_total), 0) as total_revenue,
        COALESCE(SUM(si.line_profit), 0) as total_profit,
        COUNT(DISTINCT si.sale_id) as orders_count
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      GROUP BY p.id
      ORDER BY units_sold DESC, total_revenue DESC
      LIMIT ?
    `).all(limitNum) as any[];

    // Low stock alerts
    const lowStockItems = db.prepare(`
      SELECT 
        p.id, p.sku, p.name, p.brand, p.unit, p.current_stock, p.minimum_stock,
        p.purchase_price, p.selling_price, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status = 'active' AND p.current_stock <= p.minimum_stock
      ORDER BY p.current_stock ASC
      LIMIT 15
    `).all() as any[];

    // Slow moving / Dead stock (items with stock > 5 that have zero sales)
    const deadStockItems = db.prepare(`
      SELECT 
        p.id, p.sku, p.name, p.brand, p.unit, p.current_stock,
        p.purchase_price, (p.current_stock * p.purchase_price) as tied_up_capital,
        c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status = 'active' 
        AND p.current_stock > 5
        AND p.id NOT IN (SELECT DISTINCT product_id FROM sale_items)
      ORDER BY tied_up_capital DESC
      LIMIT 10
    `).all() as any[];

    return res.json({
      success: true,
      data: {
        bestsellers,
        low_stock: lowStockItems,
        dead_stock: deadStockItems,
      },
    });
  } catch (err: any) {
    console.error('Error fetching bestsellers report:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch bestsellers: ' + err.message });
  }
});

// GET /api/reports/summary (Comprehensive Business Analytics)
reportsRouter.get('/summary', (_req: Request, res: Response): any => {
  try {
    // 1. Inventory Valuation
    const valuation = db.prepare(`
      SELECT 
        COUNT(*) as total_skus,
        COALESCE(SUM(current_stock), 0) as total_units,
        COALESCE(SUM(current_stock * purchase_price), 0) as total_cost_value,
        COALESCE(SUM(current_stock * selling_price), 0) as total_retail_value
      FROM products
      WHERE status = 'active'
    `).get() as any;

    const costVal = valuation?.total_cost_value || 0;
    const retailVal = valuation?.total_retail_value || 0;
    const potentialMargin = retailVal - costVal;

    // 2. Customer Receivables (Khata Udhaar)
    const customerDebts = db.prepare(`
      SELECT 
        COUNT(*) as total_customers,
        COALESCE(SUM(outstanding_balance), 0) as total_receivables,
        COUNT(CASE WHEN outstanding_balance > 0 THEN 1 END) as customers_with_dues
      FROM customers
    `).get() as any;

    // 3. Supplier Payables (Factory Dues)
    const supplierDebts = db.prepare(`
      SELECT 
        COUNT(*) as total_suppliers,
        COALESCE(SUM(payable_balance), 0) as total_payables,
        COUNT(CASE WHEN payable_balance > 0 THEN 1 END) as suppliers_with_dues
      FROM suppliers
    `).get() as any;

    // 4. Sales by Payment Method
    const salesByMethod = db.prepare(`
      SELECT 
        payment_method,
        COUNT(*) as transaction_count,
        COALESCE(SUM(grand_total), 0) as total_amount
      FROM sales
      GROUP BY payment_method
      ORDER BY total_amount DESC
    `).all() as any[];

    // 5. Cashier Performance
    const cashierPerf = db.prepare(`
      SELECT 
        u.id as cashier_id,
        u.name as cashier_name,
        COUNT(s.id) as orders_completed,
        COALESCE(SUM(s.grand_total), 0) as total_sales_volume
      FROM users u
      JOIN sales s ON s.cashier_id = u.id
      GROUP BY u.id
      ORDER BY total_sales_volume DESC
    `).all() as any[];

    return res.json({
      success: true,
      data: {
        inventory_valuation: {
          total_skus: valuation?.total_skus || 0,
          total_units: valuation?.total_units || 0,
          total_cost_value: costVal,
          total_retail_value: retailVal,
          potential_margin: potentialMargin,
        },
        receivables: {
          total_customers: customerDebts?.total_customers || 0,
          total_receivables: customerDebts?.total_receivables || 0,
          customers_with_dues: customerDebts?.customers_with_dues || 0,
        },
        payables: {
          total_suppliers: supplierDebts?.total_suppliers || 0,
          total_payables: supplierDebts?.total_payables || 0,
          suppliers_with_dues: supplierDebts?.suppliers_with_dues || 0,
        },
        sales_by_method: salesByMethod || [],
        cashier_performance: cashierPerf || [],
      },
    });
  } catch (err: any) {
    console.error('Error fetching analytics summary:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch summary: ' + err.message });
  }
});
