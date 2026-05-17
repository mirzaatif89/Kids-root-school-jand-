const { createHandler, sendJson } = require('./_lib/http');
const { getDb, Op } = require('./_lib/db');
const {
    JWT_SECRET,
    PRINCIPAL_PASSWORD,
    PRINCIPAL_USERNAME,
    bcrypt,
    jwt,
    loadPermissions
} = require('./_lib/services');

async function resolveAdminCredentials(db) {
    const fallback = {
        username: process.env.ADMIN_USERNAME || 'Myownschool',
        password: process.env.ADMIN_PASSWORD || 'myownschool1122'
    };

    const appSettingModel = db?.models?.AppSetting;
    if (!appSettingModel) return fallback;

    try {
        const row = await appSettingModel.findByPk('admin_credentials');
        const saved = row?.settingValue ? JSON.parse(row.settingValue) : null;
        const username = String(saved?.username || '').trim();
        const password = String(saved?.password || '');
        if (!username || !password) return fallback;
        return { username, password };
    } catch (_error) {
        return fallback;
    }
}

module.exports = createHandler({
    POST: async ({ res, db, body }) => {
        const { username, password } = body || {};
        const adminCredentials = await resolveAdminCredentials(db);
        const adminEmail = adminCredentials.username;
        const adminPass = adminCredentials.password;

        if (username === adminEmail && password === adminPass) {
            const permissions = await loadPermissions(db);
            const groupKey = permissions.roleGroups.Admin || 'admin';
            const token = jwt.sign({ id: 'admin', role: 'Admin' }, JWT_SECRET, { expiresIn: '1d' });
            sendJson(res, 200, {
                success: true,
                token,
                user: { id: 'admin', fullName: 'Administrator', role: 'Admin', username: adminEmail, groupKey },
                permissions
            });
            return;
        }

        if (username === PRINCIPAL_USERNAME && password === PRINCIPAL_PASSWORD) {
            const permissions = await loadPermissions(db);
            if (permissions.loginAccess.principal === false) {
                sendJson(res, 403, { success: false, message: 'Principal login is currently disabled by admin.' });
                return;
            }
            const groupKey = permissions.roleGroups.Principal || 'principal';
            const token = jwt.sign({ id: 'principal', role: 'Principal' }, JWT_SECRET, { expiresIn: '1d' });
            sendJson(res, 200, {
                success: true,
                token,
                user: { id: 'principal', fullName: 'Principal', role: 'Principal', username: PRINCIPAL_USERNAME, groupKey },
                permissions
            });
            return;
        }

        const normalizedIdentity = String(username || '').trim();
        const userWhere = { [Op.or]: [{ username: normalizedIdentity }] };
        if (normalizedIdentity.includes('@')) {
            userWhere[Op.or].push({ email: normalizedIdentity.toLowerCase() });
        }

        const { User, Student, Teacher, Staff } = db.models;
        const user = await User.findOne({ where: userWhere });

        if (!user) {
            sendJson(res, 401, { success: false, message: 'Invalid credentials' });
            return;
        }

        const permissions = await loadPermissions(db);
        const roleKey = String(user.role || '').toLowerCase();
        if (permissions.loginAccess[roleKey] === false) {
            sendJson(res, 403, { success: false, message: `${user.role} login is currently disabled by admin.` });
            return;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            sendJson(res, 401, { success: false, message: 'Invalid credentials' });
            return;
        }

        let profileName = user.fullName;
        if (user.role === 'Student') {
            const student = await Student.findByPk(user.profileId);
            profileName = student?.fullName || profileName;
        } else if (user.role === 'Teacher') {
            const teacher = await Teacher.findByPk(user.profileId);
            profileName = teacher?.fullName || profileName;
        } else if (user.role === 'Staff') {
            const staff = await Staff.findByPk(user.profileId);
            profileName = staff?.fullName || profileName;
        }

        const token = jwt.sign(
            { id: user.profileId, role: user.role, campusName: user.campusName || '' },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        sendJson(res, 200, {
            success: true,
            token,
            permissions,
            user: {
                id: user.profileId,
                fullName: profileName,
                role: user.role,
                username: user.username,
                campusName: user.campusName || '',
                groupKey: user.groupKey || permissions.roleGroups[user.role] || roleKey
            }
        });
    }
}, { getDb });
