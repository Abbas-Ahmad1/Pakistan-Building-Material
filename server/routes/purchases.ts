import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { verifySession } from './auth.js';
import { InventoryBatchHelper } from '../utils/inventoryBatch.js';

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

        // Update product current stock
        db.prepare('UPDATE products SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(item.quantity, item.productId);

        // Process batch costing, price history, and auto pricing
        const batchResult = InventoryBatchHelper.processStockInward(
          item.productId,
          branchId,
          item.quantity,
          item.unitCost,
          purchaseId,
          supplier.id,
          null,
          session.userId,
          'PURCHASE_ORDER'
        );

        // If explicit new selling price specified on purchase form, apply it
        if (item.newSellingPrice && item.newSellingPrice > 0 && Math.abs(item.newSellingPrice - batchResult.new_selling_price) > 0.001) {
          db.prepare('UPDATE products SET selling_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(item.newSellingPrice, item.productId);

          const priceDiff = batchResult.new_selling_price > 0 ? Math.round(((item.newSellingPrice - batchResult.new_selling_price) / batchResult.new_selling_price) * 10000) / 100 : 0;
          db.prepare(`
            INSERT INTO product_price_history (
              product_id, branch_id, old_cost, new_cost, cost_change_percent,
              old_selling_price, new_selling_price, price_change_percent,
              pricing_mode, reason, purchase_id, user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL_PO_OVERRIDE', ?, ?, ?)
          `).run(
            item.productId, branchId, item.unitCost, item.unitCost, 0,
            batchResult.new_selling_price, item.newSellingPrice, priceDiff,
            `Manual selling price override on PO #${poNumber}`, purchaseId, session.userId
          );
        }

        updateBranchStockStmt.run(branchId, item.productId, item.quantity);

        insertTxStmt.run(
          item.productId,
          purchaseId,
          item.quantity,
          item.unitCost,
          item.stockBefore,
          item.stockAfter,
          `Stock Inward from ${supplier.name} (${poNumber}, Batch: ${batchResult.batch_number})`,
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

// GET /api/purchases/returns - list all purchase returns across the store
purchasesRouter.get('/returns/list', (req: Request, res: Response): any => {
  try {
    const returns = db.prepare(`
      SELECT 
        pr.id,
        pr.return_number,
        pr.purchase_id,
        p.purchase_number,
        pr.supplier_id,
        s.name as supplier_name,
        pr.total_amount,
        pr.refund_type,
        pr.reason,
        pr.created_at,
        u.name as created_by_name,
        (SELECT COUNT(*) FROM purchase_return_items pri WHERE pri.return_id = pr.id) as items_count
      FROM purchase_returns pr
      JOIN purchases p ON pr.purchase_id = p.id
      JOIN suppliers s ON pr.supplier_id = s.id
      LEFT JOIN users u ON pr.created_by = u.id
      ORDER BY pr.id DESC
    `).all();

    return res.json({ success: true, data: returns });
  } catch (error: any) {
    console.error('Error fetching purchase returns:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch purchase returns.' });
  }
});

// GET /api/purchases/:id/returns - get returns for a specific purchase
purchasesRouter.get('/:id/returns', (req: Request, res: Response): any => {
  try {
    const purchaseId = Number(req.params.id);
    const returns = db.prepare(`
      SELECT 
        pr.id,
        pr.return_number,
        pr.purchase_id,
        pr.supplier_id,
        s.name as supplier_name,
        pr.total_amount,
        pr.refund_type,
        pr.reason,
        pr.created_at,
        u.name as created_by_name
      FROM purchase_returns pr
      JOIN suppliers s ON pr.supplier_id = s.id
      LEFT JOIN users u ON pr.created_by = u.id
      WHERE pr.purchase_id = ?
      ORDER BY pr.id DESC
    `).all(purchaseId) as any[];

    for (const r of returns) {
      r.items = db.prepare(`
        SELECT 
          pri.id,
          pri.product_id,
          p.name as product_name,
          p.sku,
          pri.quantity,
          pri.unit_cost,
          pri.total_amount,
          pri.batch_id,
          ib.batch_number,
          pri.reason
        FROM purchase_return_items pri
        JOIN products p ON pri.product_id = p.id
        LEFT JOIN inventory_batches ib ON pri.batch_id = ib.id
        WHERE pri.return_id = ?
      `).all(r.id);
    }

    return res.json({ success: true, data: returns });
  } catch (error: any) {
    console.error('Error fetching purchase returns for ID:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch purchase returns.' });
  }
});

// POST /api/purchases/:id/returns - process a purchase/supplier return
purchasesRouter.post('/:id/returns', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session || (session.role !== 'ADMIN' && session.role !== 'MANAGER')) {
      return res.status(403).json({ success: false, message: 'Only Managers and Admins can process supplier returns.' });
    }

    const purchaseId = Number(req.params.id);
    const { items, refund_type = 'LEDGER_CREDIT', reason } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Return must contain at least one item.' });
    }

    const purchase = db.prepare(`
      SELECT p.*, s.name as supplier_name, s.payable_balance
      FROM purchases p
      JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.id = ?
    `).get(purchaseId) as any;

    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found.' });
    }

    // Validate return items against purchase items and inventory batches
    const validatedItems: Array<{
      productId: number;
      productName: string;
      quantity: number;
      unitCost: number;
      totalAmount: number;
      batchId?: number;
      reason: string;
    }> = [];

    let totalReturnAmount = 0;

    for (const item of items) {
      const prodId = Number(item.product_id);
      const qty = Number(item.quantity);
      if (!prodId || isNaN(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid product or quantity specified.' });
      }

      const pItem = db.prepare(`
        SELECT pi.*, p.name as product_name, p.current_stock
        FROM purchase_items pi
        JOIN products p ON pi.product_id = p.id
        WHERE pi.purchase_id = ? AND pi.product_id = ?
      `).get(purchaseId, prodId) as any;

      if (!pItem) {
        return res.status(400).json({
          success: false,
          message: `Product ID ${prodId} was not part of Purchase #${purchase.purchase_number}.`,
        });
      }

      // Check previously returned quantity for this item
      const prevReturnedRow = db.prepare(`
        SELECT COALESCE(SUM(quantity), 0) as already_returned
        FROM purchase_return_items pri
        JOIN purchase_returns pr ON pri.return_id = pr.id
        WHERE pr.purchase_id = ? AND pri.product_id = ?
      `).get(purchaseId, prodId) as any;

      const alreadyReturned = Number(prevReturnedRow?.already_returned) || 0;
      const originalPurchased = Number(pItem.quantity);
      const maxReturnable = originalPurchased - alreadyReturned;

      if (qty > maxReturnable) {
        return res.status(400).json({
          success: false,
          message: `Cannot return ${qty} units of "${pItem.product_name}". Purchased: ${originalPurchased}, Already returned: ${alreadyReturned}, Max returnable: ${maxReturnable}.`,
        });
      }

      const unitCost = Number(item.unit_cost) || Number(pItem.unit_price) || 0;
      const lineTotal = Math.round(qty * unitCost * 100) / 100;
      totalReturnAmount = Math.round((totalReturnAmount + lineTotal) * 100) / 100;

      validatedItems.push({
        productId: prodId,
        productName: pItem.product_name,
        quantity: qty,
        unitCost,
        totalAmount: lineTotal,
        batchId: item.batch_id ? Number(item.batch_id) : undefined,
        reason: (item.reason || reason || 'Supplier return / defect').trim(),
      });
    }

    db.exec('BEGIN');
    let returnId: number;
    let returnNumber: string;

    try {
      const countRes = db.prepare('SELECT COUNT(*) as count FROM purchase_returns').get() as { count: number };
      const nextNum = 1001 + (countRes?.count || 0);
      returnNumber = `PR-${new Date().getFullYear()}-${nextNum}`;

      const insertReturn = db.prepare(`
        INSERT INTO purchase_returns (
          purchase_id, return_number, supplier_id, total_amount, refund_type, reason, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        purchaseId,
        returnNumber,
        purchase.supplier_id,
        totalReturnAmount,
        refund_type,
        reason?.trim() || null,
        session.userId
      );

      returnId = Number(insertReturn.lastInsertRowid);

      const branchId = 1; // Main branch

      // Process each return item
      for (const vi of validatedItems) {
        // 1. Process batch deduction
        const batchInfo = InventoryBatchHelper.processPurchaseReturn(
          vi.productId,
          purchaseId,
          vi.quantity,
          returnId,
          vi.batchId
        );

        // 2. Insert into purchase_return_items
        db.prepare(`
          INSERT INTO purchase_return_items (
            return_id, product_id, quantity, unit_cost, total_amount, batch_id, reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(returnId, vi.productId, vi.quantity, vi.unitCost, vi.totalAmount, batchInfo.batch_id, vi.reason);

        // 3. Deduct product global stock and branch stock
        const prod = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(vi.productId) as any;
        const currentStock = Number(prod?.current_stock) || 0;
        const newStock = Math.max(0, currentStock - vi.quantity);

        db.prepare('UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(newStock, vi.productId);

        db.prepare(`
          UPDATE branch_stocks 
          SET current_stock = MAX(0, current_stock - ?), updated_at = CURRENT_TIMESTAMP 
          WHERE branch_id = ? AND product_id = ?
        `).run(vi.quantity, branchId, vi.productId);

        // 4. Record inventory_transactions
        db.prepare(`
          INSERT INTO inventory_transactions (
            product_id, transaction_type, reference_type, reference_id,
            quantity, unit_cost, stock_before, stock_after, notes, created_by, branch_id
          ) VALUES (?, 'PURCHASE_RETURN', 'PURCHASE_RETURN', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          vi.productId,
          returnId,
          -vi.quantity,
          vi.unitCost,
          currentStock,
          newStock,
          `Supplier Return ${returnNumber} for PO ${purchase.purchase_number} (${vi.reason})`,
          session.userId,
          branchId
        );
      }

      // 5. Update purchase record
      const prevReturned = Number(purchase.returned_amount) || 0;
      const newReturnedTotal = Math.round((prevReturned + totalReturnAmount) * 100) / 100;
      const originalGrandTotal = Number(purchase.grand_total);
      
      let newDue = Number(purchase.due_amount) || 0;
      let newPaid = Number(purchase.paid_amount) || 0;

      // Credit reduces due amount first
      const dueReduction = Math.min(newDue, totalReturnAmount);
      newDue = Math.max(0, Math.round((newDue - dueReduction) * 100) / 100);

      const netPurchased = Math.max(0, originalGrandTotal - newReturnedTotal);
      let newPaymentStatus = purchase.payment_status;
      if (netPurchased <= 0.01) {
        newPaymentStatus = 'RETURNED';
      } else if (newDue <= 0.01) {
        newPaymentStatus = 'PAID';
      } else if (newPaid > 0) {
        newPaymentStatus = 'PARTIAL';
      } else {
        newPaymentStatus = 'DUE';
      }

      db.prepare(`
        UPDATE purchases 
        SET returned_amount = ?, due_amount = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newReturnedTotal, newDue, newPaymentStatus, purchaseId);

      // 6. Update supplier payable ledger
      const excessReturnCredit = Math.max(0, totalReturnAmount - dueReduction);
      const supplierPayableReduction = totalReturnAmount; // Total invoice debt reduction
      const currentPayable = Number(purchase.payable_balance) || 0;
      const newSupplierPayable = Math.max(0, Math.round((currentPayable - supplierPayableReduction) * 100) / 100);

      db.prepare(`
        UPDATE suppliers 
        SET payable_balance = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(newSupplierPayable, purchase.supplier_id);

      // If supplier paid cash refund
      if (refund_type === 'CASH') {
        db.prepare(`
          INSERT INTO supplier_payments (supplier_id, purchase_id, amount, payment_method, notes, paid_by)
          VALUES (?, ?, ?, 'Cash', ?, ?)
        `).run(
          purchase.supplier_id,
          purchaseId,
          -totalReturnAmount,
          `Cash refund received for Supplier Return ${returnNumber}`,
          session.userId
        );
      }

      // 7. Audit log
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, module, record_id, details)
        VALUES (?, 'PURCHASE_RETURN', 'Purchases', ?, ?)
      `).run(
        session.userId,
        returnId,
        `Processed supplier return ${returnNumber} for PO ${purchase.purchase_number}. Amount: Rs. ${totalReturnAmount.toLocaleString()}. Supplier payable updated.`
      );

      db.exec('COMMIT');

      return res.status(201).json({
        success: true,
        message: `Supplier return ${returnNumber} processed successfully. Stock deducted and payable balance adjusted.`,
        data: {
          return_id: returnId,
          return_number: returnNumber,
          total_amount: totalReturnAmount,
          new_supplier_payable: newSupplierPayable,
        },
      });
    } catch (innerErr) {
      db.exec('ROLLBACK');
      throw innerErr;
    }
  } catch (error: any) {
    console.error('Error processing supplier return:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to process supplier return.' });
  }
});
