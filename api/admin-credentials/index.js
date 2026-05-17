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

        if (String(body?.password || '').trim()) {
            await verifyOtp(db, 'change-password', body?.otp);
        }

        const saved = await saveAdminCredentials(db, { username, password });
        sendJson(res, 200, { success: true, credentials: { username: saved.username } });
    }
}, { getDb });
