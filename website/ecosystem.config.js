module.exports = {
  apps: [
    {
      name: 'cryptonix',
      script: 'build/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Restart policy
      max_restarts: 10,
      min_uptime: '10s',
      
      // Memory and CPU limits
      max_memory_restart: '1G',
      
      // Watch for changes (development)
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads'],
      
      // Environment variables
      env_file: '.env'
    }
  ],
  
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-vps-ip',
      ref: 'origin/main',
      repo: 'https://github.com/yourusername/cryptonix.git',
      path: '/var/www/cryptonix',
      'pre-deploy-local': '',
      'post-deploy': 'cd website && npm ci && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
