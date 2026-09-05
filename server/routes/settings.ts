import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';
import { verifySession } from './auth.js';

export const settingsRouter = Router();

// GET /api/settings
settingsRouter.get('/', (_req: Request, res: Response): any => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settings: Record<string, any> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return res.json({ success: true, data: settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load settings.' });
  }
});

// POST /api/settings (ADMIN only)
settingsRouter.post('/', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    const updates = req.body;
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(updates)) {
      stmt.run(key, String(value));
    }

    db.prepare(`
      INSERT INTO audit_logs (user_id, action, module, record_id, details)
      VALUES (?, 'UPDATE_SETTINGS', 'Settings', NULL, 'Updated store settings')
    `).run(session.userId);

    return res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update settings.' });
  }
});
