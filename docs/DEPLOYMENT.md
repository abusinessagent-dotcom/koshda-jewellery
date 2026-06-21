# CloudPanel & VPS Deployment Guide — Koshda B2B Jewellery Platform

This guide provides step-by-step instructions for deploying the **Koshda B2B Jewellery Platform** to a VPS running Ubuntu 22.04 LTS managed via **CloudPanel** (with standard Node.js App Support) or manually via PM2/Nginx.

> [!IMPORTANT]
> **Project Runtime Classification:**
> - **Backend:** Node.js (Express)
> - **Features:** JWT Authentication, Admin Gate Panel, Token System, and REST API routes (`/api/*`).
> - **Conclusion:** This is **not** a static website. It **must** run as a continuous Node.js application process.

---

## 🚨 Troubleshooting Main Problems

### 1. 502 Bad Gateway
- **Cause:** The Node.js application server is not running, crashed on startup, or is inaccessible on the configured port.
- **Troubleshooting:**
  - Check Node.js application logs in CloudPanel: `Logs` ➔ `Node App Logs`.
  - Verify that `npm install` was run successfully. Look out for `sharp` compilation errors.
  - Verify that the app is listening on the correct port (e.g., `3000`) matching your CloudPanel Site configuration.

### 2. "Not Secure" (SSL Issues)
- **Cause:** Let's Encrypt SSL certificate is missing, or the site is accessed via HTTP without redirecting to HTTPS.
- **Troubleshooting:**
  - Go to `CloudPanel` ➔ `Sites` ➔ `koshdajewelleryhouse.shop` ➔ `SSL/TLS`.
  - Ensure Let's Encrypt certificate is installed.
  - In `Settings`, enable `Force HTTPS` to ensure all HTTP requests redirect to HTTPS automatically.

### 3. Missing Environment Setup
- **Cause:** No `.env` file is present in the server's backend directory. The application fails validation on startup because default credentials/secrets are not allowed in production.
- **Troubleshooting:**
  - Create a `.env` file in the application directory.
  - Fill all required variables (see Step 4 below) with strong random secrets.

---

## 🚀 CloudPanel Step-by-Step Deployment

### Step 1: Install Node.js on the Server (if not installed)
Log in to your VPS via SSH as root and run:
```bash
apt update
apt install -y nodejs npm
```
Ensure you are using a stable LTS version:
```bash
node -v  # Recommended: >=18.x or 20.x
npm -v   # Recommended: >=9.x
```

### Step 2: Upload the Application Source
Upload the full application zip file (containing backend, public, config, etc.) and extract it. 
For a clean CloudPanel Node.js App setup, the files should be extracted to:
```bash
/home/nodeapp/backend
```

### Step 3: Install Dependencies
Navigate to the directory and run `npm install`:
```bash
cd /home/nodeapp/backend
npm install
```
> [!TIP]
> Running `npm install` directly on the destination Ubuntu OS ensures that native dependencies like `sharp` are compiled correctly for the local target platform, avoiding cross-OS module load crashes.

### Step 4: Create the Environment File
Create a `.env` file in the root of the app:
```bash
nano /home/nodeapp/backend/.env
```
Copy and fill in the following parameters with secure production secrets (do **not** leave default fallback values, as the server will detect them and exit immediately for safety):
```env
PORT=3000
NODE_ENV=production

# JWT/HMAC Security Credentials
JWT_SECRET=your_super_secret_key_hex
REFRESH_TOKEN_SECRET=your_refresh_secret_key_hex
HMAC_KEY_MATERIAL=random_hmac_hex_material

# Admin Gate Console Credentials
ADMIN_SECRET_PATH=your-secure-admin-console-path
ADMIN_SECRET_CODE=your_strong_admin_password

# Admin Settings Configuration
SUPER_ADMIN_EMAIL=admin@koshdajewelleryhouse.shop
CORS_ORIGINS=https://koshdajewelleryhouse.shop,https://www.koshdajewelleryhouse.shop
BEHIND_TLS=true
```

### Step 5: Configure CloudPanel Node.js Site
In the CloudPanel UI, create or configure a **Node.js App** site:
- **App Path:** `/home/nodeapp/backend`
- **Startup File:** `server.js`
- **Port:** `3000`

### Step 6: Restart Node Application
Whenever environment variables or backend files change:
- Go to `CloudPanel` ➔ `Sites` ➔ `koshdajewelleryhouse.shop`.
- Click the **Restart Node App** button in the dashboard.
- *Note:* Do **not** manually restart Nginx using `systemctl restart nginx` to start the Node app, as Nginx only acts as a reverse proxy.

### Step 7: Check Status and Logs
Verify operation:
- Access `CloudPanel` ➔ `Logs` ➔ `Node App Logs` to review startup logs.
- The server should log:
  ```text
  [info]: Server started {"adminEmail":"admin@koshdajewelleryhouse.shop","environment":"production","port":3000}
  ```

---

## 💾 Daily Backup Setup

To automate database backups using the internal backup script:
1. Open the crontab:
   ```bash
   crontab -e
   ```
2. Add a rule to execute the backup runner every day at 2:00 AM:
   ```text
   0 2 * * * /usr/bin/node /home/nodeapp/backend/scripts/backup-data.js >> /var/log/koshda-backup.log 2>&1
   ```

---

## 🔒 Post-Deployment Checklist
- [ ] Confirm `Force HTTPS` redirect is active.
- [ ] Verify access to the main dashboard: `https://koshdajewelleryhouse.shop`.
- [ ] Verify the Admin console using the secret URL path: `https://koshdajewelleryhouse.shop/admin-secret-path`.
- [ ] Verify that `/health` returns status `ok`:
  `curl -i https://koshdajewelleryhouse.shop/health`
