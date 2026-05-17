const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const { assertAdmin, sendAdminOtpEmail } = require('../_lib/admin-otp');

module.exports = createHandler({
    POST: async ({ req, res, db }) => {
        assertAdmin(req);
        const result = await sendAdminOtpEmail(db, 'change-password');
        sendJson(res, 200, {
            success: true,
            message: `OTP sent to ${result.sentTo}.`,
            ...result
        });
    }
}, { getDb });
