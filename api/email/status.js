const { createHandler, sendJson } = require('../_lib/http');
const { getEmailConfig } = require('../_lib/services');

module.exports = createHandler({
    GET: async ({ res }) => {
        const emailConfig = getEmailConfig();
        sendJson(res, 200, {
            success: true,
            configured: emailConfig.configured,
            fromEmail: emailConfig.fromEmail || '',
            fromName: emailConfig.fromName || ''
        });
    }
});
