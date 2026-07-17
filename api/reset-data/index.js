const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'eduCore_secret_key_2026';

module.exports = createHandler({
    POST: async ({ req, res, db }) => {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

        if (!token) {
            const error = new Error('Admin access required.');
            error.statusCode = 401;
            throw error;
        }

        let user = null;
        try {
            user = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            const authError = new Error('Admin access required.');
            authError.statusCode = 401;
            throw authError;
        }

        if (user.role !== 'Admin') {
            const error = new Error('Admin access required.');
            error.statusCode = 403;
            throw error;
        }

        const resetOrder = [
            'FeePayment',
            'StudentAttendance',
            'TeacherAttendance',
            'SpecialNotice',
            'Student',
            'Teacher',
            'Staff',
            'User'
        ];

        for (const modelName of resetOrder) {
            if (db.models[modelName]) {
                await db.models[modelName].destroy({ where: {} });
            }
        }

        sendJson(res, 200, {
            success: true,
            message: 'System data has been reset.'
        });
    }
}, { getDb });
