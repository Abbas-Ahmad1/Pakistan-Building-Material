import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { verifySession } from './auth.js';

export const productsRouter = Router();

// GET /api/products - list and filter products
productsRouter.get('/', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);
    const isAdmin = session?.role === 'ADMIN';

    const {
      search = '',
      category_id,
      subcategory_id,
      status = 'all',
      stock_status = 'all',
      brand = '',
      limit = '100',
      offset = '0',
    } = req.query;

    let query = `
      SELECT 
        p.id,
        p.sku,
        p.barcode,
        p.name,
        p.category_id,
        c.name as category_name,
        p.subcategory_id,
        sub.name as subcategory_name,
        p.brand,
        p.description,
        p.unit,
        ${isAdmin ? 'p.purchase_price,' : '0 as purchase_price,'}
        p.previous_cost,
        p.cost_change_percent,
        p.pricing_mode,
        p.markup_percentage,
        p.margin_percentage,
        p.auto_price_update,
        p.last_cost_update,
        p.weighted_avg_cost,
        p.selling_price,
        p.wholesale_price,
        p.current_stock,
        p.minimum_stock,
        p.supplier_id,
        s.name as supplier_name,
        p.image_url,
        p.status,
        p.created_at,
        p.updated_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN subcategories sub ON p.subcategory_id = sub.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE 1=1
    `;

    const params: any[] = [];

    // Search term
    if (search && typeof search === 'string' && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      query += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.brand LIKE ?)`;
      params.push(term, term, term, term);
    }

    // Category
    if (category_id && category_id !== 'all') {
      query += ` AND p.category_id = ?`;
      params.push(Number(category_id));
    }

    // Subcategory
    if (subcategory_id && subcategory_id !== 'all') {
      query += ` AND p.subcategory_id = ?`;
      params.push(Number(subcategory_id));
    }

    // Brand
    if (brand && typeof brand === 'string' && brand.trim() !== '' && brand !== 'all') {
      query += ` AND p.brand = ?`;
      params.push(brand.trim());
    }

    // Status
    if (status && status !== 'all') {
      query += ` AND p.status = ?`;
      params.push(status);
    } else {
      // Default: don't show discontinued unless explicitly queried
      query += ` AND p.status != 'discontinued'`;
    }

    // Stock Status
    if (stock_status === 'low') {
      query += ` AND p.current_stock > 0 AND p.current_stock <= p.minimum_stock`;
    } else if (stock_status === 'out') {
      query += ` AND p.current_stock <= 0`;
    } else if (stock_status === 'in_stock') {
      query += ` AND p.current_stock > p.minimum_stock`;
    }

    query += ` ORDER BY p.name ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit) || 100, Number(offset) || 0);

    const products = db.prepare(query).all(...params);

    return res.json({ success: true, data: products });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve products.' });
  }
});

// GET /api/products/brands - distinct brands list for filtering
productsRouter.get('/meta/brands', (req: Request, res: Response): any => {
  try {
    const brands = db
      .prepare(`SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND brand != '' ORDER BY brand ASC`)
      .all() as { brand: string }[];
    return res.json({ success: true, data: brands.map((b) => b.brand) });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to get brands.' });
  }
});

// GET /api/products/barcode/:barcode - fast POS lookup
productsRouter.get('/barcode/:barcode', (req: Request, res: Response): any => {
  try {
    const barcode = req.params.barcode.trim();
    const product = db
      .prepare(`
        SELECT 
          p.id,
          p.sku,
          p.barcode,
          p.name,
          p.category_id,
          c.name as category_name,
          p.unit,
          p.selling_price,
          p.wholesale_price,
          p.current_stock,
          p.minimum_stock,
          p.image_url,
          p.status
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.barcode = ? OR p.sku = ?
        LIMIT 1
      `)
      .get(barcode, barcode);

    if (!product) {
      return res.status(404).json({ success: false, message: `No product found matching barcode/SKU "${barcode}".` });
    }

    return res.json({ success: true, data: product });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Barcode search failed.' });
  }
});

// GET /api/products/:id - single product with stock history
productsRouter.get('/:id', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);
    const isAdmin = session?.role === 'ADMIN';

    const id = Number(req.params.id);
    const product = db
      .prepare(`
        SELECT 
          p.*,
          c.name as category_name,
          sub.name as subcategory_name,
          s.name as supplier_name,
          ${isAdmin ? 'p.purchase_price' : '0'} as purchase_price
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN subcategories sub ON p.subcategory_id = sub.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE p.id = ?
      `)
      .get(id) as any;

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Get recent stock transactions
    let transactions: any[] = [];
    if (isAdmin) {
      transactions = db
        .prepare(`
          SELECT 
            it.*,
            u.name as user_name
          FROM inventory_transactions it
          LEFT JOIN users u ON it.created_by = u.id
          WHERE it.product_id = ?
          ORDER BY it.created_at DESC
          LIMIT 20
        `)
        .all(id);
    }

    return res.json({ success: true, data: { ...product, transactions } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve product details.' });
  }
});

// GET /api/products/:id/price-history - audit log of cost and selling price changes
productsRouter.get('/:id/price-history', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);
    const isAdmin = session?.role === 'ADMIN';

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin access required to view price history.' });
    }

    const id = Number(req.params.id);
    const history = db
      .prepare(`
        SELECT 
          pph.*,
          u.name as user_name,
          p.name as product_name,
          p.sku as product_sku,
          b.name as branch_name,
          po.purchase_number
        FROM product_price_history pph
        LEFT JOIN users u ON pph.user_id = u.id
        LEFT JOIN products p ON pph.product_id = p.id
        LEFT JOIN branches b ON pph.branch_id = b.id
        LEFT JOIN purchases po ON pph.purchase_id = po.id
        WHERE pph.product_id = ?
        ORDER BY pph.created_at DESC, pph.id DESC
      `)
      .all(id);

    return res.json({ success: true, data: history });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve price history.' });
  }
});

// GET /api/products/:id/batches - list of inventory stock batches with remaining quantities and costs
productsRouter.get('/:id/batches', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);
    const isAdmin = session?.role === 'ADMIN';

    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Admin access required to view inventory batches.' });
    }

    const id = Number(req.params.id);
    const batches = db
      .prepare(`
        SELECT 
          ib.*,
          b.name as branch_name,
          s.name as supplier_name,
          s.company as supplier_company,
          po.purchase_number
        FROM inventory_batches ib
        LEFT JOIN branches b ON ib.branch_id = b.id
        LEFT JOIN suppliers s ON ib.supplier_id = s.id
        LEFT JOIN purchases po ON ib.purchase_id = po.id
        WHERE ib.product_id = ?
        ORDER BY ib.remaining_quantity > 0 DESC, ib.received_date ASC, ib.id ASC
      `)
      .all(id);

    return res.json({ success: true, data: batches });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve batches.' });
  }
});

// POST /api/products/bulk-price-update - update catalog selling prices dynamically
productsRouter.post('/bulk-price-update', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin privileges required for bulk price updates.' });
    }

    const {
      product_ids,
      category_id,
      supplier_id,
      action_type = 'RECALCULATE_FROM_COST',
      adjustment_value = 0,
      round_to = 0,
      reason = 'Bulk Price Adjustment',
    } = req.body;

    let targetProducts: any[] = [];

    if (Array.isArray(product_ids) && product_ids.length > 0) {
      const placeholders = product_ids.map(() => '?').join(',');
      targetProducts = db
        .prepare(`SELECT * FROM products WHERE id IN (${placeholders}) AND status = 'active'`)
        .all(...product_ids) as any[];
    } else if (category_id) {
      targetProducts = db
        .prepare(`SELECT * FROM products WHERE category_id = ? AND status = 'active'`)
        .all(category_id) as any[];
    } else if (supplier_id) {
      targetProducts = db
        .prepare(`SELECT * FROM products WHERE supplier_id = ? AND status = 'active'`)
        .all(supplier_id) as any[];
    } else {
      targetProducts = db
        .prepare(`SELECT * FROM products WHERE status = 'active'`)
        .all() as any[];
    }

    if (targetProducts.length === 0) {
      return res.status(404).json({ success: false, message: 'No matching active products found for price update.' });
    }

    db.exec('BEGIN');
    const updateStmt = db.prepare(`UPDATE products SET selling_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
    const historyStmt = db.prepare(`
      INSERT INTO product_price_history (
        product_id, branch_id, old_cost, new_cost, cost_change_percent,
        old_selling_price, new_selling_price, price_change_percent,
        pricing_mode, reason, user_id
      ) VALUES (?, 1, ?, ?, 0, ?, ?, ?, ?, ?, ?)
    `);

    let updatedCount = 0;

    for (const p of targetProducts) {
      const oldPrice = Number(p.selling_price) || 0;
      const cost = Number(p.purchase_price) || 0;
      let newPrice = oldPrice;

      if (action_type === 'RECALCULATE_FROM_COST') {
        const mode = p.pricing_mode || 'FIXED';
        const markup = Number(p.markup_percentage) || 0;
        const margin = Number(p.margin_percentage) || 0;

        if (mode === 'MARKUP' && markup > 0) {
          newPrice = Math.round(cost * (1 + (markup / 100)) * 100) / 100;
        } else if (mode === 'MARGIN' && margin > 0 && margin < 100) {
          newPrice = Math.round((cost / (1 - (margin / 100))) * 100) / 100;
        }
      } else if (action_type === 'PERCENTAGE_INCREASE') {
        newPrice = Math.round(oldPrice * (1 + (adjustment_value / 100)) * 100) / 100;
      } else if (action_type === 'PERCENTAGE_DECREASE') {
        newPrice = Math.round(oldPrice * (1 - (adjustment_value / 100)) * 100) / 100;
      } else if (action_type === 'FIXED_AMOUNT_ADD') {
        newPrice = Math.round((oldPrice + adjustment_value) * 100) / 100;
      }

      if (round_to > 0) {
        newPrice = Math.round(newPrice / round_to) * round_to;
      }

      if (newPrice > 0 && Math.abs(newPrice - oldPrice) > 0.001) {
        const changePercent = oldPrice > 0 ? Math.round(((newPrice - oldPrice) / oldPrice) * 10000) / 100 : 0;
        updateStmt.run(newPrice, p.id);
        historyStmt.run(
          p.id, cost, cost, oldPrice, newPrice, changePercent,
          p.pricing_mode || 'FIXED', `${reason} (${action_type})`, session.userId
        );
        updatedCount++;
      }
    }

    db.exec('COMMIT');

    return res.json({
      success: true,
      message: `Bulk price update completed. ${updatedCount} products adjusted.`,
      updated_count: updatedCount,
      total_considered: targetProducts.length,
    });
  } catch (error: any) {
    db.exec('ROLLBACK');
    return res.status(500).json({ success: false, message: error.message || 'Failed to complete bulk price update.' });
  }
});

// POST /api/products - create product (ADMIN only)
productsRouter.post('/', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin privileges required to create products.' });
    }

    const {
      sku,
      barcode,
      name,
      category_id,
      subcategory_id,
      brand,
      description,
      unit,
      purchase_price,
      selling_price,
      wholesale_price,
      current_stock,
      minimum_stock,
      supplier_id,
      image_url,
      status = 'active',
      pricing_mode = 'FIXED',
      markup_percentage = 0,
      margin_percentage = 0,
      auto_price_update = 0,
    } = req.body;

    // Validations
    if (!name || !sku || !category_id || !unit) {
      return res.status(400).json({
        success: false,
        message: 'Product name, unique SKU, category, and unit of measure are required.',
      });
    }

    // Verify unique SKU
    const existingSku = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku.trim()) as any;
    if (existingSku) {
      return res.status(400).json({ success: false, message: `SKU "${sku}" is already assigned to another product.` });
    }

    // Verify unique Barcode if provided
    if (barcode && barcode.trim() !== '') {
      const existingBarcode = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode.trim()) as any;
      if (existingBarcode) {
        return res.status(400).json({ success: false, message: `Barcode "${barcode}" is already assigned to another product.` });
      }
    }

    const pPrice = Number(purchase_price) || 0;
    let sPrice = Number(selling_price) || 0;
    const markup = Number(markup_percentage) || 0;
    const margin = Number(margin_percentage) || 0;
    const autoUpdate = auto_price_update ? 1 : 0;

    // Auto calculate initial selling price if configured
    if (autoUpdate) {
      if (pricing_mode === 'MARKUP' && markup > 0) {
        sPrice = Math.round(pPrice * (1 + (markup / 100)) * 100) / 100;
      } else if (pricing_mode === 'MARGIN' && margin > 0 && margin < 100) {
        sPrice = Math.round((pPrice / (1 - (margin / 100))) * 100) / 100;
      }
    }

    const wPrice = Number(wholesale_price) || sPrice;
    const stock = Number(current_stock) || 0;
    const minStock = Number(minimum_stock) || 5;

    const insert = db.prepare(`
      INSERT INTO products (
        sku, barcode, name, category_id, subcategory_id, brand, description,
        unit, purchase_price, previous_cost, cost_change_percent, weighted_avg_cost,
        selling_price, wholesale_price, pricing_mode, markup_percentage, margin_percentage, auto_price_update,
        current_stock, minimum_stock, supplier_id, image_url, status, last_cost_update
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const info = insert.run(
      sku.trim(),
      barcode?.trim() || null,
      name.trim(),
      Number(category_id),
      subcategory_id ? Number(subcategory_id) : null,
      brand?.trim() || null,
      description?.trim() || null,
      unit.trim(),
      pPrice,
      pPrice,
      pPrice,
      sPrice,
      wPrice,
      pricing_mode,
      markup,
      margin,
      autoUpdate,
      stock,
      minStock,
      supplier_id ? Number(supplier_id) : null,
      image_url?.trim() || null,
      status
    );

    const productId = Number(info.lastInsertRowid);

    // Initial price history record
    db.prepare(`
      INSERT INTO product_price_history (
        product_id, branch_id, old_cost, new_cost, cost_change_percent,
        old_selling_price, new_selling_price, price_change_percent,
        pricing_mode, reason, user_id
      ) VALUES (?, 1, 0, ?, 0, 0, ?, 0, ?, 'Initial product setup', ?)
    `).run(productId, pPrice, sPrice, pricing_mode, session.userId);

    // If initial stock is greater than 0, create opening batch and transaction
    if (stock > 0) {
      const batchNum = `BATCH-INIT-1-${productId}`;
      db.prepare(`
        INSERT INTO inventory_batches (
          product_id, branch_id, supplier_id, batch_number, unit_cost, initial_quantity, remaining_quantity, notes
        ) VALUES (?, 1, ?, ?, ?, ?, ?, 'Opening stock batch')
      `).run(productId, supplier_id ? Number(supplier_id) : null, batchNum, pPrice, stock, stock);

      db.prepare(`
        INSERT INTO inventory_transactions (
          product_id, transaction_type, reference_type, reference_id,
          quantity, unit_cost, stock_before, stock_after, notes, created_by
        ) VALUES (?, 'OPENING_STOCK', 'PRODUCT_SETUP', ?, ?, ?, 0, ?, 'Initial inventory stock on product creation', ?)
      `).run(productId, productId, stock, pPrice, stock, session.userId);
    }

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, module, record_id, details)
      VALUES (?, 'CREATE_PRODUCT', 'Products', ?, ?)
    `).run(session.userId, productId, `Added product: ${name} (SKU: ${sku}, Stock: ${stock} ${unit}, Price: Rs. ${sPrice})`);

    return res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      data: { id: productId, name, sku, current_stock: stock, selling_price: sPrice },
    });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create product.' });
  }
});

// PUT /api/products/:id - update product (ADMIN only)
productsRouter.put('/:id', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin privileges required to update products.' });
    }

    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const {
      sku,
      barcode,
      name,
      category_id,
      subcategory_id,
      brand,
      description,
      unit,
      purchase_price,
      selling_price,
      wholesale_price,
      minimum_stock,
      supplier_id,
      image_url,
      status,
      pricing_mode,
      markup_percentage,
      margin_percentage,
      auto_price_update,
    } = req.body;

    if (!name || !sku || !category_id || !unit) {
      return res.status(400).json({ success: false, message: 'Name, SKU, category, and unit are required.' });
    }

    // Unique SKU check
    const skuConflict = db.prepare('SELECT id FROM products WHERE sku = ? AND id != ?').get(sku.trim(), id) as any;
    if (skuConflict) {
      return res.status(400).json({ success: false, message: `SKU "${sku}" is used by another product.` });
    }

    // Unique Barcode check
    if (barcode && barcode.trim() !== '') {
      const barcodeConflict = db.prepare('SELECT id FROM products WHERE barcode = ? AND id != ?').get(barcode.trim(), id) as any;
      if (barcodeConflict) {
        return res.status(400).json({ success: false, message: `Barcode "${barcode}" is used by another product.` });
      }
    }

    const oldCost = Number(existing.purchase_price) || 0;
    const newCost = purchase_price !== undefined ? Number(purchase_price) : oldCost;
    const oldPrice = Number(existing.selling_price) || 0;
    let newPrice = selling_price !== undefined ? Number(selling_price) : oldPrice;

    const finalPricingMode = pricing_mode || existing.pricing_mode || 'FIXED';
    const finalMarkup = markup_percentage !== undefined ? Number(markup_percentage) : (Number(existing.markup_percentage) || 0);
    const finalMargin = margin_percentage !== undefined ? Number(margin_percentage) : (Number(existing.margin_percentage) || 0);
    const finalAutoUpdate = auto_price_update !== undefined ? (auto_price_update ? 1 : 0) : (existing.auto_price_update || 0);

    // If auto price update is toggled or enabled and cost changed
    if (finalAutoUpdate && selling_price === undefined) {
      if (finalPricingMode === 'MARKUP' && finalMarkup > 0) {
        newPrice = Math.round(newCost * (1 + (finalMarkup / 100)) * 100) / 100;
      } else if (finalPricingMode === 'MARGIN' && finalMargin > 0 && finalMargin < 100) {
        newPrice = Math.round((newCost / (1 - (finalMargin / 100))) * 100) / 100;
      }
    }

    const costDiff = Math.abs(newCost - oldCost);
    const priceDiff = Math.abs(newPrice - oldPrice);
    const costChangePct = oldCost > 0 ? Math.round(((newCost - oldCost) / oldCost) * 10000) / 100 : 0;
    const priceChangePct = oldPrice > 0 ? Math.round(((newPrice - oldPrice) / oldPrice) * 10000) / 100 : 0;

    db.prepare(`
      UPDATE products
      SET
        sku = ?,
        barcode = ?,
        name = ?,
        category_id = ?,
        subcategory_id = ?,
        brand = ?,
        description = ?,
        unit = ?,
        purchase_price = ?,
        previous_cost = ?,
        cost_change_percent = ?,
        selling_price = ?,
        wholesale_price = ?,
        minimum_stock = ?,
        supplier_id = ?,
        image_url = ?,
        status = ?,
        pricing_mode = ?,
        markup_percentage = ?,
        margin_percentage = ?,
        auto_price_update = ?,
        last_cost_update = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      sku.trim(),
      barcode?.trim() || null,
      name.trim(),
      Number(category_id),
      subcategory_id ? Number(subcategory_id) : null,
      brand?.trim() || null,
      description?.trim() || null,
      unit.trim(),
      newCost,
      costDiff > 0.001 ? oldCost : (existing.previous_cost || oldCost),
      costDiff > 0.001 ? costChangePct : (existing.cost_change_percent || 0),
      newPrice,
      Number(wholesale_price) || 0,
      Number(minimum_stock) || 5,
      supplier_id ? Number(supplier_id) : null,
      image_url?.trim() || null,
      status || existing.status,
      finalPricingMode,
      finalMarkup,
      finalMargin,
      finalAutoUpdate,
      costDiff > 0.001 ? new Date().toISOString() : existing.last_cost_update,
      id
    );

    // If cost or selling price was modified, record in price history
    if (costDiff > 0.001 || priceDiff > 0.001) {
      let reason = 'Manual product update';
      if (priceDiff > 0.001 && costDiff <= 0.001) {
        reason = `Selling price adjusted from Rs. ${oldPrice.toFixed(2)} to Rs. ${newPrice.toFixed(2)}`;
      } else if (costDiff > 0.001 && priceDiff <= 0.001) {
        reason = `Purchase cost adjusted from Rs. ${oldCost.toFixed(2)} to Rs. ${newCost.toFixed(2)}`;
      } else {
        reason = `Price & cost adjusted (Cost: Rs. ${newCost.toFixed(2)}, Price: Rs. ${newPrice.toFixed(2)})`;
      }

      db.prepare(`
        INSERT INTO product_price_history (
          product_id, branch_id, old_cost, new_cost, cost_change_percent,
          old_selling_price, new_selling_price, price_change_percent,
          pricing_mode, reason, user_id
        ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, oldCost, newCost, costChangePct,
        oldPrice, newPrice, priceChangePct,
        finalPricingMode, reason, session.userId
      );
    }

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, module, record_id, details)
      VALUES (?, 'UPDATE_PRODUCT', 'Products', ?, ?)
    `).run(session.userId, id, `Updated product: ${name} (SKU: ${sku}, Price: Rs. ${newPrice})`);

    return res.json({ success: true, message: 'Product updated successfully.' });
  } catch (error: any) {
    console.error('Error updating product:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update product.' });
  }
});

// DELETE /api/products/:id - soft delete or remove product (ADMIN only)
productsRouter.delete('/:id', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin privileges required to delete products.' });
    }

    const id = Number(req.params.id);
    const existing = db.prepare('SELECT name, sku FROM products WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Check if product has sales transactions
    const saleItemCount = db.prepare('SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?').get(id) as any;
    const purchaseItemCount = db.prepare('SELECT COUNT(*) as count FROM purchase_items WHERE product_id = ?').get(id) as any;

    if (saleItemCount.count > 0 || purchaseItemCount.count > 0) {
      // If linked to financial transactions, soft-delete to preserve ledger integrity
      db.prepare(`UPDATE products SET status = 'discontinued' WHERE id = ?`).run(id);

      db.prepare(`
        INSERT INTO audit_logs (user_id, action, module, record_id, details)
        VALUES (?, 'DISCONTINUE_PRODUCT', 'Products', ?, ?)
      `).run(session.userId, id, `Discontinued product ${existing.name} (has ${saleItemCount.count} sale lines & ${purchaseItemCount.count} purchase lines)`);

      return res.json({
        success: true,
        message: 'Product has historical sales/purchases and has been marked as Discontinued to preserve accounting ledgers.',
      });
    }

    // If completely unlinked, delete cleanly
    db.prepare('DELETE FROM inventory_transactions WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);

    db.prepare(`
      INSERT INTO audit_logs (user_id, action, module, record_id, details)
      VALUES (?, 'DELETE_PRODUCT', 'Products', ?, ?)
    `).run(session.userId, id, `Permanently deleted unused product ${existing.name} (SKU: ${existing.sku})`);

    return res.json({ success: true, message: 'Product deleted permanently.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to delete product.' });
  }
});
