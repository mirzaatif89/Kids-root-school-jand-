const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');

module.exports = createHandler({
    GET: async ({ res, db }) => {
        const { FeeDueBalance } = db.models;
        if (!FeeDueBalance) {
            sendJson(res, 200, { success: true, balances: {} });
            return;
        }

        const rows = await FeeDueBalance.findAll();
        const balances = rows.reduce((acc, row) => {
            const studentId = String(row.studentId || '').trim();
            if (!studentId) return acc;
            const balance = Number(row.balance || 0);
            acc[studentId] = Number.isFinite(balance) ? balance : 0;
            return acc;
        }, {});

        sendJson(res, 200, { success: true, balances });
    }
}, { getDb });

