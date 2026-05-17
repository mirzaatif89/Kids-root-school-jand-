const { createHandler, sendJson } = require('../_lib/http');
const { authenticateToken } = require('../_lib/services');

module.exports = createHandler({
    POST: async ({ req, res, body }) => {
        authenticateToken(req);
        sendJson(res, 200, {
            success: true,
            message: 'Email sending is disabled.'
        });
    }
});
