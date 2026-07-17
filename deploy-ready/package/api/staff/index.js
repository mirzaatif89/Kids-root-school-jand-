const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const {
    bcrypt,
    isPasswordHash,
    normalizeOptionalEmail,
    upsertAuthUser
} = require('../_lib/services');

module.exports = createHandler({
    GET: async ({ res, db }) => {
        const staff = await db.models.Staff.findAll();
        sendJson(res, 200, staff);
    },
    POST: async ({ res, db, body }) => {
        const data = Array.isArray(body) ? body : [body];
        const { Staff, User } = db.models;

        for (const item of data) {
            const rawPassword = item.plainPassword || item.password || '';
            item.email = normalizeOptionalEmail(item.email);

            if (item.password && !isPasswordHash(item.password)) {
                item.password = await bcrypt.hash(item.password, 10);
            }

            item.plainPassword = rawPassword;

            await Staff.upsert(item);
            await upsertAuthUser(User, {
                id: `staff_${item.id}`,
                profileId: item.id,
                role: 'Staff',
                username: item.username,
                email: item.email,
                password: item.password,
                fullName: item.fullName,
                plainPassword: item.plainPassword,
                groupKey: item.groupKey || 'staff'
            });
        }

        sendJson(res, 200, { success: true });
    }
}, { getDb });
