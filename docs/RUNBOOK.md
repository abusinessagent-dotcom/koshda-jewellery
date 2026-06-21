# Incident Response Runbook — Koshda B2B Jewellery Platform

This runbook describes protocols for troubleshooting and mitigating issues during system incidents.

---

## 🚨 Incident 1: Application Server is Down (502 Bad Gateway / 503 Service Unavailable)

If Nginx returns a 502 or 503 error, the Express backend is not running or unreachable.

### 1. Check PM2 process status:
```bash
pm2 status
```
If the process `koshda-api` has a status of `errored` or `stopped`:
```bash
pm2 restart koshda-api
```

### 2. Inspect application startup logs:
If restarting fails immediately, check for syntax or environment configuration errors:
```bash
pm2 logs koshda-api --lines 100
```
*Common issues include missing variables in the `.env` file or database/file access permission blocks.*

### 3. Check Systemd/Nginx:
If PM2 shows the app is online on port 3000 but the browser still gets a 502:
```bash
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```
Restart Nginx:
```bash
sudo systemctl restart nginx
```

---

## 💾 Incident 2: Data Loss or Corruption (Backup Restore Procedure)

In case a JSON file in `backend/data` is corrupted, follow these steps to restore data from the last daily backup.

### 1. Stop the application process:
```bash
pm2 stop koshda-api
```

### 2. Locate the desired backup folder:
List available backups sorted by date:
```bash
ls -la /var/www/jewellery-platform/backups/
```

### 3. Restore the JSON data:
Rename the current corrupt data folder (as a safety measure) and copy the backup files:
```bash
cd /var/www/jewellery-platform/backend
mv data data_corrupt_backup

# Recreate directory and copy files
mkdir data
cp /var/www/jewellery-platform/backups/backup_YYYY-MM-DD_HH-MM-SS/*.json ./data/
```

### 4. Restart the server and verify status:
```bash
pm2 start koshda-api
pm2 logs koshda-api
```

---

## 🔒 Incident 3: Admin Lockout (Too Many Login Attempts)

If an administrator gets blocked due to brute-force protection (Rate Limits: 429 status code):

### 1. Temporary Lockout (15 minutes):
Wait for 15 minutes. The block is in-memory and will automatically expire.

### 2. Manual Clear / Force Bypass (Immediate):
If you cannot wait, restart the application process to clear the in-memory block tracking Map (`failedAccessAttempts`):
```bash
pm2 reload koshda-api
```
*(This resets the in-memory failure counter immediately).*

---

## 🔧 Incident 4: High CPU or Memory Usage

If server performance degrades or PM2 restarts the process due to exceeding memory limits:

### 1. Check system metrics:
Identify if node is hogging resources:
```bash
pm2 monit
```

### 2. Check for infinite loops or large JSON payloads:
Filter the logs for slow requests:
```bash
tail -n 200 /var/www/jewellery-platform/logs/combined-*.log | grep -i warn
```

### 3. Soft Reload:
A zero-downtime reload can free memory without dropping active connections:
```bash
pm2 reload koshda-api
```
