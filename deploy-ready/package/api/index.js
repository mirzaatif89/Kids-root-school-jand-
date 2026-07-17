const { createHandler, sendJson } = require('./_lib/http');

module.exports = createHandler({
    GET: async ({ res }) => {
        sendJson(res, 200, {
            success: true,
            message: 'Vercel serverless API is running.'
        });
    }
});
