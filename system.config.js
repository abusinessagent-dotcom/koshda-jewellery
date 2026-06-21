module.exports = {
  apps: [
    {
      name: 'koshda-api',
      script: 'server.js',
      instances: 'max',          // Cluster mode: use all available CPU cores
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '512M', // Auto-restart if memory leaks exceed 512MB
      restart_delay: 3000,        // Wait 3 seconds before restarting a crashed app
      max_restarts: 10,           // Don't restart endlessly if startup fails
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      merge_logs: true,
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
