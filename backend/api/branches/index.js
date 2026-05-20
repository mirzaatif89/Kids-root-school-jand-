const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const { bcrypt, isPasswordHash, normalizeOptionalEmail } = require('../_lib/services');

module.exports = createHandler({
    GET: async ({ res, db }) => {
        const branches = await db.models.User.findAll({
            where: { role: 'Branch' },
            attributes: ['id', 'profileId', 'fullName', 'username', 'plainPassword', 'campusName', 'isActive'],
            order: [['campusName', 'ASC']]
        });
        sendJson(res, 200, branches);
    },
    POST: async ({ res, db, body }) => {
        const { User } = db.models;
        const data = Array.isArray(body) ? body : [body];

        for (const item of data) {
            if (!item.username || !item.campusName) {
                sendJson(res, 400, { success: false, message: 'Campus name and username are required.' });
                return;
            }

            const branchId = item.profileId || item.id || `branch_${String(item.campusName).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
            const existingBranch = item.id
                ? await User.findByPk(item.id)
                : await User.findOne({ where: { id: branchId, role: 'Branch' } });
            const rawPassword = item.plainPassword || item.password || existingBranch?.plainPassword || '';

            if (!rawPassword) {
                sendJson(res, 400, { success: false, message: 'Password is required.' });
                return;
            }

            const passwordHash = item.password
                ? (isPasswordHash(item.password) ? item.password : await bcrypt.hash(item.password, 10))
                : existingBranch?.password;

            await User.upsert({
                id: item.id || branchId,
                profileId: branchId,
                fullName: item.fullName || item.campusName,
                email: normalizeOptionalEmail(item.email),
                username: item.username,
                password: passwordHash,
                plainPassword: rawPassword,
                role: 'Branch',
                campusName: item.campusName,
                isActive: item.isActive !== false
            });
        }

        const branches = await User.findAll({
            where: { role: 'Branch' },
            attributes: ['id', 'profileId', 'fullName', 'username', 'plainPassword', 'campusName', 'isActive'],
            order: [['campusName', 'ASC']]
        });

        sendJson(res, 200, { success: true, branches });
    }
}, { getDb });
