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
    const sPrice = Number(selling_price) || 0;
    const wPrice = Number(wholesale_price) || sPrice;
    const stock = Number(current_stock) || 0;
    const minStock = Number(minimum_stock) || 5;

    const insert = db.prepare(`
      INSERT INTO products (
        sku, barcode, name, category_id, subcategory_id, brand, description,
        unit, purchase_price, selling_price, wholesale_price,
        current_stock, minimum_stock, supplier_id, image_url, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      sPrice,
      wPrice,
      stock,
      minStock,
      supplier_id ? Number(supplier_id) : null,
      image_url?.trim() || null,
      status
    );

    const productId = Number(info.lastInsertRowid);

    // If initial stock is greater than 0, record OPENING_STOCK inventory transaction
    if (stock > 0) {
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
    `).run(session.userId, productId, `Added product: ${name} (SKU: ${sku}, Stock: ${stock} ${unit})`);

    return res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      data: { id: productId, name, sku, current_stock: stock },
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
        selling_price = ?,
        wholesale_price = ?,
        minimum_stock = ?,
        supplier_id = ?,
        image_url = ?,
        status = ?,
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
      Number(purchase_price) || 0,
      Number(selling_price) || 0,
      Number(wholesale_price) || 0,
      Number(minimum_stock) || 5,
      supplier_id ? Number(supplier_id) : null,
      image_url?.trim() || null,
      status || existing.status,
      id
    );

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, module, record_id, details)
      VALUES (?, 'UPDATE_PRODUCT', 'Products', ?, ?)
    `).run(session.userId, id, `Updated product: ${name} (SKU: ${sku})`);

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
