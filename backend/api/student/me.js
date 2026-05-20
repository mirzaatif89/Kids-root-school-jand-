const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const { authenticateToken } = require('../_lib/services');

module.exports = createHandler({
    GET: async ({ req, res, db }) => {
        const user = authenticateToken(req);
        if (user.role !== 'Student') {
            sendJson(res, 403, { success: false, message: 'Student access only.' });
            return;
        }

        const student = await db.models.Student.findByPk(user.id, {
            attributes: { exclude: ['password'] }
        });

        if (!student) {
            sendJson(res, 404, { success: false, message: 'Student record not found.' });
            return;
        }

        sendJson(res, 200, student);
    }
}, { getDb });
