/**
 * Production Configuration
 * For cPanel Hosting
 */

module.exports = {
    // Environment
    environment: 'production',
    
    // Server Configuration
    server: {
        port: process.env.PORT || 3000,
        host: '0.0.0.0',
        // Trust proxy in production (important for cPanel)
        trustProxy: process.env.TRUST_PROXY === 'true' || true,
    },

    // Database Configuration
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        database: process.env.DB_NAME,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        dialect: 'mysql',
        // Connection pool settings for production
        pool: {
            max: 10,
            min: 2,
            acquire: 30000,
            idle: 10000,
        },
        // Logging
        logging: process.env.LOG_LEVEL === 'debug' ? console.log : false,
        timezone: '+05:00', // Pakistan Standard Time
    },

    // JWT Configuration
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: '7d',
    },

    // CORS Configuration
    cors: {
        origin: [
            'https://yourdomain.com',
            'https://www.yourdomain.com',
        ],
        credentials: true,
        optionsSuccessStatus: 200,
    },

    // Express Configuration
    express: {
        // Body parser limits
        bodyLimit: '25mb',
        urlLimit: '25mb',
        // Static file serving
        cacheMaxAge: 86400000, // 1 day in milliseconds
        etag: true,
        lastModified: true,
    },

    // Security Configuration
    security: {
        // Rate limiting
        rateLimit: {
            windowMs: process.env.RATE_LIMIT_WINDOW_MS || 900000, // 15 minutes
            max: process.env.RATE_LIMIT_MAX_REQUESTS || 100, // requests per windowMs
        },
        // HSTS (HTTP Strict Transport Security)
        hsts: {
            maxAge: 31536000, // 1 year in seconds
            includeSubDomains: true,
            preload: true,
        },
        // Content Security Policy
        csp: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                fontSrc: ["'self'"],
                connectSrc: ["'self'"],
            },
        },
    },

    // Logging Configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || './logs/app.log',
        maxFiles: 5,
        maxSize: '10m',
    },

    // Email Configuration
    email: {
        smtp: {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true' || false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        },
        from: {
            email: process.env.SMTP_FROM_EMAIL,
            name: process.env.SMTP_FROM_NAME,
        },
    },

    // Feature Flags
    features: {
        pendingFeeReminders: process.env.PENDING_FEE_REMINDER_ENABLED === 'true',
        whatsappNotifications: process.env.WHATSAPP_ENABLED === 'true',
        studentEmailNotifications: true,
        leaveRequestEmails: true,
    },

    // Session Configuration
    session: {
        maxAge: process.env.SESSION_MAX_AGE || 3600000, // 1 hour
        storeType: 'memory', // Change to 'redis' if available on your host
    },
};
