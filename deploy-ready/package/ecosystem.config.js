/**
 * PM2 Ecosystem Configuration
 * For production deployment on cPanel/VPS
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 logs
 *   pm2 restart all
 *   pm2 save (to auto-start on reboot)
 */

module.exports = {
    apps: [
        {
            // Application name
            name: 'school-crm',
            script: './app.js',
            
            // Node environment
            env: {
                NODE_ENV: 'production',
            },

            // Instances to run (0 = number of CPUs)
            instances: 'max',
            exec_mode: 'cluster',

            // Resource limits
            max_memory_restart: '500M',
            instance_var: 'INSTANCE_ID',

            // Auto-restart settings
            max_restarts: 10,
            min_uptime: '10s',
            autorestart: true,

            // Watch mode (disable for production)
            watch: false,
            ignore_watch: [
                'node_modules',
                'logs',
                '.git',
                '.env',
                'permissions.json',
                'admin_credentials.json'
            ],

            // Logging
            error_file: './logs/error.log',
            out_file: './logs/out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

            // Graceful shutdown
            kill_timeout: 5000,
            wait_ready: true,
            listen_timeout: 3000,

            // Monitoring and health checks
            max_memory_restart: '1G',

            // Environment variables
            env: {
                NODE_ENV: 'production',
                PORT: 3000,
            }
        }
    ],

    // Cluster mode monitor
    monitor_interval: 5000,

    // Deploy configuration (optional)
    deploy: {
        production: {
            user: 'your_cpanel_user',
            host: 'your-domain.com',
            ref: 'origin/main',
            repo: 'git@github.com:your-username/school-crm.git',
            path: '/home/your_cpanel_user/my_school_app',
            'post-deploy': 'npm install && pm2 restart ecosystem.config.js --env production'
        }
    }
};
