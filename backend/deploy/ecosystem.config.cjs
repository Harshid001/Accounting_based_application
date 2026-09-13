module.exports = {
  apps: [
    {
      name: 'firmdesk',
      script: 'dist/src/server.js',
      cwd: '/opt/firmdesk',
      node_args: '--max-old-space-size=1024',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      max_memory_restart: '1500M',
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/firmdesk/error.log',
      out_file: '/var/log/firmdesk/out.log',
      merge_logs: true,
      instances: 1,
      autorestart: true,
      watch: false,
    },
  ],
};
