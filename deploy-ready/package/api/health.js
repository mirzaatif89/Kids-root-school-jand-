const { createHandler, sendJson } = require('./_lib/http');

module.exports = createHandler(async (_req, res) => {
    sendJson(res, 200, {
        success: true,
        online: true,
        timestamp: new Date().toISOString()
    });
});
