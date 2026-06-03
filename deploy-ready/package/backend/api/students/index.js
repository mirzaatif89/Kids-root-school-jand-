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
        try {
            const data = Array.isArray(body) ? body : [body];
            const { Student, User } = db.models;

            if (!data || data.length === 0) {
                throw new Error('No student data provided');
            }

            const results = [];
            for (const item of data) {
                try {
                    if (!item.id) {
                        throw new Error('Student ID is required');
                    }
                    if (!item.username) {
                        throw new Error('Student username is required');
                    }

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

                    results.push({ id: item.id, success: true });
                } catch (itemError) {
                    console.error(`Failed to save student ${item.id}:`, itemError.message);
                    throw itemError;
                }
            }

            const students = await Student.findAll();
            sendJson(res, 200, { success: true, results, students });
        } catch (error) {
            console.error('POST /students error:', error.message, error);
            throw error;
        }
    }
}, { getDb });
