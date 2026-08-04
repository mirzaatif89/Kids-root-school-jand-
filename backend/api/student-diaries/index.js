const { createHandler, sendJson } = require('../_lib/http');
const { getDb, Op } = require('../_lib/db');

function normalizeDiary(record = {}) {
    const raw = record && typeof record === 'object' ? record : {};
    return {
        id: String(raw.id || '').trim(),
        campusName: String(raw.campusName || '').trim(),
        classGrade: String(raw.classGrade || '').trim(),
        date: String(raw.date || '').trim(),
        title: String(raw.title || '').trim(),
        details: String(raw.details || '').trim(),
        fileName: String(raw.fileName || '').trim(),
        fileType: String(raw.fileType || '').trim(),
        fileData: raw.fileData ? String(raw.fileData) : '',
        createdAt: String(raw.createdAt || '').trim(),
        updatedAt: String(raw.updatedAt || '').trim()
    };
}

function formatDiary(record) {
    const raw = record && typeof record.toJSON === 'function' ? record.toJSON() : (record || {});
    return normalizeDiary(raw);
}

module.exports = createHandler({
    GET: async ({ res, db }) => {
        const records = await db.models.StudentDiary.findAll({
            order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']]
        });
        sendJson(res, 200, { success: true, diaries: records.map(formatDiary) });
    },
    POST: async ({ res, db, body }) => {
        const StudentDiary = db.models.StudentDiary;
        const payload = Array.isArray(body) ? body : [body];
        const diaries = payload.map(normalizeDiary).filter((item) => item.id);

        if (!Array.isArray(body)) {
            const diary = diaries[0] || normalizeDiary(body || {});
            if (!diary.id) diary.id = `DIARY-${Date.now()}`;
            if (!diary.title) {
                sendJson(res, 400, { success: false, message: 'Diary subject is required.' });
                return;
            }
            if (!diary.details) {
                sendJson(res, 400, { success: false, message: 'Diary details are required.' });
                return;
            }
            diary.createdAt = diary.createdAt || new Date().toISOString();
            diary.updatedAt = new Date().toISOString();
            await StudentDiary.upsert(diary);
            const records = await StudentDiary.findAll({
                order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']]
            });
            sendJson(res, 200, { success: true, diary: formatDiary(diary), diaries: records.map(formatDiary) });
            return;
        }

        const incomingIds = diaries.map((item) => item.id).filter(Boolean);
        if (incomingIds.length) {
            await StudentDiary.destroy({
                where: {
                    id: {
                        [Op.notIn]: incomingIds
                    }
                }
            });
        } else {
            await StudentDiary.destroy({ where: {} });
        }

        const now = new Date().toISOString();
        for (const diary of diaries) {
            if (!diary.title || !diary.details) continue;
            diary.createdAt = diary.createdAt || now;
            diary.updatedAt = now;
            await StudentDiary.upsert(diary);
        }

        const records = await StudentDiary.findAll({
            order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']]
        });
        sendJson(res, 200, { success: true, diaries: records.map(formatDiary) });
    },
    DELETE: async ({ res, db, req }) => {
        const id = String(req.url.split('/').pop() || '').trim();
        if (!id) {
            sendJson(res, 400, { success: false, message: 'Diary id is required.' });
            return;
        }
        await db.models.StudentDiary.destroy({ where: { id } });
        const records = await db.models.StudentDiary.findAll({
            order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']]
        });
        sendJson(res, 200, { success: true, deleted: true, diaries: records.map(formatDiary) });
    }
}, { getDb });
