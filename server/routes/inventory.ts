import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { verifySession } from './auth.js';

export const inventoryRouter = Router();

// GET /api/inventory/summary - high-level valuation and stock counts
inventoryRouter.get('/summary', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);
    const isAdmin = session?.role === 'ADMIN';

    const stats = db
      .prepare(`
        SELECT 
          COUNT(*) as total_items,
          COALESCE(SUM(current_stock), 0) as total_units,
          COALESCE(SUM(current_stock * purchase_price), 0) as total_cost_value,
          COALESCE(SUM(current_stock * selling_price), 0) as total_retail_value,
          COALESCE(SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END), 0) as out_of_stock_count,
          COALESCE(SUM(CASE WHEN current_stock > 0 AND current_stock <= minimum_stock THEN 1 ELSE 0 END), 0) as low_stock_count
        FROM products
        WHERE status != 'discontinued'
      `)
      .get() as any;

    return res.json({
      success: true,
      data: {
        total_items: stats.total_items,
        total_units: stats.total_units,
        total_cost_value: isAdmin ? stats.total_cost_value : 0,
        total_retail_value: stats.total_retail_value,
        potential_profit: isAdmin ? stats.total_retail_value - stats.total_cost_value : 0,
        out_of_stock_count: stats.out_of_stock_count,
        low_stock_count: stats.low_stock_count,
      },
    });
  } catch (error: any) {
    console.error('Error fetching inventory summary:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve inventory summary.' });
  }
});

// GET /api/inventory/transactions - audit trail of stock movements
inventoryRouter.get('/transactions', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);
    const isAdmin = session?.role === 'ADMIN';

    const { product_id, transaction_type, limit = '100', offset = '0' } = req.query;

    let query = `
      SELECT 
        it.id,
        it.product_id,
        p.name as product_name,
        p.sku,
        p.unit,
        it.transaction_type,
        it.reference_type,
        it.reference_id,
        it.quantity,
        ${isAdmin ? 'it.unit_cost,' : '0 as unit_cost,'}
        it.stock_before,
        it.stock_after,
        it.notes,
        u.name as user_name,
        it.created_at
      FROM inventory_transactions it
      LEFT JOIN products p ON it.product_id = p.id
      LEFT JOIN users u ON it.created_by = u.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (product_id) {
      query += ` AND it.product_id = ?`;
      params.push(Number(product_id));
    }

    if (transaction_type && transaction_type !== 'all') {
      query += ` AND it.transaction_type = ?`;
      params.push(transaction_type);
    }

    query += ` ORDER BY it.created_at DESC, it.id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit) || 100, Number(offset) || 0);

    const transactions = db.prepare(query).all(...params);

    return res.json({ success: true, data: transactions });
  } catch (error: any) {
    console.error('Error fetching inventory transactions:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve inventory transactions.' });
  }
});

// POST /api/inventory/adjust - manual physical stock adjustment (ADMIN only)
inventoryRouter.post('/adjust', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin privileges required for stock adjustment.' });
    }

    const { product_id, adjustment_type, quantity, notes } = req.body;

    if (!product_id || !adjustment_type || quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, adjustment type (ADJUSTMENT_IN or ADJUSTMENT_OUT), and quantity are required.',
      });
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Adjustment quantity must be greater than zero.' });
    }

    if (adjustment_type !== 'ADJUSTMENT_IN' && adjustment_type !== 'ADJUSTMENT_OUT') {
      return res.status(400).json({
        success: false,
        message: 'Invalid adjustment type. Must be ADJUSTMENT_IN or ADJUSTMENT_OUT.',
      });
    }

    // Get current product
    const product = db.prepare('SELECT id, name, sku, unit, purchase_price, current_stock FROM products WHERE id = ?').get(Number(product_id)) as any;
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const stockBefore = product.current_stock;
    let stockAfter = stockBefore;

    if (adjustment_type === 'ADJUSTMENT_IN') {
      stockAfter = stockBefore + qty;
    } else {
      if (stockBefore < qty) {
        return res.status(400).json({
          success: false,
          message: `Cannot deduct ${qty} ${product.unit}. Current stock is only ${stockBefore} ${product.unit}.`,
        });
      }
      stockAfter = stockBefore - qty;
    }

    const branchId = Number(req.body.branch_id) || 1;

    // Execute database transaction
    db.exec('BEGIN');
    let transId: number | bigint;
    try {
      db.prepare(`UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(stockAfter, product.id);

      db.prepare(`
        INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock, updated_at)
        VALUES (?, ?, ?, 5, CURRENT_TIMESTAMP)
        ON CONFLICT(branch_id, product_id) DO UPDATE SET 
          current_stock = current_stock + excluded.current_stock,
          updated_at = CURRENT_TIMESTAMP
      `).run(branchId, product.id, adjustment_type === 'ADJUSTMENT_IN' ? qty : -qty);

      const transInfo = db.prepare(`
        INSERT INTO inventory_transactions (
          product_id, transaction_type, reference_type, reference_id,
          quantity, unit_cost, stock_before, stock_after, notes, created_by, branch_id
        ) VALUES (?, ?, 'MANUAL_ADJUSTMENT', NULL, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        product.id,
        adjustment_type,
        adjustment_type === 'ADJUSTMENT_IN' ? qty : -qty,
        product.purchase_price,
        stockBefore,
        stockAfter,
        notes || 'Physical audit count adjustment',
        session.userId,
        branchId
      );

      transId = transInfo.lastInsertRowid;

      db.prepare(`
        INSERT INTO audit_logs (user_id, action, module, record_id, details)
        VALUES (?, 'STOCK_ADJUSTMENT', 'Inventory', ?, ?)
      `).run(
        session.userId,
        product.id,
        `Adjusted stock for ${product.name} (${product.sku}): ${adjustment_type} ${qty} ${product.unit} (Before: ${stockBefore}, After: ${stockAfter}). Reason: ${notes || 'None'}`
      );

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return res.json({
      success: true,
      message: `Stock successfully adjusted for ${product.name}. New balance: ${stockAfter} ${product.unit}.`,
      data: {
        product_id: product.id,
        product_name: product.name,
        stock_before: stockBefore,
        stock_after: stockAfter,
        transaction_id: transId,
      },
    });
  } catch (error: any) {
    console.error('Error adjusting stock:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to adjust stock.' });
  }
});
