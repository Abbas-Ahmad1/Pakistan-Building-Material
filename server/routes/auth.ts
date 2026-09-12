import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database.js';

export const authRouter = Router();

// In-memory token store mapped to user session
export interface SessionData {
  userId: number;
  role: string;
  branchId: number;
  branchName: string;
  branchCode: string;
  expiresAt: number;
}

const sessionStore = new Map<string, SessionData>();

function getBranchInfo(branchId?: number) {
  let branch: any = null;
  if (branchId) {
    branch = db.prepare('SELECT id, name, code FROM branches WHERE id = ?').get(branchId);
  }
  if (!branch) {
    branch = db.prepare('SELECT id, name, code FROM branches WHERE is_main = 1 LIMIT 1').get();
  }
  if (!branch) {
    branch = db.prepare('SELECT id, name, code FROM branches ORDER BY id ASC LIMIT 1').get();
  }
  return branch || { id: 1, name: 'Main Store & Central Warehouse', code: 'BR-01' };
}

function generateToken(userId: number, role: string, branchId?: number): { token: string; branch: { id: number; name: string; code: string } } {
  const token = `tok_${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  const branch = getBranchInfo(branchId);

  // 7-day session
  sessionStore.set(token, {
    userId,
    role,
    branchId: branch.id,
    branchName: branch.name,
    branchCode: branch.code,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });
  return { token, branch };
}

export function verifySession(token?: string): SessionData | null {
  if (!token) return null;
  const session = sessionStore.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessionStore.delete(token);
    return null;
  }
  return session;
}

// GET /api/auth/branches - list active branches for login dropdown
authRouter.get('/branches', (_req: Request, res: Response): any => {
  try {
    const branches = db.prepare(`SELECT id, name, code, address, phone, is_main, status FROM branches WHERE status = 'ACTIVE' ORDER BY is_main DESC, id ASC`).all();
    return res.json({ success: true, data: branches });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch branches.' });
  }
});

// POST /api/auth/login
authRouter.post('/login', (req: Request, res: Response): any => {
  try {
    const { username, password, branch_id } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required.',
      });
    }

    const user = db
      .prepare(`
        SELECT u.id, u.name, u.username, u.email, u.password_hash, u.status, u.branch_id, r.name as role
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.username = ? OR u.email = ?
      `)
      .get(username.trim(), username.trim()) as any;

    if (!user) {
      return res.status(401).json({
        success: false,
        errorType: 'INVALID_USERNAME',
        message: 'Incorrect Username! This username does not exist in the system. Please check your username and try again.',
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        errorType: 'ACCOUNT_DEACTIVATED',
        message: 'Account Deactivated! Your account is currently disabled. Please contact the administrator.',
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        errorType: 'INVALID_PASSWORD',
        message: 'Incorrect Password! The password you entered is incorrect. Please verify and try again.',
      });
    }

    // Determine target branch
    const selectedBranchId = branch_id ? Number(branch_id) : (user.branch_id || 1);
    const { token, branch } = generateToken(user.id, user.role, selectedBranchId);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, module, record_id, details)
      VALUES (?, 'LOGIN_SUCCESS', 'Auth', ?, ?)
    `).run(user.id, user.id, `User logged in with role ${user.role} at Branch: ${branch.name} (${branch.code})`);

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
          branch_id: branch.id,
          branch_name: branch.name,
          branch_code: branch.code,
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

    // Get current branch from session or db
    const branch = getBranchInfo(session.branchId);

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
          branch_id: branch.id,
          branch_name: branch.name,
          branch_code: branch.code,
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

// POST /api/auth/switch-branch
authRouter.post('/switch-branch', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    const { branch_id } = req.body;
    if (!branch_id) {
      return res.status(400).json({ success: false, message: 'Branch ID required.' });
    }

    const branch = getBranchInfo(Number(branch_id));
    session.branchId = branch.id;
    session.branchName = branch.name;
    session.branchCode = branch.code;

    // Update user default branch in DB as well
    db.prepare('UPDATE users SET branch_id = ? WHERE id = ?').run(branch.id, session.userId);

    db.prepare(`
      INSERT INTO audit_logs (user_id, action, module, record_id, details)
      VALUES (?, 'SWITCH_BRANCH', 'Auth', ?, ?)
    `).run(session.userId, branch.id, `User switched terminal to Branch: ${branch.name} (${branch.code})`);

    return res.json({
      success: true,
      message: `Switched active branch to ${branch.name}`,
      data: {
        branch_id: branch.id,
        branch_name: branch.name,
        branch_code: branch.code,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'Failed to switch branch.' });
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

// POST /api/auth/update-credentials (ADMIN only)
authRouter.post('/update-credentials', (req: Request, res: Response): any => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const session = verifySession(token);

    if (!session || session.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied. Administrator privileges required.' });
    }

    const { userId, name, username, email, password } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required.' });
    }

    const existingUser = db.prepare('SELECT id, name, username, email, role_id FROM users WHERE id = ?').get(userId) as any;
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'User not found in database.' });
    }

    // Check if new username is already taken by another account
    if (username && username.trim() !== existingUser.username) {
      const duplicate = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?').get(username.trim(), userId);
      if (duplicate) {
        return res.status(400).json({ success: false, message: `Username "${username}" is already taken by another user.` });
      }
    }

    let passwordHash: string | null = null;
    if (password && typeof password === 'string' && password.trim().length > 0) {
      if (password.trim().length < 4) {
        return res.status(400).json({ success: false, message: 'New password must be at least 4 characters long.' });
      }
      passwordHash = bcrypt.hashSync(password.trim(), 10);
    }

    const newName = name ? name.trim() : existingUser.name;
    const newUsername = username ? username.trim() : existingUser.username;
    const newEmail = email ? email.trim() : existingUser.email;

    if (passwordHash) {
      db.prepare(`
        UPDATE users
        SET name = ?, username = ?, email = ?, password_hash = ?
        WHERE id = ?
      `).run(newName, newUsername, newEmail, passwordHash, userId);
    } else {
      db.prepare(`
        UPDATE users
        SET name = ?, username = ?, email = ?
        WHERE id = ?
      `).run(newName, newUsername, newEmail, userId);
    }

    // Record in audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, module, record_id, details)
      VALUES (?, 'CREDENTIALS_UPDATED', 'Auth', ?, ?)
    `).run(
      session.userId,
      userId,
      `Updated user account (${newUsername}, role_id: ${existingUser.role_id})${passwordHash ? ' with new password' : ''}`
    );

    return res.json({
      success: true,
      message: `Credentials for ${newUsername} updated successfully!`,
      data: {
        id: userId,
        name: newName,
        username: newUsername,
        email: newEmail,
        passwordUpdated: !!passwordHash,
      },
    });
  } catch (error: any) {
    console.error('Update credentials error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'An error occurred while updating user credentials.',
    });
  }
});
