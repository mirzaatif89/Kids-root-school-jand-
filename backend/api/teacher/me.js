const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const { authenticateToken } = require('../_lib/services');

module.exports = createHandler({
    GET: async ({ req, res, db }) => {
        const user = authenticateToken(req);
        if (user.role !== 'Teacher') {
            sendJson(res, 403, { success: false, message: 'Teacher access only.' });
            return;
        }

        const teacher = await db.models.Teacher.findByPk(user.id, {
            attributes: { exclude: ['password'] }
        });

        if (!teacher) {
            sendJson(res, 404, { success: false, message: 'Teacher record not found.' });
            return;
        }

        sendJson(res, 200, teacher);
    },
    POST: async ({ req, res, db, body }) => {
        const user = authenticateToken(req);
        if (user.role !== 'Teacher') {
            sendJson(res, 403, { success: false, message: 'Teacher access only.' });
            return;
        }

        const profileImage = String(body?.profileImage || '').trim();
        if (!profileImage || !profileImage.startsWith('data:image/')) {
            sendJson(res, 400, { success: false, message: 'A profile image is required.' });
            return;
        }

        const teacher = await db.models.Teacher.findByPk(user.id);
        if (!teacher) {
            sendJson(res, 404, { success: false, message: 'Teacher record not found.' });
            return;
        }

        await teacher.update({ profileImage });
        const refreshed = await db.models.Teacher.findByPk(user.id, {
            attributes: { exclude: ['password'] }
        });
        sendJson(res, 200, { success: true, teacher: refreshed });
    }
}, { getDb });
