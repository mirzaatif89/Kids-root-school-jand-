const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const {
    bcrypt,
    ensureUniqueStudentIdentity,
    isPasswordHash,
    normalizeOptionalEmail,
    upsertAuthUser
} = require('../_lib/services');
const { Op } = require('../_lib/db');

module.exports = createHandler({
    GET: async ({ res, db }) => {
        const students = await db.models.Student.findAll();
        sendJson(res, 200, students);
    },
    POST: async ({ res, db, body }) => {
        const data = Array.isArray(body) ? body : [body];
        const { Student, User } = db.models;

        for (const item of data) {
            const rawPassword = item.plainPassword || item.password || '';
            item.email = normalizeOptionalEmail(item.email);
            await ensureUniqueStudentIdentity(Student, User, item, Op);
            if (item.password && !isPasswordHash(item.password)) {
                item.password = await bcrypt.hash(item.password, 10);
            }
            item.plainPassword = rawPassword;

            await Student.upsert(item);
            await upsertAuthUser(User, {
                id: `student_${item.id}`,
                profileId: item.id,
                role: 'Student',
                username: item.username,
                email: item.email,
                password: item.password,
                fullName: item.fullName,
                campusName: item.campusName || null,
                plainPassword: item.plainPassword
            });
        }

        sendJson(res, 200, { success: true });
    }
}, { getDb });
