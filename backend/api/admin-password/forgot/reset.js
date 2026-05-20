const { createHandler, sendJson } = require('../../_lib/http');
const { getDb } = require('../../_lib/db');
const { getSavedAdminCredentials, saveAdminCredentials, verifyOtp } = require('../../_lib/admin-otp');

module.exports = createHandler({
    POST: async ({ res, db, body }) => {
        const current = await getSavedAdminCredentials(db);
        const username = String(body?.username || '').trim() || current.username;
        const password = String(body?.password || '').trim();

        if (username !== current.username) {
            sendJson(res, 400, { success: false, message: 'Invalid admin username.' });
            return;
        }

        if (!password) {
            sendJson(res, 400, { success: false, message: 'New password is required.' });
            return;
        }

        await verifyOtp(db, 'forgot-password', body?.otp);
        await saveAdminCredentials(db, { username: current.username, password });
        sendJson(res, 200, { success: true, message: 'Admin password updated successfully.' });
    }
}, { getDb });
