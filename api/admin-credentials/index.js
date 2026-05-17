const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const { JWT_SECRET, jwt } = require('../_lib/services');

function readBearerToken(req) {
    const authHeader = req.headers.authorization || '';
    return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
}

function assertAdmin(req) {
    const token = readBearerToken(req);
    if (!token) {
        const error = new Error('Admin access required.');
        error.statusCode = 401;
        throw error;
    }

    let user = null;
    try {
        user = jwt.verify(token, JWT_SECRET);
    } catch (_error) {
        const error = new Error('Admin access required.');
        error.statusCode = 401;
        throw error;
    }

    if (user.role !== 'Admin') {
        const error = new Error('Admin access required.');
        error.statusCode = 403;
        throw error;
    }
}

function getFallbackCredentials() {
    return {
        username: process.env.ADMIN_USERNAME || 'Myownschool',
        password: process.env.ADMIN_PASSWORD || 'myownschool1122'
    };
}

async function getSavedAdminCredentials(db) {
    const fallback = getFallbackCredentials();
    const row = await db.models.AppSetting.findByPk('admin_credentials');
    if (!row?.settingValue) return fallback;

    let parsed = null;
    try {
        parsed = JSON.parse(row.settingValue);
    } catch (_error) {
        return fallback;
    }

    const username = String(parsed?.username || '').trim();
    const password = String(parsed?.password || '');
    if (!username || !password) return fallback;

    return { username, password };
}

module.exports = createHandler({
    GET: async ({ req, res, db }) => {
        assertAdmin(req);
        const creds = await getSavedAdminCredentials(db);
        sendJson(res, 200, { success: true, credentials: { username: creds.username } });
    },
    POST: async ({ req, res, db, body }) => {
        assertAdmin(req);

        const current = await getSavedAdminCredentials(db);
        const username = String(body?.username || '').trim() || current.username;
        const password = String(body?.password || '').trim() || current.password;

        if (!username) {
            const error = new Error('Admin username is required.');
            error.statusCode = 400;
            throw error;
        }

        if (!password) {
            const error = new Error('Admin password is required.');
            error.statusCode = 400;
            throw error;
        }

        await db.models.AppSetting.upsert({
            settingKey: 'admin_credentials',
            settingValue: JSON.stringify({ username, password })
        });

        sendJson(res, 200, { success: true, credentials: { username } });
    }
}, { getDb });
