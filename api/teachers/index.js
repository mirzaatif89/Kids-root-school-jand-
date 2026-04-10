const { createHandler, sendJson } = require('../_lib/http');
const { getDb, Op } = require('../_lib/db');
const {
    bcrypt,
    ensureUniqueTeacherIdentity,
    isPasswordHash,
    normalizeOptionalEmail,
    upsertAuthUser
} = require('../_lib/services');

const teacherAttributes = [
    'id', 'employeeCode', 'fullName', 'profileImage', 'fatherName', 'cnic', 'phone',
    'email', 'address', 'qualification', 'campusName', 'gender', 'subject', 'salary',
    'idCardFront', 'idCardBack', 'cvFile', 'bankName', 'bankAccountTitle',
    'bankAccountNumber', 'bankBranch', 'username', 'password', 'plainPassword', 'role'
];

module.exports = createHandler({
    GET: async ({ res, db }) => {
        const teachers = await db.models.Teacher.findAll({
            attributes: teacherAttributes
        });
        sendJson(res, 200, teachers);
    },
    POST: async ({ res, db, body }) => {
        const data = Array.isArray(body) ? body : [body];
        const { Teacher, User } = db.models;

        for (const item of data) {
            const rawPassword = item.plainPassword || item.password || '';
            item.email = normalizeOptionalEmail(item.email);
            await ensureUniqueTeacherIdentity(Teacher, User, item, Op);
            if (item.password && !isPasswordHash(item.password)) {
                item.password = await bcrypt.hash(item.password, 10);
            }
            item.plainPassword = rawPassword;

            await Teacher.upsert(item);
            await upsertAuthUser(User, {
                id: `teacher_${item.id}`,
                profileId: item.id,
                role: 'Teacher',
                username: item.username,
                email: item.email,
                password: item.password,
                fullName: item.fullName,
                campusName: item.campusName,
                plainPassword: item.plainPassword
            });
        }

        sendJson(res, 200, { success: true });
    }
}, { getDb });
