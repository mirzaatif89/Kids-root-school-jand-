const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');

const SETTING_KEY = 'result_publish_schedules';

function normalizeSchedules(body = {}) {
    const raw = Array.isArray(body) ? body : Array.isArray(body?.schedules) ? body.schedules : [];
    return raw.filter((item) => item && typeof item === 'object').map((item) => ({
        ...item,
        updatedAt: item.updatedAt || new Date().toISOString()
    }));
}

async function readSchedules(db) {
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
        sendJson(res, 200, { success: true, schedules: await readSchedules(db) });
    },
    POST: async ({ res, db, body }) => {
        const schedules = normalizeSchedules(body || {});
        await db.models.AppSetting.upsert({
            settingKey: SETTING_KEY,
            settingValue: JSON.stringify(schedules)
        });
        sendJson(res, 200, { success: true, schedules });
    }
}, { getDb });
