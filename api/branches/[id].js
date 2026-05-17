const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');

module.exports = createHandler({
    DELETE: async ({ req, res, db }) => {
        const deletedCount = await db.models.User.destroy({
            where: {
                id: req.query.id,
                role: 'Branch'
            }
        });

        if (!deletedCount) {
            sendJson(res, 404, { success: false, message: 'Branch not found.' });
            return;
        }

        sendJson(res, 200, { success: true, message: 'Branch deleted successfully.' });
    }
}, { getDb });
