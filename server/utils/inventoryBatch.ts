import { db } from '../db/database';

export interface BatchConsumptionResult {
  cogs: number;
  effective_unit_cost: number;
  consumed_batches: Array<{
    batch_id: number;
    batch_number: string;
    quantity: number;
    unit_cost: number;
    line_cogs: number;
  }>;
  costing_method: string;
}

export interface InwardResult {
  batch_id: number;
  batch_number: string;
  previous_cost: number;
  new_cost: number;
  cost_change_percent: number;
  weighted_avg_cost: number;
  selling_price_updated: boolean;
  old_selling_price: number;
  new_selling_price: number;
}

export class InventoryBatchHelper {
  /**
   * Process stock inward from a Purchase Order or opening stock adjustment
   */
  public static processStockInward(
    productId: number,
    branchId: number,
    quantity: number,
    unitCost: number,
    purchaseId: number | null = null,
    supplierId: number | null = null,
    batchNumber: string | null = null,
    userId: number | null = null,
    referenceType: string = 'PURCHASE_ORDER'
  ): InwardResult {
    // 1. Fetch current product configuration
    const product = db.prepare(`
      SELECT 
        id, name, purchase_price, previous_cost, cost_change_percent,
        selling_price, pricing_mode, markup_percentage, margin_percentage,
        auto_price_update, current_stock, weighted_avg_cost
      FROM products WHERE id = ?
    `).get(productId) as any;

    if (!product) {
      throw new Error(`Product #${productId} does not exist.`);
    }

    const previousCost = Number(product.purchase_price) || 0;
    const oldSellingPrice = Number(product.selling_price) || 0;
    let newSellingPrice = oldSellingPrice;
    let sellingPriceUpdated = false;

    // Calculate cost change percentage
    const costChangePercent = previousCost > 0
      ? Math.round(((unitCost - previousCost) / previousCost) * 10000) / 100
      : 0.0;

    // 2. Compute Weighted Average Cost across active stock
    const activeBatches = db.prepare(`
      SELECT remaining_quantity, unit_cost 
      FROM inventory_batches 
      WHERE product_id = ? AND remaining_quantity > 0
    `).all(productId) as any[];

    let currentValuation = 0.0;
    let currentActiveStock = 0.0;
    for (const b of activeBatches) {
      currentValuation += Number(b.remaining_quantity) * Number(b.unit_cost);
      currentActiveStock += Number(b.remaining_quantity);
    }

    const newValuation = currentValuation + (quantity * unitCost);
    const newTotalStock = currentActiveStock + quantity;
    const weightedAvgCost = newTotalStock > 0
      ? Math.round((newValuation / newTotalStock) * 100) / 100
      : unitCost;

    // 3. Evaluate Automatic Selling Price Update
    const autoUpdate = Boolean(product.auto_price_update);
    const pricingMode = product.pricing_mode || 'FIXED';
    const markup = Number(product.markup_percentage) || 0;
    const margin = Number(product.margin_percentage) || 0;

    if (autoUpdate) {
      if (pricingMode === 'MARKUP' && markup > 0) {
        newSellingPrice = Math.round(unitCost * (1 + (markup / 100)) * 100) / 100;
        sellingPriceUpdated = Math.abs(newSellingPrice - oldSellingPrice) > 0.001;
      } else if (pricingMode === 'MARGIN' && margin > 0 && margin < 100) {
        newSellingPrice = Math.round((unitCost / (1 - (margin / 100))) * 100) / 100;
        sellingPriceUpdated = Math.abs(newSellingPrice - oldSellingPrice) > 0.001;
      }
    }

    // 4. Update Product Catalog
    db.prepare(`
      UPDATE products SET
        previous_cost = ?,
        purchase_price = ?,
        cost_change_percent = ?,
        weighted_avg_cost = ?,
        selling_price = ?,
        last_cost_update = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(previousCost, unitCost, costChangePercent, weightedAvgCost, newSellingPrice, productId);

    // 5. Generate Batch Number if not provided
    const finalBatchNumber = batchNumber || `BATCH-${Date.now().toString(36).toUpperCase()}-${branchId}-${productId}`;

    // 6. Insert new Inventory Batch
    const batchInsert = db.prepare(`
      INSERT INTO inventory_batches (
        product_id, branch_id, purchase_id, supplier_id,
        batch_number, unit_cost, initial_quantity, remaining_quantity,
        received_date, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `).run(
      productId, branchId, purchaseId, supplierId,
      finalBatchNumber, unitCost, quantity, quantity,
      `Stock Inward via ${referenceType}`
    );

    const batchId = Number(batchInsert.lastInsertRowid);

    // 7. Record Inward Batch Transaction
    db.prepare(`
      INSERT INTO inventory_batch_transactions (
        batch_id, transaction_type, reference_type, reference_id,
        quantity, unit_cost, remaining_quantity_after
      ) VALUES (?, 'PURCHASE', ?, ?, ?, ?, ?)
    `).run(batchId, referenceType, purchaseId, quantity, unitCost, quantity);

    // 8. Log Price / Cost History Audit Record
    const priceChangePercent = (oldSellingPrice > 0 && sellingPriceUpdated)
      ? Math.round(((newSellingPrice - oldSellingPrice) / oldSellingPrice) * 10000) / 100
      : 0.0;

    let historyReason = `Stock Inward: PO #${purchaseId || 'N/A'} at Rs. ${unitCost.toFixed(2)}`;
    if (sellingPriceUpdated) {
      historyReason += ` | Auto-adjusted selling price from Rs. ${oldSellingPrice.toFixed(2)} to Rs. ${newSellingPrice.toFixed(2)} (${pricingMode} mode)`;
    } else if (Math.abs(unitCost - previousCost) > 0.001) {
      historyReason += ` | Cost changed from Rs. ${previousCost.toFixed(2)} to Rs. ${unitCost.toFixed(2)} (${costChangePercent > 0 ? '+' : ''}${costChangePercent}%)`;
    }

    db.prepare(`
      INSERT INTO product_price_history (
        product_id, branch_id, old_cost, new_cost, cost_change_percent,
        old_selling_price, new_selling_price, price_change_percent,
        pricing_mode, reason, purchase_id, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      productId, branchId, previousCost, unitCost, costChangePercent,
      oldSellingPrice, newSellingPrice, priceChangePercent,
      pricingMode, historyReason, purchaseId, userId
    );

    return {
      batch_id: batchId,
      batch_number: finalBatchNumber,
      previous_cost: previousCost,
      new_cost: unitCost,
      cost_change_percent: costChangePercent,
      weighted_avg_cost: weightedAvgCost,
      selling_price_updated: sellingPriceUpdated,
      old_selling_price: oldSellingPrice,
      new_selling_price: newSellingPrice,
    };
  }

  /**
   * Consume stock for a Sale using FIFO or Weighted Average Costing
   */
  public static consumeStockForSale(
    productId: number,
    branchId: number,
    quantityNeeded: number,
    saleId: number,
    preferredMethod: string = 'FIFO'
  ): BatchConsumptionResult {
    let remainingToFulfill = quantityNeeded;
    let totalCogs = 0.0;
    const consumedBatches: Array<{
      batch_id: number;
      batch_number: string;
      quantity: number;
      unit_cost: number;
      line_cogs: number;
    }> = [];

    // Prioritize active batches at the selling branch first
    let activeBatches = db.prepare(`
      SELECT id, batch_number, unit_cost, remaining_quantity
      FROM inventory_batches
      WHERE product_id = ? AND branch_id = ? AND remaining_quantity > 0
      ORDER BY received_date ASC, id ASC
    `).all(productId, branchId) as any[];

    // If branch batches alone cannot satisfy demand, draw from other branches as fallback
    if (activeBatches.length === 0) {
      activeBatches = db.prepare(`
        SELECT id, batch_number, unit_cost, remaining_quantity
        FROM inventory_batches
        WHERE product_id = ? AND remaining_quantity > 0
        ORDER BY received_date ASC, id ASC
      `).all(productId) as any[];
    }

    const totalBatchStock = activeBatches.reduce((sum, b) => sum + Number(b.remaining_quantity || 0), 0);
    if (quantityNeeded > totalBatchStock) {
      const settingRow = db.prepare("SELECT value FROM settings WHERE key = 'allow_negative_stock'").get() as any;
      const allowNegative = settingRow ? settingRow.value === 'true' || settingRow.value === '1' : false;

      if (!allowNegative) {
        throw new Error(
          `Insufficient batch stock for product #${productId}. Required: ${quantityNeeded}, Available: ${totalBatchStock}. Negative stock is disallowed.`
        );
      }
    }

    const updateBatchRemaining = db.prepare(`
      UPDATE inventory_batches SET remaining_quantity = ?, updated_at = datetime('now') WHERE id = ?
    `);

    const insertBatchTx = db.prepare(`
      INSERT INTO inventory_batch_transactions (
        batch_id, transaction_type, reference_type, reference_id,
        quantity, unit_cost, remaining_quantity_after
      ) VALUES (?, 'SALE', 'INVOICE', ?, ?, ?, ?)
    `);

    for (const batch of activeBatches) {
      if (remainingToFulfill <= 0) break;

      const availableInBatch = Number(batch.remaining_quantity);
      const deductQty = Math.min(availableInBatch, remainingToFulfill);
      const batchCost = Number(batch.unit_cost);
      const lineCogs = Math.round(deductQty * batchCost * 100) / 100;
      const newRemaining = Math.max(0, availableInBatch - deductQty);

      updateBatchRemaining.run(newRemaining, batch.id);
      insertBatchTx.run(batch.id, saleId, -deductQty, batchCost, newRemaining);

      totalCogs += lineCogs;
      remainingToFulfill -= deductQty;

      consumedBatches.push({
        batch_id: Number(batch.id),
        batch_number: String(batch.batch_number),
        quantity: deductQty,
        unit_cost: batchCost,
        line_cogs: lineCogs,
      });
    }

    // If all historical batches were depleted (or pre-batch legacy stock sold)
    if (remainingToFulfill > 0) {
      // Check negative stock setting
      const settingRow = db.prepare("SELECT value FROM settings WHERE key = 'allow_negative_stock'").get() as any;
      const allowNegative = settingRow ? settingRow.value === 'true' || settingRow.value === '1' : false;

      if (!allowNegative) {
        throw new Error(`Insufficient batch stock for product #${productId}. Shortage: ${remainingToFulfill} units. Negative stock is disallowed.`);
      }

      const prod = db.prepare(`SELECT purchase_price, weighted_avg_cost FROM products WHERE id = ?`).get(productId) as any;
      const fallbackCost = Number(prod?.purchase_price || prod?.weighted_avg_cost || 0);
      const fallbackLineCogs = Math.round(remainingToFulfill * fallbackCost * 100) / 100;
      totalCogs += fallbackLineCogs;

      consumedBatches.push({
        batch_id: 0,
        batch_number: 'FALLBACK_STANDARD_COST',
        quantity: remainingToFulfill,
        unit_cost: fallbackCost,
        line_cogs: fallbackLineCogs,
      });
    }

    const effectiveUnitCost = quantityNeeded > 0
      ? Math.round((totalCogs / quantityNeeded) * 100) / 100
      : 0.0;

    return {
      cogs: Math.round(totalCogs * 100) / 100,
      effective_unit_cost: effectiveUnitCost,
      consumed_batches: consumedBatches,
      costing_method: preferredMethod,
    };
  }

  /**
   * Calculate true batch-based inventory valuation
   * SUM(inventory_batches.remaining_quantity * inventory_batches.unit_cost)
   */
  public static calculateInventoryValuation(filter?: {
    branch_id?: number;
    category_id?: number;
    product_id?: number;
    status?: string;
  }): {
    total_units: number;
    total_cost_value: number;
    total_retail_value: number;
    total_items: number;
  } {
    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (filter?.status) {
      whereClause += " AND p.status = ?";
      params.push(filter.status);
    } else {
      whereClause += " AND p.status != 'discontinued'";
    }

    if (filter?.category_id) {
      whereClause += " AND p.category_id = ?";
      params.push(filter.category_id);
    }

    if (filter?.product_id) {
      whereClause += " AND p.id = ?";
      params.push(filter.product_id);
    }

    // Get all matching products
    const products = db.prepare(`
      SELECT p.id, p.name, p.current_stock, p.purchase_price, p.selling_price
      FROM products p
      ${whereClause}
    `).all(...params) as any[];

    let totalUnits = 0;
    let totalCostVal = 0;
    let totalRetailVal = 0;

    const batchQuery = filter?.branch_id
      ? db.prepare(`
          SELECT remaining_quantity, unit_cost 
          FROM inventory_batches 
          WHERE product_id = ? AND branch_id = ? AND remaining_quantity > 0
        `)
      : db.prepare(`
          SELECT remaining_quantity, unit_cost 
          FROM inventory_batches 
          WHERE product_id = ? AND remaining_quantity > 0
        `);

    for (const prod of products) {
      let stock = Number(prod.current_stock) || 0;
      if (filter?.branch_id) {
        const bs = db.prepare('SELECT current_stock FROM branch_stocks WHERE branch_id = ? AND product_id = ?')
          .get(filter.branch_id, prod.id) as any;
        stock = Number(bs?.current_stock) || 0;
      }

      totalUnits += stock;
      totalRetailVal += stock * (Number(prod.selling_price) || 0);

      // Fetch active batches for this product
      const batches = filter?.branch_id
        ? (batchQuery.all(prod.id, filter.branch_id) as any[])
        : (batchQuery.all(prod.id) as any[]);

      let prodBatchQty = 0;
      let prodBatchCostVal = 0;

      for (const b of batches) {
        const bQty = Number(b.remaining_quantity) || 0;
        const bCost = Number(b.unit_cost) || 0;
        prodBatchQty += bQty;
        prodBatchCostVal += bQty * bCost;
      }

      if (batches.length > 0) {
        totalCostVal += prodBatchCostVal;
        // If actual stock exceeds batch sum (e.g. unbatched legacy stock), value remainder at product standard cost
        if (stock > prodBatchQty) {
          const unbatchedQty = stock - prodBatchQty;
          totalCostVal += unbatchedQty * (Number(prod.purchase_price) || 0);
        }
      } else {
        // Fallback for items with no batches yet
        totalCostVal += stock * (Number(prod.purchase_price) || 0);
      }
    }

    return {
      total_units: Math.round(totalUnits * 100) / 100,
      total_cost_value: Math.round(totalCostVal * 100) / 100,
      total_retail_value: Math.round(totalRetailVal * 100) / 100,
      total_items: products.length,
    };
  }

  /**
   * Restore stock on Sales Return preserving the original cost basis
   * Reverses sale batch consumption (LIFO reversal) or creates dedicated return lot
   */
  public static restoreStockForReturn(
    productId: number,
    branchId: number,
    returnedQty: number,
    returnId: number,
    fallbackUnitCost: number,
    saleId?: number
  ): { restoredToBatches: Array<{ batch_id: number; quantity: number; unit_cost: number }> } {
    let remainingToRestore = returnedQty;
    const restoredToBatches: Array<{ batch_id: number; quantity: number; unit_cost: number }> = [];

    // 1. If saleId is available, find original batches consumed by that sale for this product
    if (saleId) {
      const consumedTxs = db.prepare(`
        SELECT 
          ibt.id as tx_id,
          ibt.batch_id,
          ibt.unit_cost,
          ABS(ibt.quantity) as original_consumed_qty,
          ib.batch_number,
          ib.remaining_quantity
        FROM inventory_batch_transactions ibt
        JOIN inventory_batches ib ON ibt.batch_id = ib.id
        WHERE ibt.transaction_type = 'SALE'
          AND ibt.reference_type = 'INVOICE'
          AND ibt.reference_id = ?
          AND ib.product_id = ?
        ORDER BY ibt.id DESC
      `).all(saleId, productId) as any[];

      for (const ctx of consumedTxs) {
        if (remainingToRestore <= 0) break;

        // Check how much has already been restored to this batch for this sale
        const alreadyRestored = (db.prepare(`
          SELECT COALESCE(SUM(quantity), 0) as restored
          FROM inventory_batch_transactions
          WHERE transaction_type = 'SALE_RETURN'
            AND reference_type = 'RETURN_NOTE'
            AND reference_id IN (SELECT id FROM sales_returns WHERE sale_id = ?)
            AND batch_id = ?
        `).get(saleId, ctx.batch_id) as any)?.restored || 0;

        const maxRestorableToBatch = Math.max(0, Number(ctx.original_consumed_qty) - Number(alreadyRestored));
        if (maxRestorableToBatch <= 0) continue;

        const restoreQty = Math.min(remainingToRestore, maxRestorableToBatch);
        const newBatchRemaining = Number(ctx.remaining_quantity) + restoreQty;

        // Restore to the original consumed batch
        db.prepare(`
          UPDATE inventory_batches 
          SET remaining_quantity = ?, updated_at = datetime('now') 
          WHERE id = ?
        `).run(newBatchRemaining, ctx.batch_id);

        // Record the return transaction with original cost
        db.prepare(`
          INSERT INTO inventory_batch_transactions (
            batch_id, transaction_type, reference_type, reference_id,
            quantity, unit_cost, remaining_quantity_after
          ) VALUES (?, 'SALE_RETURN', 'RETURN_NOTE', ?, ?, ?, ?)
        `).run(ctx.batch_id, returnId, restoreQty, ctx.unit_cost, newBatchRemaining);

        restoredToBatches.push({
          batch_id: ctx.batch_id,
          quantity: restoreQty,
          unit_cost: ctx.unit_cost,
        });

        remainingToRestore -= restoreQty;
      }
    }

    // 2. If remaining quantity could not be matched to a consumed batch, create a dedicated return lot
    if (remainingToRestore > 0) {
      const returnBatchNumber = `BATCH-RET-${saleId || Date.now()}-${productId}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
      const insert = db.prepare(`
        INSERT INTO inventory_batches (
          product_id, branch_id, batch_number, unit_cost, initial_quantity, remaining_quantity, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        productId,
        branchId,
        returnBatchNumber,
        fallbackUnitCost,
        remainingToRestore,
        remainingToRestore,
        `Dedicated return lot for Sales Return #${returnId} (Sale #${saleId || 'N/A'})`
      );

      const bId = Number(insert.lastInsertRowid);
      db.prepare(`
        INSERT INTO inventory_batch_transactions (
          batch_id, transaction_type, reference_type, reference_id,
          quantity, unit_cost, remaining_quantity_after
        ) VALUES (?, 'SALE_RETURN', 'RETURN_NOTE', ?, ?, ?, ?)
      `).run(bId, returnId, remainingToRestore, fallbackUnitCost, remainingToRestore);

      restoredToBatches.push({
        batch_id: bId,
        quantity: remainingToRestore,
        unit_cost: fallbackUnitCost,
      });
    }

    return { restoredToBatches };
  }

  /**
   * Batch-aware stock transfer between branches
   * Deducts from source branch batches using FIFO and creates destination batches preserving exact unit costs
   */
  public static transferStockBetweenBranches(
    productId: number,
    fromBranchId: number,
    toBranchId: number,
    quantity: number,
    transferId: number,
    transferNumber: string
  ): Array<{ from_batch_id: number; to_batch_id: number; quantity: number; unit_cost: number }> {
    let remainingToTransfer = quantity;
    const transferLogs: Array<{ from_batch_id: number; to_batch_id: number; quantity: number; unit_cost: number }> = [];

    // 1. Fetch active batches at source branch ordered by FIFO
    const sourceBatches = db.prepare(`
      SELECT id, batch_number, unit_cost, remaining_quantity, purchase_id, supplier_id, expiry_date
      FROM inventory_batches
      WHERE product_id = ? AND branch_id = ? AND remaining_quantity > 0
      ORDER BY received_date ASC, id ASC
    `).all(productId, fromBranchId) as any[];

    for (const src of sourceBatches) {
      if (remainingToTransfer <= 0) break;

      const avail = Number(src.remaining_quantity);
      const deduct = Math.min(avail, remainingToTransfer);
      const newSourceRemaining = avail - deduct;
      const unitCost = Number(src.unit_cost);

      // Deduct from source batch
      db.prepare(`
        UPDATE inventory_batches 
        SET remaining_quantity = ?, updated_at = datetime('now') 
        WHERE id = ?
      `).run(newSourceRemaining, src.id);

      // Record TRANSFER_OUT at source
      db.prepare(`
        INSERT INTO inventory_batch_transactions (
          batch_id, transaction_type, reference_type, reference_id,
          quantity, unit_cost, remaining_quantity_after
        ) VALUES (?, 'TRANSFER_OUT', 'STOCK_TRANSFER', ?, ?, ?, ?)
      `).run(src.id, transferId, -deduct, unitCost, newSourceRemaining);

      // Create matching batch at destination branch preserving original cost
      const destBatchNum = `${src.batch_number}-TRF-${transferId}`;
      const destInsert = db.prepare(`
        INSERT INTO inventory_batches (
          product_id, branch_id, purchase_id, supplier_id, batch_number,
          unit_cost, initial_quantity, remaining_quantity, received_date, expiry_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)
      `).run(
        productId,
        toBranchId,
        src.purchase_id,
        src.supplier_id,
        destBatchNum,
        unitCost,
        deduct,
        deduct,
        src.expiry_date || null,
        `Transferred from Branch #${fromBranchId} via ${transferNumber} (Source Batch #${src.id})`
      );

      const toBatchId = Number(destInsert.lastInsertRowid);

      // Record TRANSFER_IN at destination
      db.prepare(`
        INSERT INTO inventory_batch_transactions (
          batch_id, transaction_type, reference_type, reference_id,
          quantity, unit_cost, remaining_quantity_after
        ) VALUES (?, 'TRANSFER_IN', 'STOCK_TRANSFER', ?, ?, ?, ?)
      `).run(toBatchId, transferId, deduct, unitCost, deduct);

      transferLogs.push({
        from_batch_id: src.id,
        to_batch_id: toBatchId,
        quantity: deduct,
        unit_cost: unitCost,
      });

      remainingToTransfer -= deduct;
    }

    // Fallback if unbatched source stock was transferred
    if (remainingToTransfer > 0) {
      const prod = db.prepare('SELECT purchase_price, supplier_id FROM products WHERE id = ?').get(productId) as any;
      const fallbackCost = Number(prod?.purchase_price) || 0;
      const destBatchNum = `BATCH-TRF-${transferId}-${productId}-${Date.now().toString(36).toUpperCase().slice(-4)}`;

      const destInsert = db.prepare(`
        INSERT INTO inventory_batches (
          product_id, branch_id, purchase_id, supplier_id, batch_number,
          unit_cost, initial_quantity, remaining_quantity, received_date, notes
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, datetime('now'), ?)
      `).run(
        productId,
        toBranchId,
        prod?.supplier_id || null,
        destBatchNum,
        fallbackCost,
        remainingToTransfer,
        remainingToTransfer,
        `Transferred from Branch #${fromBranchId} unbatched inventory via ${transferNumber}`
      );

      const toBatchId = Number(destInsert.lastInsertRowid);

      db.prepare(`
        INSERT INTO inventory_batch_transactions (
          batch_id, transaction_type, reference_type, reference_id,
          quantity, unit_cost, remaining_quantity_after
        ) VALUES (?, 'TRANSFER_IN', 'STOCK_TRANSFER', ?, ?, ?, ?)
      `).run(toBatchId, transferId, remainingToTransfer, fallbackCost, remainingToTransfer);

      transferLogs.push({
        from_batch_id: 0,
        to_batch_id: toBatchId,
        quantity: remainingToTransfer,
        unit_cost: fallbackCost,
      });
    }

    return transferLogs;
  }

  /**
   * Process purchase return: reduces batch quantity, records transaction, preserves FIFO
   */
  public static processPurchaseReturn(
    productId: number,
    purchaseId: number,
    returnedQty: number,
    returnId: number,
    batchId?: number
  ): { batch_id: number; unit_cost: number; remaining_quantity: number; returned_quantity?: number } {
    let targetBatch: any = null;

    if (batchId) {
      targetBatch = db.prepare(`
        SELECT id, batch_number, unit_cost, remaining_quantity 
        FROM inventory_batches 
        WHERE id = ? AND product_id = ?
      `).get(batchId, productId) as any;
    }

    if (!targetBatch) {
      targetBatch = db.prepare(`
        SELECT id, batch_number, unit_cost, remaining_quantity 
        FROM inventory_batches 
        WHERE purchase_id = ? AND product_id = ? AND remaining_quantity >= ?
        ORDER BY id DESC LIMIT 1
      `).get(purchaseId, productId, returnedQty) as any;
    }

    if (!targetBatch) {
      targetBatch = db.prepare(`
        SELECT id, batch_number, unit_cost, remaining_quantity 
        FROM inventory_batches 
        WHERE purchase_id = ? AND product_id = ? AND remaining_quantity > 0
        ORDER BY remaining_quantity DESC LIMIT 1
      `).get(purchaseId, productId) as any;
    }

    if (!targetBatch) {
      throw new Error(`No active inventory batch found for Purchase #${purchaseId} and Product #${productId}.`);
    }

    const availInBatch = Number(targetBatch.remaining_quantity);
    if (returnedQty > availInBatch) {
      throw new Error(
        `Cannot return ${returnedQty} units. Only ${availInBatch} units remaining in purchase batch "${targetBatch.batch_number}".`
      );
    }

    const newRemaining = Math.max(0, Math.round((availInBatch - returnedQty) * 100) / 100);
    const unitCost = Number(targetBatch.unit_cost);

    // Deduct from batch
    db.prepare(`
      UPDATE inventory_batches 
      SET remaining_quantity = ?, updated_at = datetime('now') 
      WHERE id = ?
    `).run(newRemaining, targetBatch.id);

    // Record batch transaction
    db.prepare(`
      INSERT INTO inventory_batch_transactions (
        batch_id, transaction_type, reference_type, reference_id,
        quantity, unit_cost, remaining_quantity_after
      ) VALUES (?, 'PURCHASE_RETURN', 'PURCHASE_RETURN', ?, ?, ?, ?)
    `).run(targetBatch.id, returnId, -returnedQty, unitCost, newRemaining);

    // Recalculate weighted average cost
    const remainingBatches = db.prepare(`
      SELECT remaining_quantity, unit_cost 
      FROM inventory_batches 
      WHERE product_id = ? AND remaining_quantity > 0
    `).all(productId) as any[];

    let totalVal = 0;
    let totalQty = 0;
    for (const b of remainingBatches) {
      totalVal += Number(b.remaining_quantity) * Number(b.unit_cost);
      totalQty += Number(b.remaining_quantity);
    }
    const newWeightedAvg = totalQty > 0 ? Math.round((totalVal / totalQty) * 100) / 100 : unitCost;
    db.prepare(`UPDATE products SET weighted_avg_cost = ? WHERE id = ?`).run(newWeightedAvg, productId);

    return {
      batch_id: targetBatch.id,
      unit_cost: unitCost,
      remaining_quantity: newRemaining,
      returned_quantity: returnedQty,
    };
  }
}
