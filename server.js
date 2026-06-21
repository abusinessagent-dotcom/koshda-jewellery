/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Koshda B2B Jewellery Platform — Production Server
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Hardened Express server with:
 *   • Rate limiting & abuse protection
 *   • Helmet security headers (CSP, HSTS, X-Frame-Options, etc.)
 *   • JWT authentication with refresh tokens
 *   • Role-Based Access Control (RBAC)
 *   • Structured Winston logging
 *   • Health / readiness endpoints
 *   • Product search API
 *   • CSV bulk upload endpoint
 *   • Cached environment configuration
 *
 * Run:  npm start   →  http://localhost:3000
 * ═══════════════════════════════════════════════════════════════════════════════
 */

console.time('startup');

// ── Core Imports ────────────────────────────────────────────────────────────
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const logger = require('./lib/logger');



// ── Load .env once at startup ───────────────────────────────────────────────
dotenv.config();

// ── Frozen configuration object (no per-request file I/O) ───────────────────
const isProd = process.env.NODE_ENV === 'production';

// Critical security checks for production environments
if (isProd) {
  const missing = [];
  const weak = [];

  if (!process.env.ADMIN_SECRET_CODE || process.env.ADMIN_SECRET_CODE.trim() === 'RAMNIWAS@9823') {
    weak.push('ADMIN_SECRET_CODE');
  }
  if (!process.env.ADMIN_SECRET_PATH || process.env.ADMIN_SECRET_PATH.trim() === 'x9k2p7-admin') {
    weak.push('ADMIN_SECRET_PATH');
  }
  if (!process.env.HMAC_KEY_MATERIAL || process.env.HMAC_KEY_MATERIAL.trim() === '9e224e01a53586f314a7d5f6116a459889ae7a91fb0ca0ecc353e07da9705376') {
    weak.push('HMAC_KEY_MATERIAL');
  }
  if (!process.env.JWT_SECRET) {
    missing.push('JWT_SECRET');
  }
  if (!process.env.REFRESH_TOKEN_SECRET) {
    missing.push('REFRESH_TOKEN_SECRET');
  }

  if (missing.length > 0 || weak.length > 0) {
    console.error('================================================================');
    console.error('FATAL STARTUP ERROR: Security configuration validation failed.');
    if (missing.length > 0) {
      console.error(`Missing production environment variables: ${missing.join(', ')}`);
    }
    if (weak.length > 0) {
      console.error(`Weak or default credentials/secrets detected for production: ${weak.join(', ')}`);
    }
    console.error('Please configure all environment variables correctly in the .env file.');
    console.error('================================================================');
    process.exit(1);
  }
}

const CONFIG = Object.freeze({
  PORT: parseInt(process.env.PORT, 10) || 3000,
  SUPER_ADMIN_EMAIL: (process.env.SUPER_ADMIN_EMAIL || 'admin@koshda.in').trim().toLowerCase(),
  ADMIN_SECRET_PATH: (process.env.ADMIN_SECRET_PATH || 'x9k2p7-admin').trim(),
  ADMIN_SECRET_CODE: (process.env.ADMIN_SECRET_CODE || 'RAMNIWAS@9823').trim(),
  HMAC_KEY_MATERIAL: process.env.HMAC_KEY_MATERIAL || '9e224e01a53586f314a7d5f6116a459889ae7a91fb0ca0ecc353e07da9705376',
  JWT_SECRET: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || crypto.randomBytes(32).toString('hex'),
  NODE_ENV: process.env.NODE_ENV || 'development',
  BEHIND_TLS: process.env.BEHIND_TLS === 'true',
  CORS_ORIGINS: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()) : ['https://koshdajewelleryhouse.shop', 'https://www.koshdajewelleryhouse.shop', 'https://koshda.in', 'https://www.koshda.in'],
});

if (!isProd) {
  if (CONFIG.ADMIN_SECRET_CODE === 'RAMNIWAS@9823' || CONFIG.ADMIN_SECRET_PATH === 'x9k2p7-admin') {
    logger.warn('WARNING: Running in development mode with fallback credentials. Do not use this configuration in production.');
  }
}

const USERS_PATH = path.join(__dirname, 'data', 'users.json');
const REQUESTS_PATH = path.join(__dirname, 'data', 'requests.json');
const TOKEN_REQUESTS_PATH = path.join(__dirname, 'data', 'token-requests.json');
const TOKENS_PATH = path.join(__dirname, 'data', 'tokens.json');

function readUsers() {
  try {
    if (!fs.existsSync(USERS_PATH)) {
      fs.writeFileSync(USERS_PATH, '[]', 'utf-8');
      return [];
    }
    return JSON.parse(fs.readFileSync(USERS_PATH, 'utf-8'));
  } catch (err) {
    logger.error('Error reading users.json', { error: err.message });
    return [];
  }
}

function writeUsers(users) {
  try {
    fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf-8');
    return true;
  } catch (err) {
    logger.error('Error writing users.json', { error: err.message });
    return false;
  }
}

function readRequests() {
  try {
    if (!fs.existsSync(REQUESTS_PATH)) {
      fs.writeFileSync(REQUESTS_PATH, '[]', 'utf-8');
      return [];
    }
    return JSON.parse(fs.readFileSync(REQUESTS_PATH, 'utf-8'));
  } catch (err) {
    logger.error('Error reading requests.json', { error: err.message });
    return [];
  }
}

function writeRequests(requests) {
  try {
    fs.writeFileSync(REQUESTS_PATH, JSON.stringify(requests, null, 2), 'utf-8');
    return true;
  } catch (err) {
    logger.error('Error writing requests.json', { error: err.message });
    return false;
  }
}

function logAdminAccess(ip, userAgent, status, message) {
  try {
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, 'admin.log');
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] IP: ${ip} | UA: ${userAgent || 'unknown'} | STATUS: ${status} | MSG: ${message}\n`;
    fs.appendFileSync(logFile, logLine, 'utf-8');
  } catch (err) {
    logger.error('Failed to write to admin.log', { error: err.message });
  }
}

// ── RBAC Definitions ───────────────────────────────�// ── In-memory token blacklist (revoked tokens) ──────────────────────────────
const tokenBlacklist = new Set();

// ── Server startup metrics ──────────────────────────────────────────────────
const serverStartTime = Date.now();
let serverReady = false;
let requestsTotal = 0;
let errorsTotal = 0;

// ── Pre-compile validation regex ────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ══════════════════════════════════════════════════════════════════════════════
// EXPRESS APP SETUP
// ══════════════════════════════════════════════════════════════════════════════

const app = express();

// ── Body parsers ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ── Remove X-Powered-By ────────────────────────────────────────────────────
app.disable('x-powered-by');

// ── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: CONFIG.NODE_ENV === 'production'
    ? CONFIG.CORS_ORIGINS
    : true,  // Allow all in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// ── Helmet Security Headers ────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "https://placehold.co"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: CONFIG.BEHIND_TLS ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,  // Allow external images (placehold.co)
  hsts: (CONFIG.NODE_ENV === 'production' && CONFIG.BEHIND_TLS) ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false
}));

// ── Rate Limiters ───────────────────────────────────────────────────────────

// Strict limiter for auth endpoints: 5 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts. Please try again later.' },
  handler: (req, res, next, options) => {
    logger.security('rate_limit_auth', { ip: req.ip, endpoint: req.originalUrl });
    res.status(429).json(options.message);
  }
});

// Config endpoint limiter: 30 per minute
const configLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests.' }
});

// General API limiter: 100 per minute
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please slow down.' }
});

// ── Request Logging Middleware ───────────────────────────────────────────────
app.use((req, res, next) => {
  requestsTotal++;
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration_ms: duration,
      ip: req.ip
    };
    if (res.statusCode >= 400) {
      errorsTotal++;
      logger.warn('HTTP request error', logData);
    } else {
      logger.info(`${req.method} ${req.originalUrl}`, logData);
    }
  });
  next();
});

// URL Rewrite middleware to fix relative paths for public assets in nested routes
app.use((req, res, next) => {
  const publicAssetsIndex = req.url.indexOf('/public/assets/');
  if (publicAssetsIndex !== -1) {
    req.url = req.url.substring(publicAssetsIndex);
    return next();
  }
  const cssIndex = req.url.indexOf('/css/');
  if (cssIndex !== -1) {
    req.url = req.url.substring(cssIndex);
    return next();
  }
  const jsIndex = req.url.indexOf('/js/');
  if (jsIndex !== -1) {
    req.url = req.url.substring(jsIndex);
    return next();
  }
  next();
});

// ── Public Static File Serving (Registered early to bypass API/auth routes) ──
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  immutable: true
}));
app.use('/config/config.js', express.static(path.join(__dirname, 'config', 'config.js')));
app.use('/css', express.static(path.join(__dirname, 'public', 'assets', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'assets', 'js')));
app.use('/public', express.static(path.join(__dirname, 'public'), {
  maxAge: CONFIG.NODE_ENV === 'production' ? '1d' : 0
}));
app.use('/assets', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'web'), {
  maxAge: CONFIG.NODE_ENV === 'production' ? '1d' : 0
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'index.html'));
});

// ══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Validate that POST requests have JSON content type.
 */
function requireJSON(req, res, next) {
  if (req.method === 'POST' && !req.is('application/json') && !req.is('multipart/form-data')) {
    return res.status(415).json({ success: false, error: 'Content-Type must be application/json' });
  }
  next();
}

/**
 * Verify JWT token from Authorization header or httpOnly cookie.
 * Sets req.user with decoded payload on success.
 */
function verifyToken(req, res, next) {
  let token = null;

  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const val = authHeader.substring(7).trim();
    if (val && val !== 'null' && val !== 'undefined') {
      token = val;
    }
  }

  // Fallback to httpOnly cookie
  if (!token && req.cookies && req.cookies.admin_token) {
    token = req.cookies.admin_token;
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  // Check blacklist
  if (tokenBlacklist.has(token)) {
    logger.security('revoked_token_used', { ip: req.ip });
    return res.status(401).json({ success: false, error: 'Token has been revoked' });
  }

  try {
    const payload = jwt.verify(token, CONFIG.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Token expired' });
    }
    logger.security('invalid_token', { ip: req.ip, error: err.message });
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

function requireTokenAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  // Enforce token-based access claim for dealers
  if (req.user.role === 'dealer' && !req.user.tokenAccess) {
    return res.status(403).json({ 
      success: false, 
      error: 'Access denied. A verified access token is required to view the catalogue.' 
    });
  }
  next();
}

/**
 * RBAC permission check middleware.
 * Must be used after verifyToken.
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    const userRole = req.user.role;
    const rolePerms = ROLES[userRole]?.permissions || [];
    if (!rolePerms.includes(permission)) {
      logger.security('permission_denied', {
        ip: req.ip,
        userId: req.user.sub,
        role: userRole,
        requiredPermission: permission
      });
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    next();
  };
}

/**
 * Middleware to protect admin HTML pages.
 * Checks JWT from cookie or redirects to login.
 */
function requireAdminPage(req, res, next) {
  let token = null;

  if (req.cookies && req.cookies.admin_token) {
    token = req.cookies.admin_token;
  }

  // For HTML page requests, also check query param (for redirects)
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  // If no token, allow access — client-side auth handles the redirect.
  // This is a progressive enhancement; full server-side blocking can be
  // enabled once frontend fully migrates to cookie-based auth.
  if (!token) {
    // Set no-cache headers to prevent back-button cache leaks
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    return next();
  }

  if (tokenBlacklist.has(token)) {
    return res.redirect('/login.html');
  }

  try {
    const payload = jwt.verify(token, CONFIG.JWT_SECRET);
    req.user = payload;
    // Set no-cache headers
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  } catch (err) {
    // Invalid/expired token — still let through for client-side handling
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HEALTH & READINESS ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
  const status = serverReady ? 'ok' : 'degraded';
  const statusCode = serverReady ? 200 : 503;
  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    uptime_ms: Math.round(process.uptime() * 1000)
  });
});

app.get('/ready', (req, res) => {
  const checks = {
    server: true,
    config: !!(CONFIG.SUPER_ADMIN_EMAIL && CONFIG.JWT_SECRET),
    modules: true
  };
  const allReady = Object.values(checks).every(Boolean) && serverReady;
  res.status(allReady ? 200 : 503).json({
    ready: allReady,
    checks,
    timestamp: new Date().toISOString()
  });
});

app.get('/metrics', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    requests_total: requestsTotal,
    errors_total: errorsTotal,
    uptime_ms: Math.round(process.uptime() * 1000),
    memory_usage_mb: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
    memory_rss_mb: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
    active_blacklisted_tokens: tokenBlacklist.size
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/config — expose non-sensitive settings to frontend
app.get('/api/config', configLimiter, (req, res) => {
  res.json({
    superAdminEmail: CONFIG.SUPER_ADMIN_EMAIL
  });
});

const failedAccessAttempts = new Map(); // IP -> { count, lockedUntil }

// Helper for admin key verification
const handleAdminSecretVerification = (req, res) => {
  const { code } = req.body;
  const ip = req.ip;
  const now = Date.now();

  // Brute force lockout check
  if (failedAccessAttempts.has(ip)) {
    const attemptInfo = failedAccessAttempts.get(ip);
    if (attemptInfo.lockedUntil && now < attemptInfo.lockedUntil) {
      const remainingSecs = Math.ceil((attemptInfo.lockedUntil - now) / 1000);
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts. Your IP has been blocked. Please try again in ${remainingSecs} second(s).`
      });
    }
  }

  // Input validation
  if (typeof code !== 'string') {
    return res.status(400).json({ success: false, error: 'Access Key must be a string.' });
  }
  if (code.length > 100) {
    return res.status(400).json({ success: false, error: 'Access Key is invalid.' });
  }

  try {
    // HMAC Timing-safe comparison to prevent side-channel timing analysis
    const inputDigest    = crypto.createHmac('sha256', CONFIG.HMAC_KEY_MATERIAL).update(code).digest('hex');
    const expectedDigest = crypto.createHmac('sha256', CONFIG.HMAC_KEY_MATERIAL).update(CONFIG.ADMIN_SECRET_CODE).digest('hex');

    const inputBuffer    = Buffer.from(inputDigest, 'hex');
    const expectedBuffer = Buffer.from(expectedDigest, 'hex');
    const isValid        = crypto.timingSafeEqual(inputBuffer, expectedBuffer);

    if (isValid) {
      // Clear brute-force metrics
      failedAccessAttempts.delete(ip);

      // Generate secure session token (JWT)
      const sessionId = 'sess-adm-' + crypto.randomBytes(16).toString('hex').toUpperCase();
      const payload = {
        sub:   'adm-SUPERADMIN', // seeding a standard ID
        email: CONFIG.SUPER_ADMIN_EMAIL,
        role:  'super_admin',
        sid:   sessionId,
        iat:   Math.floor(Date.now() / 1000),
        exp:   Math.floor(Date.now() / 1000) + (8 * 3600) // 8 hour expiration
      };
      
      const token = jwt.sign(payload, CONFIG.JWT_SECRET);
      
      const session = {
        id:        payload.sub,
        name:      'Super Administrator',
        email:     payload.email,
        role:      payload.role,
        avatar:    'SA',
        status:    'approved',
        sessionId: sessionId,
        loginAt:   new Date().toISOString(),
        expiresAt: new Date(Date.now() + 8 * 3600000).toISOString()
      };

      // Set HTTP-only, secure token cookie
      res.cookie('admin_token', token, {
        httpOnly: true,
        secure:   CONFIG.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge:   8 * 3600 * 1000,
        path:     '/'
      });

      // Audit logs
      logAdminAccess(ip, req.headers['user-agent'], 'SUCCESS', 'Admin access granted.');
      logger.info('Admin access key verified successfully', { ip });

      return res.json({
        success: true,
        token: token,
        user: session
      });
    } else {
      // Handle failed attempt
      let attemptInfo = failedAccessAttempts.get(ip) || { count: 0, lockedUntil: 0 };
      attemptInfo.count += 1;
      
      if (attemptInfo.count >= 5) {
        attemptInfo.lockedUntil = now + 15 * 60 * 1000; // 15 mins block
        failedAccessAttempts.set(ip, attemptInfo);
        logAdminAccess(ip, req.headers['user-agent'], 'BLOCKED_IP', 'IP blocked due to 5 consecutive failures.');
        logger.warn('IP blocked due to consecutive admin verification failures', { ip });
        return res.status(429).json({
          success: false,
          error: 'Too many failed attempts. Your IP has been blocked for 15 minutes.'
        });
      } else {
        failedAccessAttempts.set(ip, attemptInfo);
        logAdminAccess(ip, req.headers['user-agent'], 'FAILED_INVALID_CODE', `Failed attempt ${attemptInfo.count}/5`);
        return res.status(401).json({
          success: false,
          error: `Incorrect secret access code. ${5 - attemptInfo.count} attempt(s) remaining.`
        });
      }
    }
  } catch (err) {
    logger.error('Error during secret code verification', { error: err.message });
    return res.status(500).json({ success: false, error: 'Internal validation error.' });
  }
};

// POST /verify-admin-access — Secure constant-time code verification with IP blockings
app.post('/verify-admin-access', authLimiter, requireJSON, handleAdminSecretVerification);
app.post('/api/auth/verify-secret', authLimiter, requireJSON, handleAdminSecretVerification);

// POST /api/auth/register — Register new users/admins
app.post(['/api/auth/register', '/api/register'], authLimiter, requireJSON, (req, res) => {
  const { email, password, name, role = 'dealer', businessName, phone, city, state, categories, ndaSigned } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({ success: false, error: 'Email, password, and name are required.' });
  }
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email format.' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
  }

  const inputEmail = email.trim().toLowerCase();
  const users = readUsers();

  if (users.some(u => u.email.toLowerCase() === inputEmail)) {
    return res.status(400).json({ success: false, error: 'An account with this email already exists.' });
  }

  const prefix = role.includes('admin') ? 'adm-' : 'dlr-';
  const uniqueId = prefix + crypto.randomBytes(8).toString('hex').toUpperCase();
  const hashedPassword = bcrypt.hashSync(password, 10);

  const newUser = {
    id: uniqueId,
    role: role,
    tier: role === 'dealer' ? 'standard' : undefined,
    status: 'approved', // Auto-approved for instant login
    name: name.trim(),
    businessName: businessName ? businessName.trim() : name.trim(),
    email: inputEmail,
    phone: phone || '',
    password: hashedPassword,
    avatar: name.substring(0, 2).toUpperCase(),
    city: city || '',
    state: state || '',
    categories: categories || [],
    ndaSigned: !!ndaSigned,
    ndaSignedAt: ndaSigned ? new Date().toISOString() : null,
    registeredAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    lastLogin: null,
    onboardingDone: true,
    devicesRegistered: 0,
    engagementScore: 10
  };

  users.push(newUser);
  writeUsers(users);

  // Generate tokens for auto-login
  const uniqueSessionId = crypto.randomBytes(8).toString('hex').toUpperCase();
  const sessionId       = 'sess-' + crypto.randomBytes(16).toString('hex').toUpperCase();

  const accessTokenPayload = {
    sub:   newUser.id,
    email: newUser.email,
    role:  newUser.role,
    sid:   sessionId,
    iat:   Math.floor(Date.now() / 1000),
    exp:   Math.floor(Date.now() / 1000) + (8 * 3600)
  };
  const accessToken = jwt.sign(accessTokenPayload, CONFIG.JWT_SECRET);

  const refreshTokenPayload = {
    sub:   newUser.id,
    email: newUser.email,
    role:  newUser.role,
    type:  'refresh',
    iat:   Math.floor(Date.now() / 1000),
    exp:   Math.floor(Date.now() / 1000) + (7 * 24 * 3600)
  };
  const refreshToken = jwt.sign(refreshTokenPayload, CONFIG.REFRESH_TOKEN_SECRET);

  const session = {
    id:        newUser.id,
    name:      newUser.name,
    email:     newUser.email,
    role:      newUser.role,
    avatar:    newUser.avatar,
    status:    newUser.status,
    sessionId: sessionId,
    loginAt:   new Date().toISOString(),
    expiresAt: new Date(Date.now() + 8 * 3600000).toISOString()
  };

  res.cookie('admin_token', accessToken, {
    httpOnly: true,
    secure:   CONFIG.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge:   8 * 3600 * 1000,
    path:     '/'
  });

  logger.auth('register', {
    ip: req.ip,
    email: inputEmail,
    success: true,
    userId: newUser.id
  });

  return res.json({
    success: true,
    token: accessToken,
    refreshToken: refreshToken,
    expiresIn: 8 * 3600,
    user: session
  });
});

// POST /api/auth/login — Authenticate credentials (admin or dealer), return JWT
app.post(['/api/auth/login', '/api/login'], authLimiter, requireJSON, (req, res) => {
  const { email, password } = req.body;
  const loginStart = Date.now();

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email format.' });
  }
  if (typeof password !== 'string' || password.length > 128) {
    return res.status(400).json({ success: false, error: 'Invalid password format.' });
  }

  const inputEmail = email.trim().toLowerCase();
  const users = readUsers();
  const user = users.find(u => u.email.toLowerCase() === inputEmail);

  if (!user) {
    logger.auth('login_failed', { ip: req.ip, email: inputEmail, reason: 'user_not_found' });
    return res.status(401).json({ success: false, error: 'Invalid email or password. Please try again.' });
  }

  // Strictly block credential-based login for admin roles
  const adminRoles = ['super_admin', 'admin', 'catalogue_manager', 'dealer_manager', 'analytics_viewer', 'moderator', 'viewer'];
  if (adminRoles.includes(user.role)) {
    logger.security('admin_credential_login_attempt_blocked', { ip: req.ip, email: inputEmail });
    return res.status(403).json({ success: false, error: 'Credential login is disabled for administrators. Please use the secure command console path.' });
  }

  let passMatch = false;
  try {
    passMatch = bcrypt.compareSync(password, user.password);
  } catch (err) {
    logger.error('Password verification error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Authentication processing failed.' });
  }

  if (!passMatch) {
    logger.auth('login_failed', { ip: req.ip, email: inputEmail, reason: 'password_mismatch' });
    return res.status(401).json({ success: false, error: 'Invalid email or password. Please try again.' });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({ success: false, error: 'suspended' });
  }
  if (user.status === 'paused') {
    return res.status(403).json({ success: false, error: 'paused' });
  }

  const uniqueSessionId = crypto.randomBytes(8).toString('hex').toUpperCase();
  const sessionId       = 'sess-' + crypto.randomBytes(16).toString('hex').toUpperCase();

  const accessTokenPayload = {
    sub:   user.id,
    email: user.email,
    role:  user.role,
    sid:   sessionId,
    iat:   Math.floor(Date.now() / 1000),
    exp:   Math.floor(Date.now() / 1000) + (8 * 3600)
  };
  const accessToken = jwt.sign(accessTokenPayload, CONFIG.JWT_SECRET);

  const refreshTokenPayload = {
    sub:   user.id,
    email: user.email,
    role:  user.role,
    type:  'refresh',
    iat:   Math.floor(Date.now() / 1000),
    exp:   Math.floor(Date.now() / 1000) + (7 * 24 * 3600)
  };
  const refreshToken = jwt.sign(refreshTokenPayload, CONFIG.REFRESH_TOKEN_SECRET);

  const session = {
    id:        user.id,
    name:      user.name,
    email:     user.email,
    role:      user.role,
    avatar:    user.avatar || user.name.substring(0, 2).toUpperCase(),
    status:    user.status,
    sessionId: sessionId,
    loginAt:   new Date().toISOString(),
    expiresAt: new Date(Date.now() + 8 * 3600000).toISOString()
  };

  user.lastLogin = session.loginAt;
  writeUsers(users);

  res.cookie('admin_token', accessToken, {
    httpOnly: true,
    secure:   CONFIG.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge:   8 * 3600 * 1000,
    path:     '/'
  });

  const duration = Date.now() - loginStart;
  logger.auth('login', {
    ip: req.ip,
    email: inputEmail,
    success: true,
    sessionId: sessionId,
    userId: user.id,
    duration_ms: duration
  });

  return res.json({
    success: true,
    token: accessToken,
    refreshToken: refreshToken,
    expiresIn: 8 * 3600,
    user: session
  });
});

// POST /api/auth/refresh — Refresh access token using refresh token
app.post('/api/auth/refresh', requireJSON, (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ success: false, error: 'Refresh token required.' });
  }

  if (tokenBlacklist.has(refreshToken)) {
    return res.status(401).json({ success: false, error: 'Refresh token has been revoked.' });
  }

  try {
    const payload = jwt.verify(refreshToken, CONFIG.REFRESH_TOKEN_SECRET);

    if (payload.type !== 'refresh') {
      return res.status(401).json({ success: false, error: 'Invalid token type.' });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        sub:   payload.sub,
        email: payload.email,
        role:  payload.role,
        sid:   'sess-' + crypto.randomBytes(16).toString('hex').toUpperCase(),
        iat:   Math.floor(Date.now() / 1000),
        exp:   Math.floor(Date.now() / 1000) + (8 * 3600)
      },
      CONFIG.JWT_SECRET
    );

    // Update cookie
    res.cookie('admin_token', newAccessToken, {
      httpOnly: true,
      secure:   CONFIG.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge:   8 * 3600 * 1000,
      path:     '/'
    });

    logger.auth('token_refresh', { ip: req.ip, userId: payload.sub });

    return res.json({
      success: true,
      token: newAccessToken,
      expiresIn: 8 * 3600
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Refresh token expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, error: 'Invalid refresh token.' });
  }
});

// POST /api/auth/logout — Revoke token and clear cookie
app.post('/api/auth/logout', (req, res) => {
  // Get token from header or cookie
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  if (!token && req.cookies && req.cookies.admin_token) {
    token = req.cookies.admin_token;
  }

  if (token) {
    tokenBlacklist.add(token);
    logger.auth('logout', { ip: req.ip });
  }

  // Also blacklist refresh token if provided
  const { refreshToken } = req.body || {};
  if (refreshToken) {
    tokenBlacklist.add(refreshToken);
  }

  // Clear cookie
  res.clearCookie('admin_token', { path: '/' });

  return res.json({ success: true, message: 'Logged out successfully.' });
});

function findUploadedImageByCategory(id, category) {
  const categoryFolderMap = {
    RING: 'rings', NECK: 'necklaces', EARR: 'earrings',
    BANG: 'bangles', BRAC: 'bracelets', PEND: 'pendants',
    ANKL: 'anklets', MAAG: 'maang-tikka', SETT: 'bridal'
  };
  const folder = categoryFolderMap[category] || 'rings';
  const dirPath = path.join(__dirname, 'uploads', folder);
  try {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      const match = files.find(f => f.toLowerCase() === `${id.toLowerCase()}.webp`);
      if (match) {
        return `/uploads/${folder}/${match}`;
      }
    }
  } catch (err) {
    logger.error(`Error scanning uploads/${folder} for image mapping`, { error: err.message });
  }
  return `/uploads/${folder}/${id}.webp`; // Fallback
}

// GET /api/admin/dashboard-stats — Fetch stats dynamically from server-side files
app.get('/api/admin/dashboard-stats', verifyToken, (req, res) => {
  const isAdmin = ['super_admin', 'admin', 'catalogue_manager', 'dealer_manager', 'analytics_viewer'].includes(req.user.role);
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Permission denied.' });
  }

  const users = readUsers();
  const requests = readRequests();

  const totalUsers = users.length;
  const activeDealers = users.filter(u => u.role === 'dealer' && u.status === 'approved').length;
  const pendingRegistrations = users.filter(u => u.role === 'dealer' && u.status === 'pending').length;
  const pendingProductRequests = requests.filter(r => r.status === 'pending').length;

  res.json({
    success: true,
    totalUsers,
    activeDealers,
    pendingRegistrations,
    pendingProductRequests,
    totalProducts: productsData.length
  });
});

// POST /api/products/request-upload — Dealer requests product bulk upload
app.post('/api/products/request-upload', verifyToken, requireJSON, (req, res) => {
  const { products } = req.body;
  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ success: false, error: 'Products array is required.' });
  }

  const requests = readRequests();
  const requestId = 'req-' + crypto.randomBytes(8).toString('hex').toUpperCase();

  const newRequest = {
    id: requestId,
    userId: req.user.sub,
    userEmail: req.user.email,
    products: products,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  requests.push(newRequest);
  writeRequests(requests);

  res.json({
    success: true,
    requestId: requestId
  });
});

// GET /api/admin/products/requests — Admin views requests
app.get('/api/admin/products/requests', verifyToken, (req, res) => {
  const isAdmin = ['super_admin', 'admin', 'catalogue_manager'].includes(req.user.role);
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Permission denied.' });
  }

  const requests = readRequests();
  res.json({
    success: true,
    requests: requests
  });
});

// POST /api/admin/products/requests/:id/approve — Admin approves request
app.post('/api/admin/products/requests/:id/approve', verifyToken, (req, res) => {
  const isAdmin = ['super_admin', 'admin', 'catalogue_manager'].includes(req.user.role);
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Permission denied.' });
  }

  const requestId = req.params.id;
  const requests = readRequests();
  const requestIndex = requests.findIndex(r => r.id === requestId);

  if (requestIndex === -1) {
    return res.status(404).json({ success: false, error: 'Request not found.' });
  }

  const request = requests[requestIndex];
  if (request.status !== 'pending') {
    return res.status(400).json({ success: false, error: 'Request already processed.' });
  }

  try {
    const productsPath = path.join(__dirname, 'data', 'products.json');
    let existing = [];
    if (fs.existsSync(productsPath)) {
      existing = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
    }

    const approvedProducts = request.products.map(p => {
      const category = p.category || 'RING';
      const imagePath = findUploadedImageByCategory(p.code || p.id, category);

      return {
        id: 'prd-req-' + (p.code || p.id).toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        code: p.code || p.id,
        name: p.name || p.title,
        collectionId: p.collectionId || 'col-002',
        collectionName: p.collectionName || 'Contemporary Daily',
        category: category,
        categoryLabel: category,
        material: p.material || 'Gold',
        purity: p.purity || '22 Karat',
        weight: p.weight,
        price: p.price || 0,
        description: p.description,
        images: p.images && p.images.length > 0 ? p.images : [imagePath],
        status: 'active',
        uploadedAt: new Date().toISOString(),
        searchKeywords: (p.name || p.title || '').toLowerCase().split(/\s+/)
      };
    });

    const uniqueApproved = approvedProducts.filter(ap => {
      return !existing.some(ep => ep.code.toLowerCase() === ap.code.toLowerCase() || ep.id === ap.id);
    });

    const updated = [...existing, ...uniqueApproved];
    fs.writeFileSync(productsPath, JSON.stringify(updated, null, 2), 'utf-8');
    productsData = updated;

    request.status = 'approved';
    request.processedAt = new Date().toISOString();
    request.processedBy = req.user.sub;
    writeRequests(requests);

    res.json({
      success: true,
      approvedCount: uniqueApproved.length,
      ignoredCount: approvedProducts.length - uniqueApproved.length
    });
  } catch (err) {
    logger.error('Failed to approve request', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to approve request.' });
  }
});

// POST /api/admin/products/requests/:id/reject — Admin rejects request
app.post('/api/admin/products/requests/:id/reject', verifyToken, (req, res) => {
  const isAdmin = ['super_admin', 'admin', 'catalogue_manager'].includes(req.user.role);
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Permission denied.' });
  }

  const requestId = req.params.id;
  const requests = readRequests();
  const requestIndex = requests.findIndex(r => r.id === requestId);

  if (requestIndex === -1) {
    return res.status(404).json({ success: false, error: 'Request not found.' });
  }

  const request = requests[requestIndex];
  if (request.status !== 'pending') {
    return res.status(400).json({ success: false, error: 'Request already processed.' });
  }

  request.status = 'rejected';
  request.processedAt = new Date().toISOString();
  request.processedBy = req.user.sub;
  writeRequests(requests);

  res.json({
    success: true
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PRODUCT API ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

// Load products data once
let productsData = [];
try {
  const productsPath = path.join(__dirname, 'data', 'products.json');
  if (fs.existsSync(productsPath)) {
    productsData = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
    logger.info(`Loaded ${productsData.length} products from data/products.json`);
  }
} catch (err) {
  logger.error('Failed to load products.json', { error: err.message });
}

// GET /api/products — List all products with pagination
app.get('/api/products', verifyToken, requireTokenAccess, generalLimiter, (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  const limitNum  = Math.min(parseInt(limit, 10)  || 20, 100);
  const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

  const items = productsData.filter(p => p.status === 'active');
  const paginated = items.slice(offsetNum, offsetNum + limitNum);

  res.json({
    total: items.length,
    limit: limitNum,
    offset: offsetNum,
    hasMore: offsetNum + limitNum < items.length,
    items: paginated
  });
});

// GET /api/products/search — Search and filter products
app.get('/api/products/search', verifyToken, requireTokenAccess, generalLimiter, (req, res) => {
  const { q, category, material, priceMin, priceMax, limit = 20, offset = 0 } = req.query;
  const limitNum  = Math.min(parseInt(limit, 10)  || 20, 100);
  const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

  let results = productsData.filter(p => p.status === 'active');

  if (q) {
    const query = q.toLowerCase();
    results = results.filter(p =>
      (p.name && p.name.toLowerCase().includes(query)) ||
      (p.code && p.code.toLowerCase().includes(query)) ||
      (p.description && p.description.toLowerCase().includes(query)) ||
      (p.material && p.material.toLowerCase().includes(query)) ||
      (Array.isArray(p.searchKeywords) && p.searchKeywords.some(k => k.toLowerCase().includes(query)))
    );
  }

  if (category) {
    const catUpper = category.toUpperCase();
    results = results.filter(p => p.category === catUpper);
  }

  if (material) {
    const matLower = material.toLowerCase();
    results = results.filter(p => p.material && p.material.toLowerCase() === matLower);
  }

  if (priceMin) {
    const min = parseInt(priceMin, 10);
    if (!isNaN(min)) results = results.filter(p => (p.price || 0) >= min);
  }

  if (priceMax) {
    const max = parseInt(priceMax, 10);
    if (!isNaN(max)) results = results.filter(p => (p.price || 0) <= max);
  }

  const paginated = results.slice(offsetNum, offsetNum + limitNum);

  res.json({
    total: results.length,
    limit: limitNum,
    offset: offsetNum,
    hasMore: offsetNum + limitNum < results.length,
    items: paginated
  });
});

// GET /api/products/categories — List distinct categories
app.get('/api/products/categories', verifyToken, requireTokenAccess, generalLimiter, (req, res) => {
  const categories = [...new Set(productsData.map(p => p.category).filter(Boolean))];
  const categoriesWithLabels = categories.map(cat => {
    const product = productsData.find(p => p.category === cat);
    return { code: cat, label: product?.categoryLabel || cat };
  });
  res.json(categoriesWithLabels);
});

// ══════════════════════════════════════════════════════════════════════════════
// CSV BULK UPLOAD ENDPOINT
// ══════════════════════════════════════════════════════════════════════════════

const csvUpload = multer({
  dest: path.join(__dirname, 'uploads', 'csv-temp'),
  limits: { fileSize: 5 * 1024 * 1024 },  // 5 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

/**
 * Validate a single product row from CSV.
 */
function validateProductRow(row) {
  const errors = [];
  if (!row.code)     errors.push('Missing required field: code');
  if (!row.name)     errors.push('Missing required field: name');
  if (!row.category) errors.push('Missing required field: category');

  if (errors.length > 0) {
    return { valid: false, errors, data: null };
  }

  return {
    valid: true,
    errors: [],
    data: {
      id:            'prd-dyn-' + (row.code || '').toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      code:          row.code,
      name:          row.name,
      category:      (row.category || '').toUpperCase(),
      categoryLabel: row.categoryLabel || row.category || '',
      material:      row.material || 'Unknown',
      purity:        row.purity || '',
      weight:        row.weight || '',
      price:         parseInt(row.price, 10) || 0,
      description:   row.description || '',
      images:        row.images ? row.images.split('|').map(s => s.trim()) : [],
      status:        'active',
      uploadedAt:    new Date().toISOString(),
      searchKeywords: (row.name || '').toLowerCase().split(/\s+/)
    }
  };
}

/**
 * Auto-map images for a product code by scanning the uploads directory.
 */
function autoMapImages(productCode, category) {
  const categoryFolderMap = {
    RING: 'rings', NECK: 'necklaces', EARR: 'earrings',
    BANG: 'bangles', BRAC: 'bracelets', PEND: 'pendants',
    ANKL: 'anklets', MAAG: 'maang-tikka', SETT: 'bridal'
  };
  const folder = categoryFolderMap[category] || category.toLowerCase() + 's';
  const uploadDir = path.join(__dirname, 'uploads', folder);

  try {
    if (!fs.existsSync(uploadDir)) return [];
    const files = fs.readdirSync(uploadDir);
    return files
      .filter(f => f.startsWith(productCode))
      .sort()
      .map(f => `/uploads/${folder}/${f}`);
  } catch {
    return [];
  }
}

// POST /api/admin/products/bulk-upload — Upload CSV and import products
app.post('/api/admin/products/bulk-upload',
  verifyToken,
  requirePermission('admin.write'),
  csvUpload.single('file'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'CSV file required.' });
    }

    const results = [];
    const errors = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (row) => results.push(row))
      .on('end', () => {
        // Clean up temp file
        try { fs.unlinkSync(req.file.path); } catch {}

        const validated = [];
        results.forEach((row, idx) => {
          const result = validateProductRow(row);
          if (result.valid) {
            // Auto-map images if none provided
            if (result.data.images.length === 0) {
              result.data.images = autoMapImages(result.data.code, result.data.category);
            }
            validated.push(result.data);
          } else {
            errors.push({ row: idx + 1, errors: result.errors });
          }
        });

        if (validated.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No valid products found in CSV.',
            validationErrors: errors
          });
        }

        // Append to products.json
        try {
          const productsPath = path.join(__dirname, 'data', 'products.json');
          const existing = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
          const updated = [...existing, ...validated];
          fs.writeFileSync(productsPath, JSON.stringify(updated, null, 2), 'utf-8');

          // Update in-memory cache
          productsData = updated;

          logger.audit('bulk_upload', {
            adminId: req.user.sub,
            uploaded: validated.length,
            errors: errors.length
          });

          res.json({
            success: true,
            uploaded: validated.length,
            failed: errors.length,
            validationErrors: errors
          });
        } catch (err) {
          logger.error('Failed to write products.json', { error: err.message });
          res.status(500).json({ success: false, error: 'Failed to save products.' });
        }
      })
      .on('error', (err) => {
        try { fs.unlinkSync(req.file.path); } catch {}
        logger.error('CSV parsing error', { error: err.message });
        res.status(400).json({ success: false, error: 'Failed to parse CSV file.' });
      });
  }
);

// GET /api/admin/products/template — Download CSV template
app.get('/api/admin/products/template', (req, res) => {
  const templatePath = path.join(__dirname, 'admin', 'product-upload-template.csv');
  if (fs.existsSync(templatePath)) {
    res.download(templatePath, 'product-upload-template.csv');
  } else {
    res.status(404).json({ success: false, error: 'Template not found.' });
  }
});

/**
 * Auto-map a single image for text import by scanning the uploads directory.
 */
function findUploadedImage(id) {
  const categoryFolders = ['rings', 'earrings', 'necklaces', 'bridal', 'bangles', 'bracelets', 'pendants', 'anklets', 'maang-tikka'];
  try {
    for (const folder of categoryFolders) {
      const dirPath = path.join(__dirname, 'uploads', folder);
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        // Case-insensitive check
        const match = files.find(f => f.toLowerCase() === `${id.toLowerCase()}.webp`);
        if (match) {
          return `/uploads/${folder}/${match}`;
        }
      }
    }
  } catch (err) {
    logger.error('Error scanning uploads for text import image mapping', { error: err.message });
  }
  // Default fallback path if not found on disk
  return `/uploads/rings/${id}.webp`;
}

// POST /api/admin/products/bulk-import-text — Bulk text importer persistence
app.post('/api/admin/products/bulk-import-text',
  verifyToken,
  requireJSON,
  (req, res) => {
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, error: 'Products array is required and must not be empty.' });
    }

    if (products.length > 100) {
      return res.status(400).json({ success: false, error: 'Maximum limit of 100 products exceeded.' });
    }

    const productsPath = path.join(__dirname, 'data', 'products.json');
    let existingProducts = [];
    try {
      if (fs.existsSync(productsPath)) {
        existingProducts = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
      }
    } catch (e) {
      logger.error('Failed to load products.json during validation', { error: e.message });
    }

    const pendingRequests = readRequests().filter(r => r.status === 'pending');

    const validatedProducts = [];
    const errors = [];
    const WEIGHT_REGEX = /^\d+(\.\d+)?g$/;

    products.forEach((p, idx) => {
      const { id, title, weight, description } = p;
      const rowErrors = [];

      if (!id) rowErrors.push('Missing ID');
      if (!title) rowErrors.push('Missing TITLE');
      
      if (!weight) {
        rowErrors.push('Missing WEIGHT');
      } else if (!WEIGHT_REGEX.test(weight)) {
        rowErrors.push('Weight must match format like 10g or 5.5g');
      }

      if (!description) rowErrors.push('Missing DESC');

      if (id) {
        // Check duplicate within the payload itself
        const payloadDup = products.slice(0, idx).some(p2 => p2.id && p2.id.toLowerCase() === id.toLowerCase());
        if (payloadDup) {
          rowErrors.push(`Duplicate ID "${id}" detected in current batch.`);
        }

        // Check duplicate in existing catalogue
        const catDup = existingProducts.some(ep => ep.code.toLowerCase() === id.toLowerCase() || ep.id === 'prd-txt-' + id.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
        if (catDup) {
          rowErrors.push(`Product ID "${id}" already exists in the catalogue.`);
        }

        // Check duplicate in pending requests
        const pendingDup = pendingRequests.some(r => r.products.some(p2 => (p2.code || p2.id || '').toLowerCase() === id.toLowerCase()));
        if (pendingDup) {
          rowErrors.push(`Product ID "${id}" is already pending approval in a previous request.`);
        }
      }

      if (rowErrors.length > 0) {
        errors.push({ index: idx, id: id || 'unknown', errors: rowErrors });
        return;
      }

      // Determine category based on title or ID
      let category = 'RING';
      const cleanTitle = title.toLowerCase();
      if (cleanTitle.includes('neck') || cleanTitle.includes('choker')) {
        category = 'NECK';
      } else if (cleanTitle.includes('earr') || cleanTitle.includes('stud') || cleanTitle.includes('jhumka')) {
        category = 'EARR';
      } else if (cleanTitle.includes('bang') || cleanTitle.includes('kada')) {
        category = 'BANG';
      } else if (cleanTitle.includes('brac') || cleanTitle.includes('wrist')) {
        category = 'BRAC';
      } else if (cleanTitle.includes('pend')) {
        category = 'PEND';
      } else if (cleanTitle.includes('ankl') || cleanTitle.includes('payal')) {
        category = 'ANKL';
      } else if (cleanTitle.includes('maag') || cleanTitle.includes('tikka')) {
        category = 'MAAG';
      } else if (cleanTitle.includes('bridal') || cleanTitle.includes('set')) {
        category = 'SETT';
      }

      // Determine material
      let material = 'Gold';
      if (cleanTitle.includes('silver') || cleanTitle.includes('sterling')) {
        material = 'Silver';
      } else if (cleanTitle.includes('plat')) {
        material = 'Platinum';
      }

      // Determine purity
      let purity = '22 Karat';
      if (material === 'Silver') {
        purity = 'Sterling Silver';
      } else if (cleanTitle.includes('18k') || cleanTitle.includes('18 karat')) {
        purity = '18 Karat';
      } else if (cleanTitle.includes('14k') || cleanTitle.includes('14 karat')) {
        purity = '14 Karat';
      }

      const imagePath = findUploadedImageByCategory(id, category);

      const catalogProduct = {
        id: 'prd-txt-' + id.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        code: id,
        name: title,
        collectionId: 'col-002', // Contemporary Daily
        collectionName: 'Contemporary Daily',
        category: category,
        categoryLabel: category,
        material: material,
        purity: purity,
        weight: weight,
        price: 0,
        description: description,
        images: [imagePath],
        status: 'active',
        uploadedAt: new Date().toISOString(),
        searchKeywords: title.toLowerCase().split(/\s+/)
      };

      validatedProducts.push(catalogProduct);
    });

    if (errors.length > 0 || validatedProducts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed for one or more products.',
        validationErrors: errors
      });
    }

    const isAdmin = ['super_admin', 'admin', 'catalogue_manager'].includes(req.user.role);

    if (isAdmin) {
      // Append directly to products.json
      try {
        const updated = [...existingProducts, ...validatedProducts];
        fs.writeFileSync(productsPath, JSON.stringify(updated, null, 2), 'utf-8');
        productsData = updated;

        logger.audit('bulk_import_text_admin', {
          adminId: req.user.sub,
          imported: validatedProducts.length
        });

        return res.json({
          success: true,
          imported: validatedProducts.length,
          failed: 0,
          validationErrors: []
        });
      } catch (err) {
        logger.error('Failed to write products.json during bulk text import', { error: err.message });
        return res.status(500).json({ success: false, error: 'Failed to save products on server.' });
      }
    } else {
      // Dealer: create a pending upload request
      try {
        const requests = readRequests();
        const requestId = 'req-' + crypto.randomBytes(8).toString('hex').toUpperCase();

        const newRequest = {
          id: requestId,
          userId: req.user.sub,
          userEmail: req.user.email,
          products: validatedProducts,
          status: 'pending',
          createdAt: new Date().toISOString()
        };

        requests.push(newRequest);
        writeRequests(requests);

        logger.audit('bulk_import_text_dealer_request', {
          dealerId: req.user.sub,
          requestId: requestId,
          requested: validatedProducts.length
        });

        return res.json({
          success: true,
          pending: true,
          requestId: requestId,
          imported: 0,
          requested: validatedProducts.length,
          failed: 0,
          validationErrors: []
        });
      } catch (err) {
        logger.error('Failed to write requests.json during dealer bulk upload request', { error: err.message });
        return res.status(500).json({ success: false, error: 'Failed to create upload request on server.' });
      }
    }
  }
);

// Multer memory storage for bulk folder upload
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB per file max
});

// POST /api/admin/products/bulk-upload-folder — Bulk folder upload API
app.post('/api/admin/products/bulk-upload-folder',
  verifyToken,
  memoryUpload.array('files', 500),
  async (req, res) => {
    const isAdmin = ['super_admin', 'admin', 'catalogue_manager'].includes(req.user.role);
    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Permission denied.' });
    }

    const { metadata: metadataStr } = req.body;
    const files = req.files;

    if (!metadataStr) {
      return res.status(400).json({ success: false, error: 'Metadata is required.' });
    }
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded.' });
    }

    let metadata;
    try {
      metadata = JSON.parse(metadataStr);
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Invalid metadata format.' });
    }

    if (!Array.isArray(metadata) || metadata.length === 0) {
      return res.status(400).json({ success: false, error: 'Metadata must be a non-empty array.' });
    }

    // Filter files: detect type automatically, skip mp4 silently, reject other unsupported formats
    const validImages = [];
    for (const file of files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const mime = (file.mimetype || '').toLowerCase();

      // Check if it's an MP4 video (skip silently)
      if (ext === '.mp4' || mime === 'video/mp4') {
        logger.info(`Skipping MP4 file silently: ${file.originalname}`);
        continue;
      }

      // Check if it's a supported format (JPG, JPEG, PNG, WEBP, GIF)
      const isSupported = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ||
                          ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime);

      if (!isSupported) {
        logger.warn(`Unsupported file format rejected: ${file.originalname}`);
        return res.status(400).json({
          success: false,
          error: `Unsupported file format: ${file.originalname}. Only JPG, PNG, WEBP, and GIF are supported.`
        });
      }

      validImages.push(file);
    }

    if (validImages.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid image files detected in the uploaded folder.' });
    }

    // Validation loop
    const WEIGHT_REGEX = /^\d+(\.\d+)?g$/;
    for (let i = 0; i < metadata.length; i++) {
      const entry = metadata[i];
      if (!entry.title) {
        return res.status(400).json({ success: false, error: `Row ${i + 1}: Title is required.` });
      }
      if (!entry.category) {
        return res.status(400).json({ success: false, error: `Row ${i + 1}: Category is required.` });
      }
      if (!entry.weight) {
        return res.status(400).json({ success: false, error: `Row ${i + 1}: Weight is required.` });
      }
      if (!WEIGHT_REGEX.test(entry.weight)) {
        return res.status(400).json({ success: false, error: `Row ${i + 1}: Weight must be in grams (e.g., 30g).` });
      }
      if (!entry.description) {
        return res.status(400).json({ success: false, error: `Row ${i + 1}: Description is required.` });
      }
    }

    const categoryFolderMap = {
      RING: 'rings', NECK: 'necklaces', EARR: 'earrings',
      BANG: 'bangles', BRAC: 'bracelets', PEND: 'pendants',
      ANKL: 'anklets', MAAG: 'maang-tikka', SETT: 'bridal'
    };

    try {
      const productsPath = path.join(__dirname, 'data', 'products.json');
      let existingProducts = [];
      if (fs.existsSync(productsPath)) {
        existingProducts = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
      }

      const sessionPrefix = crypto.randomBytes(4).toString('hex') + '-';
      const newProducts = [];
      const nowStr = new Date().toISOString();

      for (let i = 0; i < metadata.length; i++) {
        const entry = metadata[i];
        
        // Find corresponding file matching entry.image index or filename (ignoring extensions)
        const file = validImages.find(f => {
          const nameOrig = path.basename(f.originalname, path.extname(f.originalname)).toLowerCase();
          const nameMeta = path.basename(entry.image, path.extname(entry.image)).toLowerCase();
          return nameOrig === nameMeta;
        }) || validImages[i];

        if (!file) {
          return res.status(400).json({ success: false, error: `Missing file matching row ${i + 1} (${entry.image}).` });
        }

        let outputBuffer = file.buffer;
        let finalExt = '.webp';

        try {
          const sharp = require('sharp');
          // Sharp converts the input buffer to WebP at quality 80.
          // This satisfies both:
          // 1. Convert to webp if not webp
          // 2. Compress image if already webp
          outputBuffer = await sharp(file.buffer)
            .webp({ quality: 80 })
            .toBuffer();
        } catch (err) {
          logger.error(`Image conversion failed for ${file.originalname}, falling back to original`, { error: err.message });
          // If conversion fails, keep original file extension and original buffer
          finalExt = path.extname(file.originalname).toLowerCase();
          outputBuffer = file.buffer;
        }

        const categoryFolder = categoryFolderMap[entry.category.toUpperCase()] || entry.category.toLowerCase() + 's';
        const targetDir = path.join(__dirname, 'uploads', categoryFolder);

        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        const baseSeqName = String(i + 1).padStart(2, '0');
        const finalFileName = `${sessionPrefix}${baseSeqName}${finalExt}`;
        const filePath = path.join(targetDir, finalFileName);

        // Save file to disk
        fs.writeFileSync(filePath, outputBuffer);

        const prdId = 'prd-dyn-' + finalFileName.replace(/\.[^/.]+$/, "") + '-' + crypto.randomBytes(4).toString('hex');
        const prdCode = baseSeqName + '-' + crypto.randomBytes(2).toString('hex').toUpperCase();
        const prdName = entry.title;

        const categoryLabels = {
          RING: 'Rings', NECK: 'Necklaces', EARR: 'Earrings',
          BANG: 'Bangles', BRAC: 'Bracelets', PEND: 'Pendants',
          ANKL: 'Anklets', MAAG: 'Maang Tikka', SETT: 'Bridal Set'
        };
        const categoryLabel = categoryLabels[entry.category.toUpperCase()] || entry.category;

        const productObj = {
          id: prdId,
          code: prdCode,
          name: prdName,
          collectionId: 'col-002', // Contemporary Daily
          collectionName: 'Contemporary Daily',
          category: entry.category.toUpperCase(),
          categoryLabel: categoryLabel,
          material: 'Gold',
          purity: '22 Karat',
          weight: entry.weight,
          price: 0,
          description: entry.description,
          type: entry.type || '',
          images: [`/uploads/${categoryFolder}/${finalFileName}`],
          status: 'active',
          uploadedAt: nowStr,
          searchKeywords: [prdName.toLowerCase(), prdCode.toLowerCase(), categoryLabel.toLowerCase()]
        };

        newProducts.push(productObj);
      }

      const updated = [...existingProducts, ...newProducts];
      fs.writeFileSync(productsPath, JSON.stringify(updated, null, 2), 'utf-8');
      productsData = updated;

      logger.audit('bulk_upload_folder_admin', {
        adminId: req.user.sub,
        count: newProducts.length
      });

      res.json({
        success: true,
        count: newProducts.length
      });
    } catch (err) {
      logger.error('Failed processing bulk folder upload', { error: err.message });
      res.status(500).json({ success: false, error: 'Failed to process bulk upload.' });
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════════
// TOKEN-BASED ACCESS SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

/**
 * ── Token Data Helpers ──────────────────────────────────────────────────────
 */
function readTokenRequests() {
  try {
    if (!fs.existsSync(TOKEN_REQUESTS_PATH)) {
      fs.writeFileSync(TOKEN_REQUESTS_PATH, '[]', 'utf-8');
      return [];
    }
    return JSON.parse(fs.readFileSync(TOKEN_REQUESTS_PATH, 'utf-8'));
  } catch (err) {
    logger.error('Error reading token-requests.json', { error: err.message });
    return [];
  }
}

function writeTokenRequests(data) {
  try {
    fs.writeFileSync(TOKEN_REQUESTS_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    logger.error('Error writing token-requests.json', { error: err.message });
    return false;
  }
}

function readTokens() {
  try {
    if (!fs.existsSync(TOKENS_PATH)) {
      fs.writeFileSync(TOKENS_PATH, '[]', 'utf-8');
      return [];
    }
    return JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));
  } catch (err) {
    logger.error('Error reading tokens.json', { error: err.message });
    return [];
  }
}

function writeTokens(data) {
  try {
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    logger.error('Error writing tokens.json', { error: err.message });
    return false;
  }
}

/**
 * Generate a unique, human-readable access token.
 * Format: KJWH-XXXX-XXXX-XXXX  (prefix + 3 groups of 4 uppercase hex chars)
 * Collision-resistant: 3 × 4 hex chars = 48 bits of entropy.
 */
function generateDealerToken() {
  const g = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `KJWH-${g()}${g()}-${g()}${g()}-${g()}${g()}`;
}

/**
 * Hash a plain-text dealer token with SHA-256 for secure storage.
 * Comparison is always done on hashed values.
 */
function hashToken(plainToken) {
  return crypto.createHash('sha256').update(plainToken).digest('hex');
}

/**
 * Mask a token for safe display: KJWH-****-****-ABCD
 */
function maskToken(plainToken) {
  const parts = plainToken.split('-');
  if (parts.length < 4) return '****-****-****';
  return `${parts[0]}-****-****-${parts[3]}`;
}

/**
 * Find the active token record for a dealer.
 */
function findActiveToken(dealerId) {
  const tokens = readTokens();
  const now    = new Date();
  return tokens.find(t =>
    t.dealerId === dealerId &&
    t.status   === 'active' &&
    new Date(t.expiresAt) > now
  ) || null;
}

// ── Route 1: POST /api/dealer/request-token ──────────────────────────────────
// Dealers submit a token access request after registration.
// Creates a "pending" record that admin can approve/reject.
app.post('/api/dealer/request-token', authLimiter, verifyToken, requireJSON, (req, res) => {
  const { message } = req.body; // Optional dealer message to admin
  const userId = req.user.sub;
  const userEmail = req.user.email;

  // Only dealers can request tokens
  if (req.user.role !== 'dealer') {
    return res.status(403).json({ success: false, error: 'Only dealer accounts can request access tokens.' });
  }

  // Check for existing active token
  const existingActiveToken = findActiveToken(userId);
  if (existingActiveToken) {
    return res.status(409).json({ success: false, error: 'You already have an active access token. Check your dealer dashboard.' });
  }

  // Check for existing pending request
  const tokenRequests = readTokenRequests();
  const hasPending = tokenRequests.some(r => r.userId === userId && r.status === 'pending');
  if (hasPending) {
    return res.status(409).json({ success: false, error: 'You already have a pending token request. Please wait for admin approval.' });
  }

  // Fetch user details
  const users = readUsers();
  const user  = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User account not found.' });
  }

  const requestId = 'treq-' + crypto.randomBytes(8).toString('hex').toUpperCase();
  const newRequest = {
    id:          requestId,
    userId:      userId,
    email:       userEmail,
    name:        user.name,
    businessName: user.businessName || user.name,
    city:        user.city || '',
    state:       user.state || '',
    phone:       user.phone || '',
    message:     typeof message === 'string' ? message.substring(0, 500) : '',
    status:      'pending',
    requestedAt: new Date().toISOString(),
    processedAt: null,
    processedBy: null,
    tokenId:     null,
    rejectionReason: null,
  };

  tokenRequests.push(newRequest);
  writeTokenRequests(tokenRequests);

  logger.info('Token access request submitted', { userId, requestId });

  return res.json({
    success:   true,
    requestId: requestId,
    message:   'Your token request has been submitted. You will be notified once an admin reviews it.'
  });
});

// ── Route 2: POST /api/dealer/token-login ────────────────────────────────────
// Dealers authenticate using email + access token (no password required).
// Returns a JWT session on success, allowing access to the product catalogue.
app.post('/api/dealer/token-login', authLimiter, requireJSON, (req, res) => {
  const { email, accessToken } = req.body;

  if (!email || !accessToken) {
    return res.status(400).json({ success: false, error: 'Email and access token are required.' });
  }
  if (typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email format.' });
  }
  if (typeof accessToken !== 'string' || accessToken.length > 25) {
    return res.status(400).json({ success: false, error: 'Invalid access token format.' });
  }

  const inputEmail = email.trim().toLowerCase();
  const users      = readUsers();
  const user       = users.find(u => u.email.toLowerCase() === inputEmail && u.role === 'dealer');

  if (!user) {
    logger.security('token_login_user_not_found', { ip: req.ip, email: inputEmail });
    return res.status(401).json({ success: false, error: 'Invalid email or access token.' });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({ success: false, error: 'suspended' });
  }
  if (user.status === 'paused') {
    return res.status(403).json({ success: false, error: 'paused' });
  }

  // Find active token record for this dealer
  const tokens      = readTokens();
  const now         = new Date();
  const tokenRecord = tokens.find(t =>
    t.dealerId === user.id &&
    t.status   === 'active' &&
    new Date(t.expiresAt) > now
  );

  if (!tokenRecord) {
    logger.auth('token_login_no_active_token', { ip: req.ip, email: inputEmail });
    return res.status(401).json({ success: false, error: 'no_active_token' });
  }

  // Timing-safe token comparison (compare hashes to prevent timing attacks)
  const inputHash    = hashToken(accessToken.trim().toUpperCase());
  const expectedHash = tokenRecord.tokenHash;

  let isValid = false;
  try {
    const inputBuf    = Buffer.from(inputHash, 'hex');
    const expectedBuf = Buffer.from(expectedHash, 'hex');
    if (inputBuf.length === expectedBuf.length) {
      isValid = crypto.timingSafeEqual(inputBuf, expectedBuf);
    }
  } catch (_) {
    isValid = false;
  }

  if (!isValid) {
    logger.security('token_login_invalid_token', { ip: req.ip, email: inputEmail, dealerId: user.id });
    return res.status(401).json({ success: false, error: 'Invalid email or access token.' });
  }

  // Issue a JWT session
  const sessionId = 'sess-' + crypto.randomBytes(16).toString('hex').toUpperCase();
  const accessTokenPayload = {
    sub:        user.id,
    email:      user.email,
    role:       user.role,
    tokenAccess: true,       // Flag: authenticated via access token
    sid:        sessionId,
    iat:        Math.floor(Date.now() / 1000),
    exp:        Math.floor(Date.now() / 1000) + (8 * 3600)
  };
  const jwtToken = jwt.sign(accessTokenPayload, CONFIG.JWT_SECRET);

  const refreshTokenPayload = {
    sub:   user.id,
    email: user.email,
    role:  user.role,
    type:  'refresh',
    iat:   Math.floor(Date.now() / 1000),
    exp:   Math.floor(Date.now() / 1000) + (7 * 24 * 3600)
  };
  const refreshJwt = jwt.sign(refreshTokenPayload, CONFIG.REFRESH_TOKEN_SECRET);

  const session = {
    id:          user.id,
    name:        user.name,
    email:       user.email,
    role:        user.role,
    avatar:      user.avatar || user.name.substring(0, 2).toUpperCase(),
    status:      user.status,
    tokenAccess: true,
    tokenExpiresAt: tokenRecord.expiresAt,
    sessionId,
    loginAt:     new Date().toISOString(),
    expiresAt:   new Date(Date.now() + 8 * 3600000).toISOString()
  };

  // Update last login
  user.lastLogin = session.loginAt;
  writeUsers(users);

  res.cookie('admin_token', jwtToken, {
    httpOnly: true,
    secure:   CONFIG.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge:   8 * 3600 * 1000,
    path:     '/'
  });

  logger.auth('token_login', { ip: req.ip, email: inputEmail, userId: user.id, sessionId });

  return res.json({
    success:      true,
    token:        jwtToken,
    refreshToken: refreshJwt,
    expiresIn:    8 * 3600,
    user:         session
  });
});

// ── Route 3: GET /api/dealer/token-status ────────────────────────────────────
// Dealer checks the status of their access token and any pending requests.
app.get('/api/dealer/token-status', verifyToken, (req, res) => {
  if (req.user.role !== 'dealer') {
    return res.status(403).json({ success: false, error: 'Dealer access only.' });
  }

  const userId       = req.user.sub;
  const tokens       = readTokens();
  const now          = new Date();
  const tokenRequests = readTokenRequests();

  const activeToken = tokens.find(t =>
    t.dealerId === userId &&
    t.status   === 'active' &&
    new Date(t.expiresAt) > now
  );

  const pendingRequest = tokenRequests.find(r => r.userId === userId && r.status === 'pending');
  const latestRequest  = [...tokenRequests]
    .filter(r => r.userId === userId)
    .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))[0];

  return res.json({
    success: true,
    hasActiveToken:   !!activeToken,
    hasPendingRequest: !!pendingRequest,
    token: activeToken ? {
      id:           activeToken.id,
      status:       activeToken.status,
      tier:         activeToken.tier,
      issuedAt:     activeToken.issuedAt,
      expiresAt:    activeToken.expiresAt,
      tokenPreview: activeToken.tokenPreview,
      daysRemaining: Math.max(0, Math.ceil((new Date(activeToken.expiresAt) - now) / 86400000))
    } : null,
    latestRequest: latestRequest ? {
      id:          latestRequest.id,
      status:      latestRequest.status,
      requestedAt: latestRequest.requestedAt,
      processedAt: latestRequest.processedAt,
      rejectionReason: latestRequest.rejectionReason,
    } : null
  });
});

// ── Route 4: GET /api/admin/token-requests ───────────────────────────────────
// Admin views all pending and historical token access requests.
app.get('/api/admin/token-requests', verifyToken, (req, res) => {
  const isAdmin = ['super_admin', 'admin', 'dealer_manager'].includes(req.user.role);
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Permission denied.' });
  }

  const { status, limit = 50, offset = 0 } = req.query;
  let requests = readTokenRequests();

  if (status) {
    requests = requests.filter(r => r.status === status);
  }

  // Sort by requestedAt descending
  requests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

  const limitNum  = Math.min(parseInt(limit,  10) || 50, 200);
  const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);
  const paginated = requests.slice(offsetNum, offsetNum + limitNum);

  return res.json({
    success: true,
    total:   requests.length,
    limit:   limitNum,
    offset:  offsetNum,
    requests: paginated
  });
});

// ── Route 5a: POST /api/admin/token-requests/:id/approve ────────────────────
// Admin approves a token request: generates a unique access token,
// stores it hashed, and records it in the token registry.
app.post('/api/admin/token-requests/:id/approve', verifyToken, requireJSON, (req, res) => {
  const isAdmin = ['super_admin', 'admin', 'dealer_manager'].includes(req.user.role);
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Permission denied.' });
  }

  const { validityDays = 365, tier = 'standard', note = '' } = req.body;
  const requestId   = req.params.id;
  const tokenRequests = readTokenRequests();
  const reqIdx      = tokenRequests.findIndex(r => r.id === requestId);

  if (reqIdx === -1) {
    return res.status(404).json({ success: false, error: 'Token request not found.' });
  }

  const tokenReq = tokenRequests[reqIdx];
  if (tokenReq.status !== 'pending') {
    return res.status(400).json({ success: false, error: 'Request has already been processed.' });
  }

  // Check for existing active token (prevent duplicate)
  const existingActive = findActiveToken(tokenReq.userId);
  if (existingActive) {
    return res.status(409).json({ success: false, error: 'This dealer already has an active token. Revoke it first.' });
  }

  // Generate a unique token (retry up to 5 times to guarantee uniqueness)
  let plainToken;
  const allTokens = readTokens();
  for (let i = 0; i < 5; i++) {
    const candidate = generateDealerToken();
    const candidateHash = hashToken(candidate);
    if (!allTokens.some(t => t.tokenHash === candidateHash)) {
      plainToken = candidate;
      break;
    }
  }

  if (!plainToken) {
    logger.error('Failed to generate unique dealer token after 5 attempts');
    return res.status(500).json({ success: false, error: 'Token generation failed. Please try again.' });
  }

  const tokenId  = 'tok-' + crypto.randomBytes(8).toString('hex').toUpperCase();
  const now      = new Date();
  const expiresAt = new Date(now.getTime() + (parseInt(validityDays, 10) || 365) * 86400000);

  // Store token record (hashed)
  const tokenRecord = {
    id:           tokenId,
    dealerId:     tokenReq.userId,
    dealerEmail:  tokenReq.email,
    dealerName:   tokenReq.name,
    businessName: tokenReq.businessName,
    tokenHash:    hashToken(plainToken),
    tokenPreview: maskToken(plainToken),
    tier:         tier,
    status:       'active',
    issuedAt:     now.toISOString(),
    expiresAt:    expiresAt.toISOString(),
    issuedBy:     req.user.sub,
    note:         typeof note === 'string' ? note.substring(0, 300) : '',
    requestId:    requestId,
  };
  allTokens.push(tokenRecord);
  writeTokens(allTokens);

  // Update the token request record
  tokenReq.status      = 'approved';
  tokenReq.processedAt = now.toISOString();
  tokenReq.processedBy = req.user.sub;
  tokenReq.tokenId     = tokenId;
  writeTokenRequests(tokenRequests);

  // Also update users.json to mark dealer as token-approved
  const users = readUsers();
  const userIdx = users.findIndex(u => u.id === tokenReq.userId);
  if (userIdx !== -1) {
    users[userIdx].tokenApproved = true;
    users[userIdx].tokenApprovedAt = now.toISOString();
    writeUsers(users);
  }

  logger.audit('token_request_approved', {
    adminId:  req.user.sub,
    dealerId: tokenReq.userId,
    tokenId,
    requestId,
    expiresAt: expiresAt.toISOString()
  });

  // Return the plain token ONCE — never stored in plain text
  return res.json({
    success:      true,
    tokenId,
    plainToken,                    // Show only on approval response — never stored
    tokenPreview: maskToken(plainToken),
    tier,
    expiresAt:    expiresAt.toISOString(),
    message:      `Token issued for ${tokenReq.businessName}. Share this token securely with the dealer — it cannot be retrieved again.`
  });
});

// ── Route 5b: POST /api/admin/token-requests/:id/reject ─────────────────────
// Admin rejects a token request with an optional reason.
app.post('/api/admin/token-requests/:id/reject', verifyToken, requireJSON, (req, res) => {
  const isAdmin = ['super_admin', 'admin', 'dealer_manager'].includes(req.user.role);
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Permission denied.' });
  }

  const { reason = '' } = req.body;
  const requestId     = req.params.id;
  const tokenRequests = readTokenRequests();
  const reqIdx        = tokenRequests.findIndex(r => r.id === requestId);

  if (reqIdx === -1) {
    return res.status(404).json({ success: false, error: 'Token request not found.' });
  }

  const tokenReq = tokenRequests[reqIdx];
  if (tokenReq.status !== 'pending') {
    return res.status(400).json({ success: false, error: 'Request has already been processed.' });
  }

  tokenReq.status          = 'rejected';
  tokenReq.processedAt     = new Date().toISOString();
  tokenReq.processedBy     = req.user.sub;
  tokenReq.rejectionReason = typeof reason === 'string' ? reason.substring(0, 500) : '';
  writeTokenRequests(tokenRequests);

  logger.audit('token_request_rejected', {
    adminId:   req.user.sub,
    dealerId:  tokenReq.userId,
    requestId,
    reason:    tokenReq.rejectionReason
  });

  return res.json({ success: true, message: 'Token request rejected.' });
});

// ── Route 6: POST /api/admin/tokens/revoke/:dealerId ─────────────────────────
// Admin revokes all active tokens for a specific dealer.
app.post('/api/admin/tokens/revoke/:dealerId', verifyToken, (req, res) => {
  const isAdmin = ['super_admin', 'admin', 'dealer_manager'].includes(req.user.role);
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Permission denied.' });
  }

  const { dealerId } = req.params;
  const { reason = '' } = req.body || {};
  const tokens      = readTokens();
  const now         = new Date();

  let revokedCount = 0;
  tokens.forEach(t => {
    if (t.dealerId === dealerId && t.status === 'active') {
      t.status     = 'revoked';
      t.revokedAt  = now.toISOString();
      t.revokedBy  = req.user.sub;
      t.revokeReason = typeof reason === 'string' ? reason.substring(0, 300) : '';
      revokedCount++;
    }
  });

  writeTokens(tokens);

  // Update users.json
  const users   = readUsers();
  const userIdx = users.findIndex(u => u.id === dealerId);
  if (userIdx !== -1) {
    users[userIdx].tokenApproved = false;
    writeUsers(users);
  }

  logger.audit('token_revoked', {
    adminId:  req.user.sub,
    dealerId,
    revokedCount,
    reason
  });

  return res.json({
    success:      true,
    revokedCount,
    message:      `${revokedCount} token(s) revoked for dealer ${dealerId}.`
  });
});

// ── Route 7: GET /api/admin/tokens ───────────────────────────────────────────
// Admin views the full token registry.
app.get('/api/admin/tokens', verifyToken, (req, res) => {
  const isAdmin = ['super_admin', 'admin', 'dealer_manager'].includes(req.user.role);
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Permission denied.' });
  }

  const { status, limit = 100, offset = 0 } = req.query;
  let tokens = readTokens();

  if (status) tokens = tokens.filter(t => t.status === status);

  tokens.sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));

  const limitNum  = Math.min(parseInt(limit, 10)  || 100, 500);
  const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);
  const now       = new Date();

  // Add computed fields (never return tokenHash)
  const safeTokens = tokens.slice(offsetNum, offsetNum + limitNum).map(t => ({
    id:           t.id,
    dealerId:     t.dealerId,
    dealerEmail:  t.dealerEmail,
    dealerName:   t.dealerName,
    businessName: t.businessName,
    tokenPreview: t.tokenPreview,
    tier:         t.tier,
    status:       t.status,
    issuedAt:     t.issuedAt,
    expiresAt:    t.expiresAt,
    issuedBy:     t.issuedBy,
    revokedAt:    t.revokedAt || null,
    daysRemaining: t.status === 'active'
      ? Math.max(0, Math.ceil((new Date(t.expiresAt) - now) / 86400000))
      : 0,
  }));

  return res.json({
    success: true,
    total:   tokens.length,
    tokens:  safeTokens
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PROTECTED API ENDPOINTS (examples for future use)
// ══════════════════════════════════════════════════════════════════════════════

// Example protected endpoint pattern:
// app.get('/api/admin/users', verifyToken, requirePermission('admin.manage_users'), (req, res) => { ... });

// GET /api/admin/session — Verify current session and return user info
app.get('/api/admin/session', verifyToken, (req, res) => {
  res.json({
    success: true,
    user: {
      id:    req.user.sub,
      email: req.user.email,
      role:  req.user.role
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// STATIC FILE SERVING
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// STATIC FILE SERVING
// ══════════════════════════════════════════════════════════════════════════════

const adminStatic = express.static(path.join(__dirname, 'admin'), {
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
  }
});

// ── 8. /admin gating middleware + admin static serving ─────────────────
app.use('/admin', (req, res, next) => {
  // Get token from cookie or authorization header
  const token = req.cookies.admin_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : null);

  // If requesting the base route itself (/admin)
  if (req.path === '/' || req.path === '') {
    if (token) {
      try {
        jwt.verify(token, CONFIG.JWT_SECRET);
        return res.redirect('/admin/dashboard.html');
      } catch (_) {}
    }
    return res.sendFile(path.join(__dirname, 'admin', 'admin-access.html'));
  }

  // Gating for sub-assets (e.g. /dashboard.html, /dealer-list.html)
  if (!token) {
    return res.redirect('/admin');
  }

  try {
    const payload = jwt.verify(token, CONFIG.JWT_SECRET);
    if (!['super_admin', 'admin', 'catalogue_manager', 'dealer_manager', 'analytics_viewer'].includes(payload.role)) {
      return res.redirect('/admin');
    }
    req.user = payload;
    adminStatic(req, res, next);
  } catch (err) {
    return res.redirect('/admin');
  }
});

const dealerStatic = express.static(path.join(__dirname, 'dealer'), {
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
  }
});

// ── 9. /dealer gating middleware + dealer static serving ─────────────────────
app.use('/dealer', (req, res, next) => {
  // If requesting token-verify.html, let it pass through to the static handler
  if (req.path === '/token-verify.html') {
    return dealerStatic(req, res, next);
  }

  const token = req.cookies.admin_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.substring(7) : null);

  // If requesting base /dealer or /dealer/
  if (req.path === '/' || req.path === '') {
    if (token) {
      try {
        const payload = jwt.verify(token, CONFIG.JWT_SECRET);
        if (payload.role === 'dealer') {
          return res.redirect('/dealer/dashboard.html');
        }
      } catch (_) {}
    }
    return res.redirect('/login.html');
  }

  if (!token) {
    return res.redirect('/login.html');
  }

  try {
    const payload = jwt.verify(token, CONFIG.JWT_SECRET);
    if (payload.role !== 'dealer') {
      return res.redirect('/login.html');
    }
    req.user = payload;
    dealerStatic(req, res, next);
  } catch (err) {
    return res.redirect('/login.html');
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ══════════════════════════════════════════════════════════════════════════════

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found.' });
});

// Global error handler
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method
  });

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'File too large. Maximum size is 5 MB.' });
  }

  res.status(500).json({
    success: false,
    error: CONFIG.NODE_ENV === 'production' ? 'Internal server error.' : err.message
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// START SERVER
// ══════════════════════════════════════════════════════════════════════════════

app.listen(CONFIG.PORT, () => {
  serverReady = true;
  const startupDuration = Date.now() - serverStartTime;
  console.timeEnd('startup');

  logger.info('Server started', {
    port: CONFIG.PORT,
    environment: CONFIG.NODE_ENV,
    startup_ms: startupDuration,
    adminEmail: CONFIG.SUPER_ADMIN_EMAIL,
    productsLoaded: productsData.length
  });

  console.log('=================================================');
  console.log(` Koshda B2B Platform server listening on port ${CONFIG.PORT}`);
  console.log(` Local URL: http://localhost:${CONFIG.PORT}`);
  console.log(` Environment: ${CONFIG.NODE_ENV}`);
  console.log(` Products loaded: ${productsData.length}`);
  console.log(` Startup time: ${startupDuration}ms`);
  console.log('=================================================');
});
