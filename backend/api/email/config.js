const { createHandler, sendJson } = require('../_lib/http');
const { authenticateToken } = require('../_lib/services');
const { getSmtpConfig } = require('../_lib/mailer');

function maskEmail(value = '') {
    const email = String(value || '').trim();
    if (!email) return '';
    const [name, domain] = email.split('@');
    if (!domain) return `${name.slice(0, 2)}***`;
    return `${name.slice(0, 2)}***@${domain}`;
}

module.exports = createHandler({
    GET: async ({ req, res }) => {
        authenticateToken(req);
        const config = getSmtpConfig();
        sendJson(res, 200, {
            success: true,
            configured: Boolean(config.host && config.port && config.user && config.pass && config.fromEmail),
            host: config.host || '',
            port: config.port || 587,
            secure: config.secure,
            user: maskEmail(config.user),
            fromEmail: config.fromEmail || '',
            fromName: config.fromName || ''
        });
    }
});
