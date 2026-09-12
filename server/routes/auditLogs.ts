import { Router, Request, Response } from 'express';
import { db } from '../db/database.js';

export const auditLogsRouter = Router();

// GET /api/audit-logs
auditLogsRouter.get('/', (req: Request, res: Response): any => {
  try {
    const {
      search = '',
      module = 'all',
      action = 'all',
      limit = '100',
    } = req.query;

    let query = `
      SELECT 
        a.id,
        a.user_id,
        u.name as user_name,
        u.username,
        a.action,
        a.module,
        a.record_id,
        a.details,
        a.ip_address,
        a.created_at
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (search) {
      query += ` AND (a.action LIKE ? OR a.module LIKE ? OR a.details LIKE ? OR u.name LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (module !== 'all' && module) {
      query += ` AND a.module = ?`;
      params.push(module);
    }

    if (action !== 'all' && action) {
      query += ` AND a.action = ?`;
      params.push(action);
    }

    query += ` ORDER BY a.id DESC LIMIT ?`;
    params.push(Number(limit) || 100);

    const logs = db.prepare(query).all(...params);

    const totalCount = db.prepare(`SELECT COUNT(*) as count FROM audit_logs`).get() as any;

    return res.json({
      success: true,
      data: logs,
      total: totalCount?.count || 0,
    });
  } catch (err: any) {
    console.error('Error fetching audit logs:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch audit logs: ' + err.message });
  }
});
