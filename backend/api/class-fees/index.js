const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const { JWT_SECRET, jwt } = require('../_lib/services');

function normalizeClassFeeConfig(input = {}) {
    const raw = input && typeof input === 'object' ? input : {};
    return Object.entries(raw).reduce((acc, [className, config]) => {
        const name = String(className || '').trim();
        if (!name) return acc;
        const monthlyFee = String(config?.monthlyFee ?? config?.fee ?? '').trim();
        const feeFrequency = String(config?.feeFrequency || 'Monthly').trim() || 'Monthly';
        if (!monthlyFee) return acc;
        acc[name] = { monthlyFee, feeFrequency };
        return acc;
    }, {});
}

async function readClassFeeConfig(db) {
    const row = await db.models.AppSetting.findByPk('class_fees');
    if (!row?.settingValue) return {};
    try {
        return normalizeClassFeeConfig(JSON.parse(row.settingValue));
    } catch (_error) {
        return {};
    }
}

function readBearerToken(req) {
    const authHeader = req.headers.authorization || '';
    return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
}

function assertAdminOrPrincipal(req) {
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

    if (user.role !== 'Admin' && user.role !== 'Principal') {
        const error = new Error('Admin access required.');
        error.statusCode = 403;
        throw error;
    }
}

module.exports = createHandler({
    GET: async ({ res, db }) => {
        sendJson(res, 200, { success: true, classFees: await readClassFeeConfig(db) });
    },
    POST: async ({ req, res, db, body }) => {
        assertAdminOrPrincipal(req);

        const className = String(body?.className || '').trim();
        const monthlyFee = String(body?.monthlyFee || '').trim();
        const feeFrequency = String(body?.feeFrequency || 'Monthly').trim() || 'Monthly';

        if (!className || !monthlyFee) {
            const error = new Error('Class and monthly fee are required.');
            error.statusCode = 400;
            throw error;
        }

        const classFees = await readClassFeeConfig(db);
        classFees[className] = { monthlyFee, feeFrequency };

        await db.models.AppSetting.upsert({
            settingKey: 'class_fees',
            settingValue: JSON.stringify(classFees)
        });

        sendJson(res, 200, { success: true, classFees });
    }
}, { getDb });
