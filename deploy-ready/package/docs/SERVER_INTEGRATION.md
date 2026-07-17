/**
 * Server Integration File
 * Add this code to your server.js to enable SMS functionality
 */

// Add these imports at the top of server.js
const { router: smsRouter, initializeSMSLog } = require('./routes/smsRoutes');

// After you initialize Sequelize (around line where you create models)
// Add this:
// initializeSMSLog(sequelize);

// Add this route to your Express app (after other routes)
app.use('/api/sms', smsRouter);

// COMPLETE EXAMPLE:
/*

const express = require('express');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const { Sequelize, DataTypes, Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Import SMS routes
const { router: smsRouter, initializeSMSLog } = require('./routes/smsRoutes');

const JWT_SECRET = process.env.JWT_SECRET || 'eduCore_secret_key_2026';
const PERMISSIONS_FILE = path.join(__dirname, 'permissions.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ... your existing code ...

let sequelize;

async function initializeDatabase() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'school_system'}\`;`);
        await connection.end();

        sequelize = new Sequelize(
            process.env.DB_NAME || 'school_system',
            process.env.DB_USER || 'root',
            process.env.DB_PASSWORD || '',
            {
                host: process.env.DB_HOST || 'localhost',
                dialect: 'mysql',
                logging: false
            }
        );

        // Initialize SMS logging table
        initializeSMSLog(sequelize);

        // Sync database
        await sequelize.sync();

        console.log('✅ Database connected and SMS logging initialized');
        return true;
    } catch (error) {
        console.error('❌ Database initialization error:', error.message);
        return false;
    }
}

// Define Student model (if not already defined)
const Student = sequelize.define('Student', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: DataTypes.STRING,
    phoneNumber: DataTypes.STRING,
    email: DataTypes.STRING,
    // ... other fields
}, { timestamps: true });

// ... your existing routes ...

// ADD SMS ROUTES HERE
app.use('/api/sms', smsRouter);

// Start server
const PORT = process.env.PORT || 3000;
(async () => {
    const dbReady = await initializeDatabase();
    if (dbReady) {
        server.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
        });
    }
})();

*/

module.exports = { smsRouter, initializeSMSLog };
