const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const { authenticateToken } = require('../_lib/services');

async function findTeacherRecord(Teacher, user) {
    if (!Teacher || !user) return null;

    const lookups = [];
    if (user.id !== undefined && user.id !== null) {
        lookups.push({ id: user.id });
    }
    if (user.profileId !== undefined && user.profileId !== null) {
        lookups.push({ id: user.profileId });
    }
    if (user.employeeCode) {
        lookups.push({ employeeCode: user.employeeCode });
    }
    if (user.username) {
        lookups.push({ username: user.username });
    }
    if (user.email) {
        lookups.push({ email: String(user.email).trim().toLowerCase() });
    }

    for (const where of lookups) {
        const teacher = await Teacher.findOne({
            where,
            attributes: { exclude: ['password'] }
        });
        if (teacher) return teacher;
    }

    return null;
}

module.exports = createHandler({
    GET: async ({ req, res, db }) => {
        const user = authenticateToken(req);
        if (user.role !== 'Teacher') {
            sendJson(res, 403, { success: false, message: 'Teacher access only.' });
            return;
        }

        const teacher = await findTeacherRecord(db.models.Teacher, user);

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

        const teacher = await findTeacherRecord(db.models.Teacher, user);
        if (!teacher) {
            sendJson(res, 404, { success: false, message: 'Teacher record not found.' });
            return;
        }

        await teacher.update({ profileImage });
        const refreshed = await findTeacherRecord(db.models.Teacher, user);
        sendJson(res, 200, { success: true, teacher: refreshed });
    }
}, { getDb });
