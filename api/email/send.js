const { createHandler, sendJson } = require('../_lib/http');
const { authenticateToken } = require('../_lib/services');
const { sendSmtpEmail } = require('../_lib/mailer');

module.exports = createHandler({
    POST: async ({ req, res, body }) => {
        authenticateToken(req);
        const result = await sendSmtpEmail(body || {});
        sendJson(res, 200, {
            success: true,
            message: 'Email sent successfully.',
            ...result
        });
    }
});
