const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');

module.exports = createHandler({
    POST: async ({ res }) => {
        sendJson(res, 200, {
            success: true,
            message: 'Pending fee email reminders are disabled.',
            sent: 0,
            skipped: 0,
            failed: []
        });
    }
}, { getDb });
