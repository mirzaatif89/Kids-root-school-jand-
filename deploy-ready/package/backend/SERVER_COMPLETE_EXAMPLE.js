/**
 * Complete Server.js Integration Example
 * Copy and adapt this for your server.js
 */

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

// ========== IMPORT SMS MODULES ==========
const { router: smsRouter, initializeSMSLog } = require('./routes/smsRoutes');

const JWT_SECRET = process.env.JWT_SECRET || 'eduCore_secret_key_2026';
const PERMISSIONS_FILE = path.join(__dirname, 'permissions.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.send('Server is running! Access the app via index.html');
});

let sequelize;

const defaultPermissions = {
    loginAccess: {
        student: true
    },
    modules: {}
};

function isPasswordHash(value) {
    return typeof value === 'string' && /^\$2[aby]\$/.test(value);
}

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

        console.log('✅ Database connected');

        // ========== INITIALIZE SMS LOGGING TABLE ==========
        initializeSMSLog(sequelize);
        console.log('✅ SMS logging initialized');

        // Define Student model (if not already defined)
        const Student = sequelize.define('Student', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false
            },
            phoneNumber: {
                type: DataTypes.STRING,
                allowNull: true
            },
            email: {
                type: DataTypes.STRING,
                allowNull: true
            },
            rollNumber: {
                type: DataTypes.STRING,
                allowNull: true
            },
            class: {
                type: DataTypes.STRING,
                allowNull: true
            },
            parentPhone: {
                type: DataTypes.STRING,
                allowNull: true
            }
        }, {
            timestamps: true,
            tableName: 'students'
        });

        // ... Define other models as needed ...

        // Sync database
        await sequelize.sync({ alter: false });

        return true;
    } catch (error) {
        console.error('❌ Database initialization error:', error.message);
        return false;
    }
}

// ========== DEFINE YOUR API ROUTES ==========

// Example: Get all students
app.get('/api/students', async (req, res) => {
    try {
        const Student = sequelize.models.Student;
        const students = await Student.findAll({
            attributes: ['id', 'name', 'phoneNumber', 'email', 'rollNumber', 'class']
        });
        res.json({ data: students });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Example: Get single student
app.get('/api/students/:id', async (req, res) => {
    try {
        const Student = sequelize.models.Student;
        const student = await Student.findByPk(req.params.id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        res.json(student);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Example: Create student
app.post('/api/students', async (req, res) => {
    try {
        const Student = sequelize.models.Student;
        const { name, phoneNumber, email, rollNumber, class: studentClass } = req.body;

        const student = await Student.create({
            name,
            phoneNumber,
            email,
            rollNumber,
            class: studentClass
        });

        res.json(student);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ========== REGISTER SMS ROUTES ==========
app.use('/api/sms', smsRouter);

// ========== OTHER ROUTES (Your existing code) ==========
// Add your other routes here...

// Socket.io connections (if needed)
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
});

// Start server
const PORT = process.env.PORT || 3000;

(async () => {
    console.log('\n🚀 Initializing School CRM System...\n');
    
    const dbReady = await initializeDatabase();
    
    if (dbReady) {
        server.listen(PORT, () => {
            console.log(`\n✅ Server running on http://localhost:${PORT}`);
            console.log(`📱 SMS Sender at http://localhost:${PORT}/sms_sender.html`);
            console.log(`📊 API available at http://localhost:${PORT}/api\n`);
        });
    } else {
        console.error('\n❌ Failed to initialize database');
        process.exit(1);
    }
})();

module.exports = { app, server, sequelize };
