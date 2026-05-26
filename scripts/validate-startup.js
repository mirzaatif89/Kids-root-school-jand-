#!/usr/bin/env node

/**
 * Startup Validation Script
 * Validates environment configuration before starting the app
 * 
 * Usage: node scripts/validate-startup.js
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const PROJECT_ROOT = path.join(__dirname, '..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');

class StartupValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.info = [];
    }

    log(type, message) {
        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
        const prefix = `[${timestamp}]`;

        switch (type) {
            case 'error':
                console.error(chalk.red(`${prefix} ERROR: ${message}`));
                this.errors.push(message);
                break;
            case 'warning':
                console.warn(chalk.yellow(`${prefix} WARN: ${message}`));
                this.warnings.push(message);
                break;
            case 'success':
                console.log(chalk.green(`${prefix} ✓ ${message}`));
                break;
            case 'info':
                console.log(chalk.blue(`${prefix} ℹ ${message}`));
                this.info.push(message);
                break;
        }
    }

    async run() {
        console.log(chalk.bold('\n═══════════════════════════════════════════'));
        console.log(chalk.bold('  School CRM - Startup Validation'));
        console.log(chalk.bold('═══════════════════════════════════════════\n'));

        await this.validateEnvironment();
        await this.validateFiles();
        await this.validateDatabase();
        await this.validatePermissions();

        this.printSummary();

        return this.errors.length === 0;
    }

    async validateEnvironment() {
        console.log(chalk.cyan('Checking environment configuration...'));

        if (!fs.existsSync(ENV_FILE)) {
            this.log('error', '.env file not found at ' + ENV_FILE);
            return;
        }
        this.log('success', '.env file found');

        const requiredEnvVars = [
            'DB_HOST',
            'DB_PORT',
            'DB_NAME',
            'DB_USER',
            'DB_PASSWORD',
            'JWT_SECRET',
            'SMTP_HOST',
            'SMTP_USER',
        ];

        const env = require('dotenv').config({ path: ENV_FILE }).parsed || {};

        for (const envVar of requiredEnvVars) {
            if (!env[envVar]) {
                this.log('error', `Missing required environment variable: ${envVar}`);
            } else {
                const value = envVar.includes('PASSWORD') || envVar.includes('SECRET')
                    ? '***'
                    : env[envVar].substring(0, 20) + (env[envVar].length > 20 ? '...' : '');
                this.log('success', `${envVar} = ${value}`);
            }
        }

        if (env.NODE_ENV !== 'production') {
            this.log('warning', `NODE_ENV is not set to 'production' (current: ${env.NODE_ENV || 'undefined'})`);
        } else {
            this.log('success', 'NODE_ENV set to production');
        }
    }

    async validateFiles() {
        console.log(chalk.cyan('\nChecking required files...'));

        const requiredFiles = [
            'app.js',
            'package.json',
            'backend/server.js',
            'frontend/index.html',
            'frontend/login.html',
        ];

        for (const file of requiredFiles) {
            const fullPath = path.join(PROJECT_ROOT, file);
            if (fs.existsSync(fullPath)) {
                this.log('success', `${file} found`);
            } else {
                this.log('error', `${file} not found at ${fullPath}`);
            }
        }

        const uploadsDir = path.join(PROJECT_ROOT, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            try {
                fs.mkdirSync(uploadsDir, { recursive: true });
                this.log('success', 'Created uploads directory');
            } catch (err) {
                this.log('warning', `Could not create uploads directory: ${err.message}`);
            }
        } else {
            this.log('success', 'uploads directory exists');
        }

        const logsDir = path.join(PROJECT_ROOT, 'logs');
        if (!fs.existsSync(logsDir)) {
            try {
                fs.mkdirSync(logsDir, { recursive: true });
                this.log('success', 'Created logs directory');
            } catch (err) {
                this.log('warning', `Could not create logs directory: ${err.message}`);
            }
        } else {
            this.log('success', 'logs directory exists');
        }
    }

    async validateDatabase() {
        console.log(chalk.cyan('\nChecking database configuration...'));

        const env = require('dotenv').config({ path: ENV_FILE }).parsed || {};

        try {
            const mysql = require('mysql2/promise');
            const connection = await mysql.createConnection({
                host: env.DB_HOST || 'localhost',
                port: env.DB_PORT || 3306,
                user: env.DB_USER,
                password: env.DB_PASSWORD,
                database: env.DB_NAME,
            });

            this.log('success', 'Database connection successful');
            await connection.end();
        } catch (err) {
            this.log('error', `Database connection failed: ${err.message}`);
            this.log('info', 'Ensure MySQL is running and credentials are correct');
        }
    }

    async validatePermissions() {
        console.log(chalk.cyan('\nChecking file permissions...'));

        try {
            const permissionsFile = path.join(PROJECT_ROOT, 'permissions.json');
            if (fs.existsSync(permissionsFile)) {
                const perms = JSON.parse(fs.readFileSync(permissionsFile, 'utf8'));
                this.log('success', `permissions.json loaded (${Object.keys(perms).length} roles)`);
            } else {
                this.log('warning', 'permissions.json not found - it will be auto-created');
            }

            const adminCredFile = path.join(PROJECT_ROOT, 'admin_credentials.json');
            if (fs.existsSync(adminCredFile)) {
                this.log('success', 'admin_credentials.json found');
            } else {
                this.log('warning', 'admin_credentials.json not found - it will be auto-created');
            }
        } catch (err) {
            this.log('warning', `Could not validate permissions: ${err.message}`);
        }
    }

    printSummary() {
        console.log(chalk.bold('\n═══════════════════════════════════════════'));
        console.log(chalk.bold('  Validation Summary'));
        console.log(chalk.bold('═══════════════════════════════════════════\n'));

        if (this.errors.length > 0) {
            console.log(chalk.red(`❌ Found ${this.errors.length} critical error(s):\n`));
            this.errors.forEach((err, i) => {
                console.log(chalk.red(`   ${i + 1}. ${err}`));
            });
            console.log();
        }

        if (this.warnings.length > 0) {
            console.log(chalk.yellow(`⚠️  Found ${this.warnings.length} warning(s):\n`));
            this.warnings.forEach((warn, i) => {
                console.log(chalk.yellow(`   ${i + 1}. ${warn}`));
            });
            console.log();
        }

        if (this.errors.length === 0 && this.warnings.length === 0) {
            console.log(chalk.green('✅ All validations passed! App is ready to start.\n'));
        }

        if (this.errors.length > 0) {
            console.log(chalk.red('❌ Please fix the above errors before starting the application.\n'));
            process.exit(1);
        }
    }
}

// Run validation
const validator = new StartupValidator();
validator.run().catch((err) => {
    console.error(chalk.red('Unexpected validation error:'), err);
    process.exit(1);
});
