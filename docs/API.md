# API Documentation — Koshda B2B Jewellery Platform

This document describes all API endpoints exposed by the backend Express server.

---

## 🔐 1. Authentication & Access Gates

### POST `/verify-admin-access`
Verify the administrator secret key to generate an HTTP-Only secure access cookie.
- **Headers:** `Content-Type: application/json`
- **Body:**
  ```json
  {
    "code": "RAMNIWAS@9823"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJI...",
    "user": {
      "id": "adm-SUPERADMIN",
      "name": "Super Administrator",
      "email": "admin@koshda.in",
      "role": "super_admin",
      "sessionId": "sess-adm-...",
      "loginAt": "2026-06-20T18:00:00.000Z",
      "expiresAt": "2026-06-21T02:00:00.000Z"
    }
  }
  ```
- **Response (401 Unauthorized / 429 Too Many Requests):**
  ```json
  {
    "success": false,
    "error": "Incorrect secret access code. 4 attempt(s) remaining."
  }
  ```

### POST `/api/auth/register`
Register a new customer account (default role: `dealer`).
- **Body:**
  ```json
  {
    "email": "dealer@example.com",
    "password": "securepassword",
    "name": "Arjun Mehta",
    "businessName": "Mehta Jewellers",
    "phone": "9876543210",
    "city": "Mumbai",
    "state": "Maharashtra"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "expiresIn": 28800,
    "user": { ... }
  }
  ```

### POST `/api/auth/login`
Authenticate email and password credentials for dealers. (Admin logins must use `/verify-admin-access`).
- **Body:**
  ```json
  {
    "email": "dealer@example.com",
    "password": "securepassword"
  }
  ```
- **Response (200 OK):** Same structure as Register response.

### POST `/api/auth/refresh`
Get a new access token using a refresh token.
- **Body:**
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```

### POST `/api/auth/logout`
Revoke active session and clear client token cookies.

---

## 💎 2. Product Catalog Endpoints

### GET `/api/products`
Fetch the list of loaded jewellery products. Supports pagination and category filtering.
- **Query Parameters:**
  - `page`: Page number (default: `1`)
  - `limit`: Products per page (default: `20`)
  - `category`: Filter by category (e.g., `RING`, `NECK`)

### GET `/api/products/search`
Perform keywords and criteria searches in products description and identifiers.
- **Query Parameters:**
  - `q`: Search keyword.

---

## 🛠️ 3. Admin Product Management

### GET `/api/admin/dashboard-stats`
Fetch platform activity stats (products count, registered dealers, recent booking orders).
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "stats": {
      "totalProducts": 30,
      "pendingRequests": 2,
      "activeSessions": 5
    }
  }
  ```

### POST `/api/admin/products/bulk-upload`
Upload a CSV template to bulk upload product details.
- **Headers:** `Content-Type: multipart/form-data`
- **Files:** `file` (CSV file)

---

## 📱 4. Dealer Access Tokens

### POST `/api/dealer/request-token`
Submit a request to generate a temporary verification token link.
- **Body:**
  ```json
  {
    "dealerId": "dlr-123456",
    "purpose": "Device Access"
  }
  ```

### GET `/api/admin/token-requests`
Fetch pending and processed token request queues.
