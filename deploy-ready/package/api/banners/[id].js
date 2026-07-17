const { createHandler, sendJson } = require('../_lib/http');
const { deleteRecord } = require('../_lib/mobileStore');

module.exports = createHandler({
    DELETE: async ({ req, res }) => {
        sendJson(res, 200, { success: true, deleted: true, banners: deleteRecord('banners', req.query.id) });
    }
});
