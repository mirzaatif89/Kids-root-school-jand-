const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');

const SETTING_KEY = 'result_archive';

function normalizeRecords(body = {}) {
    const raw = Array.isArray(body) ? body : Array.isArray(body?.results) ? body.results : [];
    return raw.filter((item) => item && typeof item === 'object').map((item) => ({
        ...item,
        updatedAt: item.updatedAt || new Date().toISOString()
    }));
}

async function readRecords(db) {
    const setting = await db.models.AppSetting.findByPk(SETTING_KEY);
    if (!setting) return [];
    try {
        const parsed = JSON.parse(setting.settingValue);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        return [];
    }
}

module.exports = createHandler({
    GET: async ({ res, db }) => {
        sendJson(res, 200, { success: true, results: await readRecords(db) });
    },
    POST: async ({ res, db, body }) => {
        const results = normalizeRecords(body || {});
        await db.models.AppSetting.upsert({
            settingKey: SETTING_KEY,
            settingValue: JSON.stringify(results)
        });
        sendJson(res, 200, { success: true, results });
    }
}, { getDb });
