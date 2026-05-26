/**
 * School CRM Application Entry Point
 * Serves both Frontend and Backend
 * 
 * Usage:
 *   Development:  npm run dev
 *   Production:   npm run production
 *   With Validation: npm run validate:start
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Import server module
const { startServer, server } = require('./backend/server');

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Application startup with error handling
 */
async function start() {
    try {
        const startTime = Date.now();
        
        console.log(`
╔════════════════════════════════════════╗
║  School CRM Application Starting       ║
╚════════════════════════════════════════╝
`);
        
        console.log(`Environment: ${NODE_ENV}`);
        console.log(`Starting backend services...`);
        
        // Initialize backend services
        await startServer();
        
        // Start HTTP server
        const httpServer = server.listen(PORT, HOST, () => {
            const duration = Date.now() - startTime;
            console.log(`
╔════════════════════════════════════════╗
║  ✓ Application Started Successfully    ║
╚════════════════════════════════════════╝
`);
            console.log(`🚀 Server running on http://${HOST}:${PORT}`);
            console.log(`⏱️  Startup time: ${duration}ms`);
            console.log(`📝 Health check: http://localhost:${PORT}/health`);
            console.log(`📋 Logs directory: ${logsDir}`);
            console.log(`
Press CTRL+C to stop the server
`);
        });

        // Graceful shutdown handlers
        process.on('SIGTERM', () => handleShutdown('SIGTERM'));
        process.on('SIGINT', () => handleShutdown('SIGINT'));

        /**
         * Handle graceful shutdown
         */
        function handleShutdown(signal) {
            console.log(`\n\n⚠️  Received ${signal} signal. Shutting down gracefully...`);
            
            // Close HTTP server
            httpServer.close(() => {
                console.log('✓ HTTP server closed');
                process.exit(0);
            });

            // Force exit after timeout
            setTimeout(() => {
                console.error('❌ Shutdown timeout exceeded. Force closing...');
                process.exit(1);
            }, 10000); // 10 second timeout
        }

        return httpServer;
    } catch (err) {
        console.error(`
╔════════════════════════════════════════╗
║  ❌ Application Startup Failed         ║
╚════════════════════════════════════════╝
`);
        console.error('Error:', err?.message || err);
        console.error('\nDebugging tips:');
        console.error('1. Ensure MySQL is running and accessible');
        console.error('2. Check .env file for correct database credentials');
        console.error('3. Verify file permissions on frontend/backend directories');
        console.error('4. Run "npm run validate" for detailed diagnostics');
        
        process.exit(1);
    }
}

// Start the application
if (require.main === module) {
    start().catch((err) => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}

module.exports = { start };
