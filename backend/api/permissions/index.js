const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const { loadPermissions, savePermissions } = require('../_lib/services');

module.exports = createHandler({
    GET: async ({ res, db }) => {
        sendJson(res, 200, await loadPermissions(db));
    },
    POST: async ({ res, db, body }) => {
        const saved = await savePermissions(db, body || {});
        sendJson(res, 200, { success: true, permissions: saved });
    }
}, { getDb });
