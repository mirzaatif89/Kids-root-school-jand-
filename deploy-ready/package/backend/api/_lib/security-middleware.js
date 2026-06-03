/**
 * Security Middleware for School CRM
 * Adds security headers, rate limiting, and input validation
 * 
 * Usage: Add this to backend/server.js after CORS setup:
 *   app.use(require('./api/_lib/security-middleware'));
 */

const express = require('express');

/**
 * Security headers middleware
 */
function securityHeaders(req, res, next) {
    // Content Security Policy - prevent XSS
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Needed for inline scripts in your app
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self'",
        "connect-src 'self' https:",
    ].join('; '));

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Feature policy
    res.setHeader('Permissions-Policy', [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()',
    ].join(', '));

    // HSTS - enforce HTTPS
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    next();
}

/**
 * Rate limiting middleware
 * Prevents brute force attacks
 */
class RateLimiter {
    constructor(windowMs = 900000, maxRequests = 100) {
        this.windowMs = windowMs; // 15 minutes
        this.maxRequests = maxRequests;
        this.requests = new Map();
    }

    middleware() {
        return (req, res, next) => {
            const key = req.ip || req.connection.remoteAddress;
            const now = Date.now();

            if (!this.requests.has(key)) {
                this.requests.set(key, []);
            }

            const timestamps = this.requests.get(key);
            
            // Remove old timestamps outside the window
            const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);
            this.requests.set(key, validTimestamps);

            // Check if limit exceeded
            if (validTimestamps.length >= this.maxRequests) {
                console.warn(`Rate limit exceeded for IP: ${key}`);
                return res.status(429).json({
                    error: 'Too many requests, please try again later'
                });
            }

            // Add current request timestamp
            validTimestamps.push(now);

            next();
        };
    }
}

/**
 * Input validation middleware
 * Prevents common injection attacks
 */
function validateInput(req, res, next) {
    // Check for suspicious patterns in query and body
    const suspiciousPatterns = [
        /<script[^>]*>.*?<\/script>/gi,        // Script tags
        /javascript:/gi,                        // JavaScript protocol
        /onerror\s*=/gi,                        // Event handlers
        /onclick\s*=/gi,
        /onload\s*=/gi,
        /union\s+select/gi,                     // SQL injection
        /drop\s+table/gi,
        /delete\s+from/gi,
        /insert\s+into/gi,
    ];

    const dataToCheck = {
        ...req.query,
        ...req.body,
        ...req.params,
    };

    for (const [key, value] of Object.entries(dataToCheck)) {
        if (typeof value === 'string') {
            for (const pattern of suspiciousPatterns) {
                if (pattern.test(value)) {
                    console.warn(`Suspicious input detected in ${key}: ${value.substring(0, 50)}`);
                    return res.status(400).json({
                        error: 'Invalid input detected'
                    });
                }
            }
        }
    }

    next();
}

/**
 * Helmet-like security headers
 */
function helmet(req, res, next) {
    // Disable powered-by header
    res.removeHeader('X-Powered-By');

    // Set additional headers
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    next();
}

/**
 * Logging middleware
 */
function requestLogger(req, res, next) {
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const timestamp = new Date().toISOString();
        const status = res.statusCode;
        const method = req.method;
        const url = req.originalUrl || req.url;

        // Color code based on status
        let statusColor = '200'; // Green
        if (status >= 300 && status < 400) statusColor = '300'; // Yellow
        if (status >= 400 && status < 500) statusColor = '400'; // Orange
        if (status >= 500) statusColor = '500'; // Red

        // Log format: [timestamp] METHOD URL - STATUS (duration ms)
        console.log(`${timestamp} ${method} ${url} - ${status} (${duration}ms)`);
    });

    next();
}

/**
 * Error handling middleware
 */
function errorHandler(err, req, res, next) {
    const timestamp = new Date().toISOString();
    const message = err.message || 'Unknown error';

    // Log error
    console.error(`[${timestamp}] ERROR: ${message}`);
    console.error(err.stack);

    // Default response
    let statusCode = 500;
    let response = {
        error: 'Internal server error',
        timestamp,
    };

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        response.error = 'Validation error';
        response.details = err.message;
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        response.error = 'Unauthorized';
    } else if (err.name === 'ForbiddenError') {
        statusCode = 403;
        response.error = 'Forbidden';
    }

    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production') {
        delete response.stack;
    } else {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
}

/**
 * CORS configuration for production
 */
function secureCors() {
    const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost',
        process.env.FRONTEND_URL || '',
    ].filter(Boolean);

    // In production, add your actual domain
    if (process.env.NODE_ENV === 'production') {
        allowedOrigins.push(
            process.env.ALLOWED_ORIGIN_1 || '',
            process.env.ALLOWED_ORIGIN_2 || ''
        );
    }

    return {
        origin: allowedOrigins.filter(Boolean),
        credentials: true,
        optionsSuccessStatus: 200,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    };
}

/**
 * Create security middleware stack
 */
function createSecurityMiddleware() {
    const router = express.Router();

    // Apply security headers
    router.use(securityHeaders);

    // Helmet
    router.use(helmet);

    // Request logging
    router.use(requestLogger);

    // Input validation
    router.use(validateInput);

    // Rate limiting
    const limiter = new RateLimiter(
        Number(process.env.RATE_LIMIT_WINDOW_MS || 900000),
        Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100)
    );
    router.use(limiter.middleware());

    return router;
}

module.exports = {
    securityHeaders,
    helmet,
    requestLogger,
    validateInput,
    errorHandler,
    RateLimiter,
    secureCors,
    createSecurityMiddleware,
};
