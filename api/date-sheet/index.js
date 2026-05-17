const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');

function normalizeDateSheetPayload(data = {}) {
    const raw = data && typeof data === 'object' ? data : {};
    const scheduleRows = Array.isArray(raw.scheduleRows)
        ? raw.scheduleRows.map((row) => ({
            subject: String(row.subject || '').trim(),
            className: String(row.className || '').trim(),
            examDate: String(row.examDate || '').trim(),
            startTime: String(row.startTime || '').trim(),
            endTime: String(row.endTime || '').trim()
        })).filter((row) => row.subject || row.className || row.examDate || row.startTime || row.endTime)
        : [];

    return {
        dateSheetSchoolName: String(raw.dateSheetSchoolName || '').trim(),
        dateSheetExamTitle: String(raw.dateSheetExamTitle || '').trim(),
        dateSheetSession: String(raw.dateSheetSession || '').trim(),
        dateSheetClassGroup: String(raw.dateSheetClassGroup || '').trim(),
        dateSheetCampus: String(raw.dateSheetCampus || '').trim(),
        dateSheetDefaultStart: String(raw.dateSheetDefaultStart || '').trim(),
        dateSheetInstructions: String(raw.dateSheetInstructions || '').trim(),
        scheduleRows,
        status: ['executed', 'hidden'].includes(raw.status) ? raw.status : 'draft',
        executedAt: raw.executedAt || (raw.status === 'executed' ? new Date().toISOString() : null),
        hiddenAt: raw.status === 'hidden' ? (raw.hiddenAt || new Date().toISOString()) : null,
        updatedAt: new Date().toISOString()
    };
}

async function loadDateSheet(db) {
    const setting = await db.models.AppSetting.findByPk('date_sheet');
    if (!setting) return null;

    try {
        return normalizeDateSheetPayload(JSON.parse(setting.settingValue));
    } catch (error) {
        return null;
    }
}

module.exports = createHandler({
    GET: async ({ res, db }) => {
        sendJson(res, 200, { success: true, dateSheet: await loadDateSheet(db) });
    },
    POST: async ({ res, db, body }) => {
        const dateSheet = normalizeDateSheetPayload(body || {});
        await db.models.AppSetting.upsert({
            settingKey: 'date_sheet',
            settingValue: JSON.stringify(dateSheet)
        });
        sendJson(res, 200, { success: true, dateSheet });
    }
}, { getDb });
