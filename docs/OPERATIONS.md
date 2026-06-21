# Operations Guide — Koshda B2B Jewellery Platform

This guide outlines the routine tasks and maintenance procedures required to run the Koshda B2B platform securely and reliably.

---

## 📅 Maintenance Checklist

### 1. Daily Operations
- [ ] **Verify Backup Job:** Check that a new backup folder has been created in `backups/`.
- [ ] **Check Error Logs:** Scan PM2 error logs and backend logs for uncaught exceptions.
  ```bash
  pm2 logs koshda-api --lines 50
  tail -n 100 /var/log/koshda-backup.log
  ```
- [ ] **Review Health Metrics:** Access the `/health` endpoint and verify the server status is `'ok'`.

### 2. Weekly Operations
- [ ] **Disk Space Audit:** Ensure the VPS has at least 30% free disk space.
  ```bash
  df -h
  ```
- [ ] **Log Rotation Check:** Verify that logs are rotating properly and old logs are compressed.
- [ ] **Resource Utilization Check:** Check memory and CPU usage of the PM2 processes.
  ```bash
  pm2 monit
  ```

### 3. Monthly Operations
- [ ] **OS Security Updates:** Run system updates to keep packages current.
  ```bash
  sudo apt update && sudo apt upgrade -y
  ```
- [ ] **Backup Portability Test:** Download a copy of a backup from `backups/` and verify that the JSON files parse correctly in a test environment.
- [ ] **SSL Certificate Validation:** Ensure Certbot is successfully renewing SSL certificates.
  ```bash
  sudo certbot renew --dry-run
  ```

---

##  System Monitoring Commands

### Check Memory & CPU Status
```bash
free -h
top -b -n 1 | head -n 15
```

### Review Server Metrics API
The server exposes an internal `/metrics` endpoint (restricted to localhost or via internal networks).
```bash
curl http://localhost:3000/metrics
```
**Expected JSON output:**
```json
{
  "requests_total": 4122,
  "errors_total": 12,
  "uptime_ms": 86400000,
  "memory_usage_mb": 42.15,
  "memory_rss_mb": 84.6,
  "active_blacklisted_tokens": 3
}
```

### Log File Locations
- **Application logs:** `logs/combined-YYYY-MM-DD.log`
- **Application error logs:** `logs/error-YYYY-MM-DD.log`
- **PM2 Out logs:** `logs/pm2-out.log`
- **PM2 Error logs:** `logs/pm2-error.log`
- **Daily Backup logs:** `/var/log/koshda-backup.log`
