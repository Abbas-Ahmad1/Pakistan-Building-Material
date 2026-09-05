import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.js';

export const authRouter = Router();

// In-memory token store mapped to user session
const sessionStore = new Map<string, { userId: number; role: string; expiresAt: number }>();

function generateToken(userId: number, role: string): string {
  const token = `tok_${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  // 7-day session
  sessionStore.set(token, {
    userId,
    role,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

export function verifySession(token?: string) {
  if (!token) return null;
  const session = sessionStore.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessionStore.delete(token);
    return null;
  }
  return session;
}

// POST /api/auth/login
authRouter.post('/login', (req: Request, res: Response): any => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.',
      });
    }

    const user = db
      .prepare(`
        SELECT u.id, u.name, u.username, u.email, u.password_hash, u.status, r.name as role
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.username = ? OR u.email = ?
      `)
      .get(username.trim(), username.trim()) as any;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your username and password.',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is deactivated. Please contact the administrator.',
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your username and password.',
      });
    }

    const token = generateToken(user.id, user.role);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, module, record_id, details)
      VALUES (?, 'LOGIN_SUCCESS', 'Auth', ?, ?)
    `).run(user.id, user.id, `User logged in with role ${user.role}`);

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred while logging in.',
    });
  }
});

// GET /api/auth/me
authRouter.get('/me', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated or session has expired.',
      });
    }

    const user = db
      .prepare(`
        SELECT u.id, u.name, u.username, u.email, u.status, r.name as role
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = ?
      `)
      .get(session.userId) as any;

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'User no longer active.',
      });
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Failed to verify session.',
    });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (req: Request, res: Response): any => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  if (token) {
    const session = sessionStore.get(token);
    if (session) {
      db.prepare(`
        INSERT INTO audit_logs (user_id, action, module, record_id, details)
        VALUES (?, 'LOGOUT', 'Auth', ?, 'User logged out')
      `).run(session.userId, session.userId);
    }
    sessionStore.delete(token);
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/auth/users (ADMIN only)
authRouter.get('/users', (req: Request, res: Response): any => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  const session = verifySession(token);

  if (!session || session.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Access denied. Administrator privileges required.' });
  }

  const users = db
    .prepare(`
      SELECT u.id, u.name, u.username, u.email, u.status, u.created_at, r.name as role
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.id ASC
    `)
    .all();

  return res.json({ success: true, data: users });
});
