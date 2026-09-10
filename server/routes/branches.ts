import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { verifySession } from './auth.js';

export const branchesRouter = Router();

// GET /api/branches - list all branches with metrics
branchesRouter.get('/', (_req: Request, res: Response): any => {
  try {
    const branches = db
      .prepare(`
        SELECT 
          b.id,
          b.name,
          b.code,
          b.address,
          b.phone,
          b.manager_name,
          b.is_main,
          b.status,
          b.created_at,
          COALESCE(bs.total_products, 0) as total_products,
          COALESCE(bs.total_units, 0) as total_units,
          COALESCE(s.sales_count, 0) as sales_count,
          COALESCE(s.total_revenue, 0) as total_revenue
        FROM branches b
        LEFT JOIN (
          SELECT 
            branch_id, 
            COUNT(DISTINCT product_id) as total_products,
            SUM(current_stock) as total_units
          FROM branch_stocks
          GROUP BY branch_id
        ) bs ON b.id = bs.branch_id
        LEFT JOIN (
          SELECT 
            branch_id,
            COUNT(id) as sales_count,
            SUM(grand_total) as total_revenue
          FROM sales
          GROUP BY branch_id
        ) s ON b.id = s.branch_id
        ORDER BY b.is_main DESC, b.id ASC
      `)
      .all();

    return res.json({ success: true, data: branches });
  } catch (error: any) {
    console.error('Error fetching branches:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch branches.' });
  }
});

// POST /api/branches - create new branch (ADMIN only)
branchesRouter.post('/', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin privileges required.' });
    }

    const { name, code, address, phone, manager_name, is_main } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Branch name and code are required.' });
    }

    // Check duplicate code
    const existing = db.prepare('SELECT id FROM branches WHERE code = ? OR name = ?').get(code.trim(), name.trim());
    if (existing) {
      return res.status(400).json({ success: false, message: 'A branch with this name or code already exists.' });
    }

    const result = db
      .prepare(`
        INSERT INTO branches (name, code, address, phone, manager_name, is_main, status)
        VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
      `)
      .run(
        name.trim(),
        code.trim().toUpperCase(),
        address?.trim() || null,
        phone?.trim() || null,
        manager_name?.trim() || null,
        is_main ? 1 : 0
      );

    const newBranchId = Number(result.lastInsertRowid);

    // Initialize branch_stocks for all products at 0
    const products = db.prepare('SELECT id FROM products').all() as { id: number }[];
    const insertStock = db.prepare('INSERT OR IGNORE INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock) VALUES (?, ?, 0, 5)');
    for (const p of products) {
      insertStock.run(newBranchId, p.id);
    }

    db.prepare(`
      INSERT INTO audit_logs (user_id, action, module, record_id, details)
      VALUES (?, 'CREATE_BRANCH', 'Branches', ?, ?)
    `).run(session.userId, newBranchId, `Created branch: ${name} (${code})`);

    const created = db.prepare('SELECT * FROM branches WHERE id = ?').get(newBranchId);
    return res.json({ success: true, message: 'Branch created successfully.', data: created });
  } catch (error: any) {
    console.error('Error creating branch:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create branch.' });
  }
});

// PUT /api/branches/:id - update branch details (ADMIN only)
branchesRouter.put('/:id', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin privileges required.' });
    }

    const branchId = Number(req.params.id);
    const { name, code, address, phone, manager_name, status } = req.body;

    const existing = db.prepare('SELECT id FROM branches WHERE id = ?').get(branchId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Branch not found.' });
    }

    db.prepare(`
      UPDATE branches 
      SET name = COALESCE(?, name),
          code = COALESCE(?, code),
          address = COALESCE(?, address),
          phone = COALESCE(?, phone),
          manager_name = COALESCE(?, manager_name),
          status = COALESCE(?, status)
      WHERE id = ?
    `).run(
      name?.trim(),
      code?.trim()?.toUpperCase(),
      address?.trim(),
      phone?.trim(),
      manager_name?.trim(),
      status,
      branchId
    );

    const updated = db.prepare('SELECT * FROM branches WHERE id = ?').get(branchId);
    return res.json({ success: true, message: 'Branch updated successfully.', data: updated });
  } catch (error: any) {
    console.error('Error updating branch:', error);
    return res.status(500).json({ success: false, message: 'Failed to update branch.' });
  }
});

// GET /api/branches/stocks - multi-branch stock matrix for all products
branchesRouter.get('/stocks', (req: Request, res: Response): any => {
  try {
    const { search, category_id, branch_id } = req.query;

    let query = `
      SELECT 
        p.id,
        p.sku,
        p.barcode,
        p.name,
        p.brand,
        p.unit,
        p.purchase_price,
        p.selling_price,
        p.current_stock as total_stock,
        p.minimum_stock,
        c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status != 'discontinued'
    `;

    const params: any[] = [];

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim()}%`;
      query += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.brand LIKE ?)`;
      params.push(term, term, term, term);
    }

    if (category_id && category_id !== 'all') {
      query += ` AND p.category_id = ?`;
      params.push(Number(category_id));
    }

    query += ` ORDER BY p.category_id ASC, p.name ASC`;

    const products = db.prepare(query).all(...params) as any[];

    // Fetch all active branches
    const branches = db.prepare(`SELECT id, name, code FROM branches WHERE status = 'ACTIVE' ORDER BY is_main DESC, id ASC`).all() as any[];

    // Fetch all branch_stocks
    const allStocks = db.prepare(`
      SELECT bs.product_id, bs.branch_id, bs.current_stock, bs.minimum_stock
      FROM branch_stocks bs
    `).all() as any[];

    const stockLookup = new Map<string, { current_stock: number; minimum_stock: number }>();
    for (const s of allStocks) {
      stockLookup.set(`${s.branch_id}_${s.product_id}`, {
        current_stock: Number(s.current_stock) || 0,
        minimum_stock: Number(s.minimum_stock) || 5,
      });
    }

    // Combine matrix
    const matrix = products.map((p) => {
      const branchBreakdown = branches.map((b) => {
        const itemStock = stockLookup.get(`${b.id}_${p.id}`);
        return {
          branch_id: b.id,
          branch_name: b.name,
          branch_code: b.code,
          current_stock: itemStock ? itemStock.current_stock : 0,
          minimum_stock: itemStock ? itemStock.minimum_stock : 5,
        };
      });

      return {
        ...p,
        branches: branchBreakdown,
      };
    });

    // If filtered by specific branch
    if (branch_id && branch_id !== 'all') {
      const bId = Number(branch_id);
      return res.json({
        success: true,
        data: {
          branches,
          products: matrix.map((p) => ({
            ...p,
            branch_stock: p.branches.find((b: any) => b.branch_id === bId)?.current_stock || 0,
          })),
        },
      });
    }

    return res.json({
      success: true,
      data: {
        branches,
        products: matrix,
      },
    });
  } catch (error: any) {
    console.error('Error fetching branch stocks:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch branch stocks.' });
  }
});

// GET /api/branches/transfers - list stock transfers history
branchesRouter.get('/transfers', (_req: Request, res: Response): any => {
  try {
    const transfers = db
      .prepare(`
        SELECT 
          st.id,
          st.transfer_number,
          st.transfer_date,
          st.from_branch_id,
          fb.name as from_branch_name,
          fb.code as from_branch_code,
          st.to_branch_id,
          tb.name as to_branch_name,
          tb.code as to_branch_code,
          st.status,
          st.notes,
          u.name as created_by_name,
          st.created_at,
          COUNT(sti.id) as items_count,
          SUM(sti.quantity) as total_quantity
        FROM stock_transfers st
        JOIN branches fb ON st.from_branch_id = fb.id
        JOIN branches tb ON st.to_branch_id = tb.id
        LEFT JOIN users u ON st.created_by = u.id
        LEFT JOIN stock_transfer_items sti ON st.id = sti.transfer_id
        GROUP BY st.id
        ORDER BY st.transfer_date DESC, st.id DESC
        LIMIT 100
      `)
      .all() as any[];

    // Fetch items for each transfer
    for (const t of transfers) {
      t.items = db
        .prepare(`
          SELECT 
            sti.id,
            sti.product_id,
            p.name as product_name,
            p.sku,
            p.unit,
            sti.quantity
          FROM stock_transfer_items sti
          JOIN products p ON sti.product_id = p.id
          WHERE sti.transfer_id = ?
        `)
        .all(t.id);
    }

    return res.json({ success: true, data: transfers });
  } catch (error: any) {
    console.error('Error fetching stock transfers:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch stock transfers.' });
  }
});

// POST /api/branches/transfers - execute a branch stock transfer
branchesRouter.post('/transfers', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { from_branch_id, to_branch_id, items, notes } = req.body;

    if (!from_branch_id || !to_branch_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Source branch, destination branch, and at least one item are required.',
      });
    }

    const fromBranchId = Number(from_branch_id);
    const toBranchId = Number(to_branch_id);

    if (fromBranchId === toBranchId) {
      return res.status(400).json({
        success: false,
        message: 'Source and destination branches cannot be the same.',
      });
    }

    const fromBranch = db.prepare('SELECT id, name, code FROM branches WHERE id = ?').get(fromBranchId) as any;
    const toBranch = db.prepare('SELECT id, name, code FROM branches WHERE id = ?').get(toBranchId) as any;

    if (!fromBranch || !toBranch) {
      return res.status(404).json({ success: false, message: 'Specified branches do not exist.' });
    }

    // Validate quantities and availability at source branch
    for (const item of items) {
      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: 'Transfer quantity must be greater than zero.' });
      }

      const prod = db.prepare('SELECT id, name, unit FROM products WHERE id = ?').get(Number(item.product_id)) as any;
      if (!prod) {
        return res.status(404).json({ success: false, message: `Product ID ${item.product_id} not found.` });
      }

      // Check current stock in from_branch
      const sourceStock = db
        .prepare('SELECT current_stock FROM branch_stocks WHERE branch_id = ? AND product_id = ?')
        .get(fromBranchId, item.product_id) as any;

      const avail = Number(sourceStock?.current_stock) || 0;
      if (avail < qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock at ${fromBranch.name} for "${prod.name}". Available: ${avail} ${prod.unit}, Requested: ${qty} ${prod.unit}.`,
        });
      }
    }

    // Begin atomic transfer transaction
    db.exec('BEGIN');
    let transferId: number;
    let transferNumber: string;

    try {
      // Generate unique transfer number
      const countRes = db.prepare('SELECT COUNT(*) as count FROM stock_transfers').get() as { count: number };
      const nextNum = 1001 + (countRes?.count || 0);
      transferNumber = `TRF-${new Date().getFullYear()}-${nextNum}`;

      const transferResult = db
        .prepare(`
          INSERT INTO stock_transfers (transfer_number, from_branch_id, to_branch_id, notes, created_by, status)
          VALUES (?, ?, ?, ?, ?, 'COMPLETED')
        `)
        .run(transferNumber, fromBranchId, toBranchId, notes?.trim() || null, session.userId);

      transferId = Number(transferResult.lastInsertRowid);

      // Process each item
      for (const item of items) {
        const prodId = Number(item.product_id);
        const qty = Number(item.quantity);

        const prod = db.prepare('SELECT id, name, purchase_price FROM products WHERE id = ?').get(prodId) as any;

        // Insert transfer item record
        db.prepare(`
          INSERT INTO stock_transfer_items (transfer_id, product_id, quantity)
          VALUES (?, ?, ?)
        `).run(transferId, prodId, qty);

        // Get source stock before and after
        const srcBefore = Number(
          (db.prepare('SELECT current_stock FROM branch_stocks WHERE branch_id = ? AND product_id = ?').get(fromBranchId, prodId) as any)?.current_stock || 0
        );
        const srcAfter = srcBefore - qty;

        // Deduct from source branch
        db.prepare(`
          UPDATE branch_stocks 
          SET current_stock = ?, updated_at = CURRENT_TIMESTAMP
          WHERE branch_id = ? AND product_id = ?
        `).run(srcAfter, fromBranchId, prodId);

        // Record outgoing inventory transaction
        db.prepare(`
          INSERT INTO inventory_transactions (
            product_id, transaction_type, reference_type, reference_id,
            quantity, unit_cost, stock_before, stock_after, notes, created_by, branch_id
          ) VALUES (?, 'ADJUSTMENT_OUT', 'BRANCH_TRANSFER_OUT', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          prodId,
          transferId,
          -qty,
          prod.purchase_price || 0,
          srcBefore,
          srcAfter,
          `Stock transfer to ${toBranch.name} (${transferNumber})`,
          session.userId,
          fromBranchId
        );

        // Add to destination branch (or insert if not exists)
        const destExisting = db
          .prepare('SELECT current_stock FROM branch_stocks WHERE branch_id = ? AND product_id = ?')
          .get(toBranchId, prodId) as any;

        const destBefore = Number(destExisting?.current_stock || 0);
        const destAfter = destBefore + qty;

        db.prepare(`
          INSERT INTO branch_stocks (branch_id, product_id, current_stock, minimum_stock, updated_at)
          VALUES (?, ?, ?, 5, CURRENT_TIMESTAMP)
          ON CONFLICT(branch_id, product_id) DO UPDATE SET 
            current_stock = current_stock + excluded.current_stock,
            updated_at = CURRENT_TIMESTAMP
        `).run(toBranchId, prodId, qty);

        // Record incoming inventory transaction
        db.prepare(`
          INSERT INTO inventory_transactions (
            product_id, transaction_type, reference_type, reference_id,
            quantity, unit_cost, stock_before, stock_after, notes, created_by, branch_id
          ) VALUES (?, 'ADJUSTMENT_IN', 'BRANCH_TRANSFER_IN', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          prodId,
          transferId,
          qty,
          prod.purchase_price || 0,
          destBefore,
          destAfter,
          `Stock transfer received from ${fromBranch.name} (${transferNumber})`,
          session.userId,
          toBranchId
        );
      }

      // Log in audit logs
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, module, record_id, details)
        VALUES (?, 'STOCK_TRANSFER', 'Inventory', ?, ?)
      `).run(
        session.userId,
        transferId,
        `Transferred ${items.length} item(s) from ${fromBranch.name} to ${toBranch.name}. Transfer #: ${transferNumber}`
      );

      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }

    return res.json({
      success: true,
      message: `Stock successfully transferred from ${fromBranch.name} to ${toBranch.name} (${transferNumber}).`,
      data: {
        transfer_id: transferId,
        transfer_number: transferNumber,
      },
    });
  } catch (error: any) {
    console.error('Error executing stock transfer:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to execute stock transfer.' });
  }
});

// GET /api/branches/analytics - multi-branch sales, stock & cashier collection report
branchesRouter.get('/analytics', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin privileges required.' });
    }

    const { date } = req.query;
    // Format YYYY-MM-DD
    const targetDate = typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)
      ? date
      : new Date().toISOString().split('T')[0];

    const branches = db.prepare(`SELECT id, name, code, is_main, address, phone FROM branches WHERE status = 'ACTIVE' ORDER BY is_main DESC, id ASC`).all() as any[];

    // 1. Branch Performance: Today, This Week, This Month, All Time
    const branchPerformance = branches.map((b) => {
      // Today
      const todaySales = db
        .prepare(`
          SELECT 
            COUNT(id) as orders,
            COALESCE(SUM(grand_total), 0) as revenue,
            COALESCE(SUM(paid_amount), 0) as paid,
            COALESCE(SUM(due_amount), 0) as due
          FROM sales
          WHERE branch_id = ? AND date(sale_date) = ?
        `)
        .get(b.id, targetDate) as any;

      // This Week (last 7 days)
      const weeklySales = db
        .prepare(`
          SELECT 
            COUNT(id) as orders,
            COALESCE(SUM(grand_total), 0) as revenue
          FROM sales
          WHERE branch_id = ? AND date(sale_date) >= date(?, '-7 days')
        `)
        .get(b.id, targetDate) as any;

      // This Month (last 30 days)
      const monthlySales = db
        .prepare(`
          SELECT 
            COUNT(id) as orders,
            COALESCE(SUM(grand_total), 0) as revenue
          FROM sales
          WHERE branch_id = ? AND date(sale_date) >= date(?, '-30 days')
        `)
        .get(b.id, targetDate) as any;

      // Overall All-Time
      const allTimeSales = db
        .prepare(`
          SELECT 
            COUNT(id) as orders,
            COALESCE(SUM(grand_total), 0) as revenue,
            COALESCE(SUM(paid_amount), 0) as paid,
            COALESCE(SUM(due_amount), 0) as due
          FROM sales
          WHERE branch_id = ?
        `)
        .get(b.id) as any;

      // Inventory valuation at branch
      const invStats = db
        .prepare(`
          SELECT 
            COUNT(bs.product_id) as total_products,
            COALESCE(SUM(bs.current_stock), 0) as total_units,
            COALESCE(SUM(bs.current_stock * p.purchase_price), 0) as total_cost_value,
            COALESCE(SUM(bs.current_stock * p.selling_price), 0) as total_retail_value,
            COALESCE(SUM(CASE WHEN bs.current_stock <= 0 THEN 1 ELSE 0 END), 0) as out_of_stock,
            COALESCE(SUM(CASE WHEN bs.current_stock > 0 AND bs.current_stock <= bs.minimum_stock THEN 1 ELSE 0 END), 0) as low_stock
          FROM branch_stocks bs
          JOIN products p ON bs.product_id = p.id
          WHERE bs.branch_id = ? AND p.status != 'discontinued'
        `)
        .get(b.id) as any;

      return {
        branch_id: b.id,
        branch_name: b.name,
        branch_code: b.code,
        is_main: b.is_main === 1,
        address: b.address,
        today: {
          orders: todaySales?.orders || 0,
          revenue: todaySales?.revenue || 0,
          paid: todaySales?.paid || 0,
          due: todaySales?.due || 0,
        },
        weekly: {
          orders: weeklySales?.orders || 0,
          revenue: weeklySales?.revenue || 0,
        },
        monthly: {
          orders: monthlySales?.orders || 0,
          revenue: monthlySales?.revenue || 0,
        },
        all_time: {
          orders: allTimeSales?.orders || 0,
          revenue: allTimeSales?.revenue || 0,
          paid: allTimeSales?.paid || 0,
          due: allTimeSales?.due || 0,
        },
        inventory: {
          total_products: invStats?.total_products || 0,
          total_units: invStats?.total_units || 0,
          total_cost_value: invStats?.total_cost_value || 0,
          total_retail_value: invStats?.total_retail_value || 0,
          out_of_stock: invStats?.out_of_stock || 0,
          low_stock: invStats?.low_stock || 0,
        },
      };
    });

    // 2. Cashier-Wise Daily Collection Reports for selected date
    const cashierCollections = db
      .prepare(`
        SELECT 
          s.cashier_id,
          COALESCE(s.cashier_name, u.name, 'Terminal Cashier') as cashier_name,
          s.branch_id,
          b.name as branch_name,
          b.code as branch_code,
          COUNT(s.id) as invoices_count,
          COALESCE(SUM(s.grand_total), 0) as total_billed,
          COALESCE(SUM(CASE WHEN s.payment_method = 'Cash' THEN s.paid_amount ELSE 0 END), 0) as cash_collected,
          COALESCE(SUM(CASE WHEN s.payment_method != 'Cash' THEN s.paid_amount ELSE 0 END), 0) as bank_card_collected,
          COALESCE(SUM(s.paid_amount), 0) as total_collected,
          COALESCE(SUM(s.due_amount), 0) as total_due
        FROM sales s
        LEFT JOIN users u ON s.cashier_id = u.id
        LEFT JOIN branches b ON s.branch_id = b.id
        WHERE date(s.sale_date) = ?
        GROUP BY s.cashier_id, s.branch_id
        ORDER BY s.branch_id ASC, total_collected DESC
      `)
      .all(targetDate) as any[];

    // Calculate returns processed by cashiers on this date
    for (const c of cashierCollections) {
      const returns = db
        .prepare(`
          SELECT 
            COUNT(sr.id) as return_count,
            COALESCE(SUM(sr.total_refund_amount), 0) as total_refund,
            COALESCE(SUM(sr.cash_refund_amount), 0) as cash_refund
          FROM sales_returns sr
          JOIN sales s ON sr.sale_id = s.id
          WHERE date(sr.created_at) = ? AND s.branch_id = ?
        `)
        .get(targetDate, c.branch_id) as any;

      c.returns_count = returns?.return_count || 0;
      c.total_refund = returns?.total_refund || 0;
      c.cash_refund = returns?.cash_refund || 0;
      c.net_cash_in_hand = Math.max(0, c.cash_collected - (returns?.cash_refund || 0));
    }

    return res.json({
      success: true,
      data: {
        date: targetDate,
        branch_performance: branchPerformance,
        cashier_collections: cashierCollections,
      },
    });
  } catch (error: any) {
    console.error('Error fetching branch analytics:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch branch analytics.' });
  }
});
