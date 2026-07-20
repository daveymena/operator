/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║          🔐 Authentication System — v4.0                     ║
 * ║   JWT-based auth, API keys, role-based access, sessions     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Configuration ────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.OPERATOR_JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Role Definitions ─────────────────────────────────────────────────────────

export const ROLES = {
  admin: {
    name: 'Administrator',
    permissions: ['tasks:create', 'tasks:read', 'tasks:delete', 'tasks:execute',
      'browser:control', 'terminal:exec', 'files:read', 'files:write',
      'system:info', 'system:control', 'users:manage', 'config:manage',
      'scheduler:manage', 'research:execute', 'plugins:manage']
  },
  user: {
    name: 'User',
    permissions: ['tasks:create', 'tasks:read', 'tasks:execute',
      'browser:control', 'terminal:exec', 'files:read', 'files:write',
      'system:info', 'research:execute']
  },
  viewer: {
    name: 'Viewer',
    permissions: ['tasks:read', 'system:info']
  }
};

// ─── User Store ───────────────────────────────────────────────────────────────

class UserStore {
  constructor() {
    this.users = new Map();
    this.apiKeys = new Map(); // apiKey -> userId
    this.sessions = new Map(); // sessionId -> { userId, expires }
    this.savePath = path.join(__dirname, '..', '..', 'data', 'auth.json');
    this._load();
    this._ensureAdmin();
  }

  _ensureAdmin() {
    // Create default admin if no users exist
    if (this.users.size === 0) {
      const adminKey = process.env.OPERATOR_API_KEY || 'op-admin-' + crypto.randomBytes(16).toString('hex');
      this.createUser({
        username: 'admin',
        role: 'admin',
        apiKey: adminKey
      });
      console.log(`[AUTH] Default admin created. API Key: ${adminKey}`);
      console.log(`[AUTH] Set OPERATOR_API_KEY env var to customize.`);
    }
  }

  createUser({ username, role = 'user', apiKey, password }) {
    const id = crypto.randomUUID();
    const user = {
      id,
      username,
      role,
      apiKey: apiKey || `op-${role}-${crypto.randomBytes(16).toString('hex')}`,
      passwordHash: password ? this._hash(password) : null,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      active: true
    };

    this.users.set(id, user);
    this.apiKeys.set(user.apiKey, id);
    this._save();
    return { id, username, role, apiKey: user.apiKey };
  }

  authenticate(apiKey) {
    const userId = this.apiKeys.get(apiKey);
    if (!userId) return null;

    const user = this.users.get(userId);
    if (!user || !user.active) return null;

    user.lastLogin = new Date().toISOString();
    this._save();
    return { id: user.id, username: user.username, role: user.role };
  }

  authenticatePassword(username, password) {
    for (const user of this.users.values()) {
      if (user.username === username && user.passwordHash === this._hash(password)) {
        user.lastLogin = new Date().toISOString();
        this._save();
        return { id: user.id, username: user.username, role: user.role };
      }
    }
    return null;
  }

  getUser(userId) {
    const user = this.users.get(userId);
    if (!user) return null;
    return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt, lastLogin: user.lastLogin };
  }

  listUsers() {
    return Array.from(this.users.values()).map(u => ({
      id: u.id, username: u.username, role: u.role, active: u.active, lastLogin: u.lastLogin
    }));
  }

  deleteUser(userId) {
    const user = this.users.get(userId);
    if (user) {
      this.apiKeys.delete(user.apiKey);
      this.users.delete(userId);
      this._save();
      return true;
    }
    return false;
  }

  rotateKey(userId) {
    const user = this.users.get(userId);
    if (!user) return null;

    this.apiKeys.delete(user.apiKey);
    user.apiKey = `op-${user.role}-${crypto.randomBytes(16).toString('hex')}`;
    this.apiKeys.set(user.apiKey, userId);
    this._save();
    return user.apiKey;
  }

  hasPermission(userId, permission) {
    const user = this.users.get(userId);
    if (!user) return false;
    const rolePerms = ROLES[user.role]?.permissions || [];
    return rolePerms.includes(permission);
  }

  _hash(text) {
    return crypto.createHash('sha256').update(text + JWT_SECRET).digest('hex');
  }

  _load() {
    try {
      if (fs.existsSync(this.savePath)) {
        const data = JSON.parse(fs.readFileSync(this.savePath, 'utf8'));
        if (data.users) {
          for (const u of Object.values(data.users)) {
            this.users.set(u.id, u);
            if (u.apiKey) this.apiKeys.set(u.apiKey, u.id);
          }
        }
      }
    } catch {}
  }

  _save() {
    try {
      const dir = path.dirname(this.savePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = {
        users: Object.fromEntries(this.users),
      };
      fs.writeFileSync(this.savePath, JSON.stringify(data, null, 2));
    } catch {}
  }
}

// ─── JWT-like Token (simplified, no external deps) ────────────────────────────

class TokenManager {
  constructor() {
    this.tokens = new Map(); // token -> { userId, role, expires, permissions }
  }

  create(userId, role) {
    const token = crypto.randomBytes(32).toString('hex');
    this.tokens.set(token, {
      userId,
      role,
      permissions: ROLES[role]?.permissions || [],
      expires: Date.now() + TOKEN_EXPIRY_MS,
      created: Date.now()
    });
    return token;
  }

  validate(token) {
    const data = this.tokens.get(token);
    if (!data) return null;
    if (Date.now() > data.expires) {
      this.tokens.delete(token);
      return null;
    }
    return data;
  }

  revoke(token) {
    return this.tokens.delete(token);
  }

  clean() {
    const now = Date.now();
    for (const [token, data] of this.tokens) {
      if (now > data.expires) this.tokens.delete(token);
    }
  }
}

// ─── Auth System (Facade) ─────────────────────────────────────────────────────

export class AuthSystem {
  constructor() {
    this.users = new UserStore();
    this.tokens = new TokenManager();

    // Clean expired tokens every hour
    setInterval(() => this.tokens.clean(), 3600000);
  }

  /**
   * Login with API key
   */
  login(apiKey) {
    const user = this.users.authenticate(apiKey);
    if (!user) return { ok: false, error: 'Invalid API key' };

    const token = this.tokens.create(user.id, user.role);
    return {
      ok: true,
      token,
      user: { id: user.id, username: user.username, role: user.role }
    };
  }

  /**
   * Login with username/password
   */
  loginPassword(username, password) {
    const user = this.users.authenticatePassword(username, password);
    if (!user) return { ok: false, error: 'Invalid credentials' };

    const token = this.tokens.create(user.id, user.role);
    return {
      ok: true,
      token,
      user: { id: user.id, username: user.username, role: user.role }
    };
  }

  /**
   * Validate a token and return user info
   */
  validate(token) {
    return this.tokens.validate(token);
  }

  /**
   * Check if a token has a specific permission
   */
  checkPermission(token, permission) {
    const data = this.tokens.validate(token);
    if (!data) return false;
    return data.permissions.includes(permission);
  }

  /**
   * Create a new user
   */
  createUser(params) {
    return this.users.createUser(params);
  }

  /**
   * Revoke a token (logout)
   */
  logout(token) {
    return this.tokens.revoke(token);
  }

  /**
   * Express middleware for authentication
   */
  middleware() {
    return (req, res, next) => {
      // Skip auth for health and public endpoints
      const publicPaths = ['/health', '/api/status', '/dashboard', '/'];
      if (publicPaths.some(p => req.path === p || req.path.startsWith('/dashboard'))) {
        return next();
      }

      // Get token from header or query
      const token = req.headers.authorization?.replace('Bearer ', '') ||
                    req.query.token ||
                    req.headers['x-operator-token'];

      if (!token) {
        return res.status(401).json({ error: 'Authentication required', hint: 'Provide token via Authorization: Bearer <token> or ?token=<token>' });
      }

      const data = this.tokens.validate(token);
      if (!data) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      // Attach user info to request
      req.user = data;
      next();
    };
  }

  /**
   * Permission check middleware factory
   */
  requirePermission(permission) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      if (!req.user.permissions.includes(permission)) {
        return res.status(403).json({ error: `Permission denied: ${permission}` });
      }
      next();
    };
  }
}

// Singleton
let _auth = null;

export function getAuth() {
  if (!_auth) _auth = new AuthSystem();
  return _auth;
}

export default AuthSystem;
