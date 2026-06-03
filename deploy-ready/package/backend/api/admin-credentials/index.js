const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const {
    assertAdmin,
    getSavedAdminCredentials,
    saveAdminCredentials,
    maskEmail,
    getAdminRecoveryEmail,
    verifyOtp
} = require('../_lib/admin-otp');

module.exports = createHandler({
    GET: async ({ req, res, db }) => {
        assertAdmin(req);
        const creds = await getSavedAdminCredentials(db);
        sendJson(res, 200, {
            success: true,
            credentials: { username: creds.username },
            recoveryEmail: maskEmail(getAdminRecoveryEmail())
        });
    },
    POST: async ({ req, res, db, body }) => {
        assertAdmin(req);

        const current = await getSavedAdminCredentials(db);
        const username = String(body?.username || '').trim() || current.username;
        const password = String(body?.password || '').trim() || current.password;
        const newPassword = String(body?.password || '').trim();
        const confirmPassword = String(body?.confirmPassword || '').trim();

        if (newPassword) {
            if (newPassword.length < 6) {
                const error = new Error('New password must be at least 6 characters.');
                error.statusCode = 400;
                throw error;
            }
            if (newPassword !== confirmPassword) {
                const error = new Error('New password and confirm password do not match.');
                error.statusCode = 400;
                throw error;
            }
            await verifyOtp(db, 'change-password', body?.otp);
        }

        const saved = await saveAdminCredentials(db, { username, password });
        sendJson(res, 200, { success: true, credentials: { username: saved.username } });
    }
}, { getDb });
