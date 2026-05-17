const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const { assertAdmin, checkOtp } = require('../_lib/admin-otp');

module.exports = createHandler({
    POST: async ({ req, res, db, body }) => {
        assertAdmin(req);
        await checkOtp(db, 'change-password', body?.otp);
        sendJson(res, 200, {
            success: true,
            message: 'OTP verified. Enter your new password.'
        });
    }
}, { getDb });
