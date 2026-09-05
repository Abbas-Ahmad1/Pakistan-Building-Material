import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { verifySession } from './auth.js';

export const categoriesRouter = Router();

// GET /api/categories - list all categories with subcategories and product counts
categoriesRouter.get('/', (req: Request, res: Response): any => {
  try {
    const categories = db
      .prepare(`
        SELECT 
          c.id, 
          c.name, 
          c.code, 
          c.description, 
          c.created_at,
          COUNT(DISTINCT p.id) as products_count
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id AND p.status != 'discontinued'
        GROUP BY c.id
        ORDER BY c.name ASC
      `)
      .all() as any[];

    const subcategories = db
      .prepare(`
        SELECT 
          s.id, 
          s.category_id, 
          s.name, 
          s.created_at,
          COUNT(DISTINCT p.id) as products_count
        FROM subcategories s
        LEFT JOIN products p ON s.id = p.subcategory_id AND p.status != 'discontinued'
        GROUP BY s.id
        ORDER BY s.name ASC
      `)
      .all() as any[];

    // Group subcategories under categories
    const subMap = new Map<number, any[]>();
    for (const sub of subcategories) {
      if (!subMap.has(sub.category_id)) {
        subMap.set(sub.category_id, []);
      }
      subMap.get(sub.category_id)!.push(sub);
    }

    const result = categories.map((cat) => ({
      ...cat,
      subcategories: subMap.get(cat.id) || [],
    }));

    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve categories.' });
  }
});

// POST /api/categories - create category (ADMIN only)
categoriesRouter.post('/', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin privileges required.' });
    }

    const { name, code, description } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Category name and unique code are required.' });
    }

    // Check code uniqueness
    const existing = db.prepare('SELECT id FROM categories WHERE code = ? OR name = ?').get(code.trim().toUpperCase(), name.trim()) as any;
    if (existing) {
      return res.status(400).json({ success: false, message: 'A category with this name or code already exists.' });
    }

    const insert = db.prepare(`
      INSERT INTO categories (name, code, description)
      VALUES (?, ?, ?)
    `);
    const info = insert.run(name.trim(), code.trim().toUpperCase(), description?.trim() || '');

    db.prepare(`
      INSERT INTO audit_logs (user_id, action, module, record_id, details)
      VALUES (?, 'CREATE_CATEGORY', 'Categories', ?, ?)
    `).run(session.userId, Number(info.lastInsertRowid), `Created category: ${name}`);

    return res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      data: { id: info.lastInsertRowid, name, code: code.toUpperCase(), description },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to create category.' });
  }
});

// PUT /api/categories/:id - update category (ADMIN only)
categoriesRouter.put('/:id', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin privileges required.' });
    }

    const id = Number(req.params.id);
    const { name, code, description } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Category name and code are required.' });
    }

    // Check conflict
    const conflict = db.prepare('SELECT id FROM categories WHERE (code = ? OR name = ?) AND id != ?').get(code.trim().toUpperCase(), name.trim(), id) as any;
    if (conflict) {
      return res.status(400).json({ success: false, message: 'Another category already uses this name or code.' });
    }

    db.prepare(`
      UPDATE categories
      SET name = ?, code = ?, description = ?
      WHERE id = ?
    `).run(name.trim(), code.trim().toUpperCase(), description?.trim() || '', id);

    db.prepare(`
      INSERT INTO audit_logs (user_id, action, module, record_id, details)
      VALUES (?, 'UPDATE_CATEGORY', 'Categories', ?, ?)
    `).run(session.userId, id, `Updated category ${id}: ${name}`);

    return res.json({ success: true, message: 'Category updated successfully.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to update category.' });
  }
});

// DELETE /api/categories/:id - delete category (ADMIN only)
categoriesRouter.delete('/:id', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin privileges required.' });
    }

    const id = Number(req.params.id);

    // Check if products exist in this category
    const productCheck = db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').get(id) as any;
    if (productCheck && productCheck.count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. There are ${productCheck.count} product(s) linked to it. Reassign or delete them first.`,
      });
    }

    db.prepare('DELETE FROM subcategories WHERE category_id = ?').run(id);
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);

    db.prepare(`
      INSERT INTO audit_logs (user_id, action, module, record_id, details)
      VALUES (?, 'DELETE_CATEGORY', 'Categories', ?, ?)
    `).run(session.userId, id, `Deleted category ID: ${id}`);

    return res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to delete category.' });
  }
});

// POST /api/categories/:id/subcategories - create subcategory
categoriesRouter.post('/:id/subcategories', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin privileges required.' });
    }

    const categoryId = Number(req.params.id);
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Subcategory name is required.' });
    }

    const insert = db.prepare('INSERT INTO subcategories (category_id, name) VALUES (?, ?)');
    const info = insert.run(categoryId, name.trim());

    return res.status(201).json({
      success: true,
      message: 'Subcategory added successfully.',
      data: { id: info.lastInsertRowid, category_id: categoryId, name: name.trim() },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to add subcategory.' });
  }
});

// DELETE /api/categories/subcategories/:id - delete subcategory
categoriesRouter.delete('/subcategories/:id', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin privileges required.' });
    }

    const id = Number(req.params.id);
    const productCheck = db.prepare('SELECT COUNT(*) as count FROM products WHERE subcategory_id = ?').get(id) as any;
    if (productCheck && productCheck.count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete subcategory. There are ${productCheck.count} product(s) linked to it.`,
      });
    }

    db.prepare('DELETE FROM subcategories WHERE id = ?').run(id);
    return res.json({ success: true, message: 'Subcategory deleted successfully.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to delete subcategory.' });
  }
});
