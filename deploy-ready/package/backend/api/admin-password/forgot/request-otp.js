const { createHandler, sendJson } = require('../../_lib/http');
const { getDb } = require('../../_lib/db');
const { getSavedAdminCredentials, sendAdminOtpEmail } = require('../../_lib/admin-otp');

module.exports = createHandler({
    POST: async ({ res, db, body }) => {
        const current = await getSavedAdminCredentials(db);
        const username = String(body?.username || '').trim();
        if (username && username !== current.username) {
            sendJson(res, 200, { success: true, message: 'If the admin account exists, an OTP has been sent.' });
            return;
        }

        const result = await sendAdminOtpEmail(db, 'forgot-password');
        sendJson(res, 200, {
            success: true,
            message: `OTP sent to ${result.sentTo}.`,
            ...result
        });
    }
}, { getDb });
