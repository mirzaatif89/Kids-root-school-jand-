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
    },
    POST: async ({ req, res, db, body }) => {
        const user = authenticateToken(req);
        if (user.role !== 'Student') {
            sendJson(res, 403, { success: false, message: 'Student access only.' });
            return;
        }

        const profileImage = String(body?.profileImage || '').trim();
        if (!profileImage || !profileImage.startsWith('data:image/')) {
            sendJson(res, 400, { success: false, message: 'A profile image is required.' });
            return;
        }

        const student = await db.models.Student.findByPk(user.id);
        if (!student) {
            sendJson(res, 404, { success: false, message: 'Student record not found.' });
            return;
        }

        await student.update({ profileImage });
        const refreshed = await db.models.Student.findByPk(user.id, {
            attributes: { exclude: ['password'] }
        });
        sendJson(res, 200, { success: true, student: refreshed });
    }
}, { getDb });
