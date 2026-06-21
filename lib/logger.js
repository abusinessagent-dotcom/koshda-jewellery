/**
 * Koshda B2B Platform — Structured Logging Module
 * Winston-based logger with console + file transports.
 * JSON format for production, colourized console for development.
 *
 * Log files:
 *   logs/auth.log   — Authentication events
 *   logs/error.log  — API and system errors
 *   logs/audit.log  — Admin actions audit trail
 *   logs/combined.log — All logs combined
 */

const winston = require('winston');
const path = require('path');

// Lazy-require rotate transport (only when file logging is needed)
let DailyRotateFile;
try {
  DailyRotateFile = require('winston-daily-rotate-file');
} catch (_) {
  // Not fatal — file rotation simply won't be available
}

const LOG_DIR = path.join(__dirname, '..', 'logs');

// ── Custom format: JSON with timestamp ──────────────────────────────────────
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// ── Build transports ────────────────────────────────────────────────────────
const transports = [
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.LOG_LEVEL || 'info'
  })
];

// Add file transports only if DailyRotateFile is available
if (DailyRotateFile) {
  // Combined log (all levels)
  transports.push(
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '7d',
      format: jsonFormat,
      level: 'info'
    })
  );

  // Error log
  transports.push(
    new DailyRotateFile({
      dirname: LOG_DIR,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '14d',
      format: jsonFormat,
      level: 'error'
    })
  );
}

// ── Create logger ───────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'koshda-b2b' },
  transports,
  exitOnError: false
});

// ── Convenience helpers ─────────────────────────────────────────────────────

/**
 * Log an authentication event.
 * @param {'login'|'logout'|'verify_secret'|'token_refresh'|'login_failed'} event
 * @param {object} context - { email, ip, success, sessionId, duration_ms, ... }
 */
logger.auth = function (event, context = {}) {
  this.info(`[AUTH] ${event}`, { event, ...context });
};

/**
 * Log a security violation.
 * @param {string} event - e.g. 'rate_limit', 'invalid_token', 'csrf_violation'
 * @param {object} context
 */
logger.security = function (event, context = {}) {
  this.warn(`[SECURITY] ${event}`, { event, severity: 'security', ...context });
};

/**
 * Log an admin audit action.
 * @param {string} action - e.g. 'product_create', 'user_delete'
 * @param {object} context - { adminId, entity, details }
 */
logger.audit = function (action, context = {}) {
  this.info(`[AUDIT] ${action}`, { event: action, audit: true, ...context });
};

module.exports = logger;
