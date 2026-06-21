# Security Guide — Koshda B2B Jewellery Platform

This document describes the security controls, protocols, and best practices implemented to harden the Koshda B2B platform.

---

## 🔐 1. Authentication & Session Management

- **JWT Tokens:** The platform uses JSON Web Tokens (JWT) signed with a HS256 algorithm using the `JWT_SECRET` key.
  - Access Token lifetime: **8 hours** (expiring session).
  - Refresh Token lifetime: **7 days** (stored locally for dealers, used to fetch a new access token).
- **HTTP-Only Cookies:** For web administration screens, access tokens are persisted via `admin_token` cookies with:
  - `httpOnly: true` (prevents cross-site scripting/XSS data theft).
  - `secure: true` (strictly transmitted over HTTPS).
  - `sameSite: 'Strict'` (mitigates Cross-Site Request Forgery/CSRF).
- **Token Blacklisting:** Revoked tokens (resulting from a logout event) are stored in an in-memory `tokenBlacklist` Set to block usage before their expiration time.

---

## 🛡️ 2. Admin Gate Security (HMAC timing-safe checks)

To gain access to administrative dashboards:
1. Users must navigate to the dynamic secret path defined by `ADMIN_SECRET_PATH`.
2. Accessing this path serves `admin-access.html` which prompts the user for the `ADMIN_SECRET_CODE`.
3. Validation uses timing-safe HMAC checks:
   - The user input code and the system config code are hashed using `HMAC_KEY_MATERIAL`.
   - The outputs are evaluated via Node's `crypto.timingSafeEqual()`.
   - This prevents side-channel timing analysis attacks that attempt to guess the key length or content.

---

## 🚫 3. Rate Limiting & Brute Force Protection

The server implements a multi-tier rate limiting mechanism:
- **Auth Endpoint Limiter:** `/verify-admin-access`, `/api/auth/login`, and `/api/auth/register` are capped at **5 requests per 15 minutes** per IP address.
  - Exceeding the limits results in an automated **15-minute block** on that IP address.
- **Config Endpoint Limiter:** `/api/config` is capped at **30 requests per minute** per IP.
- **General API Limiter:** General API requests are restricted to **100 requests per minute** per IP to prevent Denials of Service (DoS).

---

## 📝 4. Input Sanitization & Content Security Policy (CSP)

- **Helmet Security Headers:** Configured to strip branding (`X-Powered-By`) and enforce browser policy protections.
- **Strict Content Security Policy (CSP):**
  ```javascript
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      imgSrc:     ["'self'", "data:", "blob:", "https:", "https://placehold.co"],
      connectSrc: ["'self'"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com"],
      objectSrc:  ["'none'"],
      frameSrc:   ["'none'"]
    }
  }
  ```

---

## 🔄 5. Key Rotation & Maintenance

It is recommended to rotate credentials every **90 days**.

### Command to generate secure 256-bit keys:
```bash
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

Rotate the following values inside `.env` and restart the PM2 processes:
1. `JWT_SECRET`
2. `REFRESH_TOKEN_SECRET`
3. `HMAC_KEY_MATERIAL`
4. `ADMIN_SECRET_CODE`
5. `ADMIN_SECRET_PATH`
