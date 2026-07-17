const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');

function normalizeStatus(status) {
    if (status === 'P') return 'Present';
    if (status === 'A') return 'Absent';
    if (status === 'Present' || status === 'Late' || status === 'Absent' || status === 'Leave') return status;
    return 'Not Marked';
}

function buildTeacherAttendanceStore(records) {
    return records.reduce((store, record) => {
        const teacherId = String(record.teacherId || '').trim();
        const date = String(record.date || '').trim();
        const status = normalizeStatus(record.status);

        if (!teacherId || !date || status === 'Not Marked') {
            return store;
        }

        const monthKey = date.slice(0, 7);
        const dayIndex = Number(date.slice(8, 10)) - 1;
        const recordKey = `${teacherId}_${monthKey}`;

        if (!Array.isArray(store[recordKey])) {
            const daysInMonth = new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0).getDate();
            store[recordKey] = Array(daysInMonth).fill('Not Marked');
        }

        if (dayIndex >= 0 && dayIndex < store[recordKey].length) {
            store[recordKey][dayIndex] = status;
        }

        return store;
    }, {});
}

module.exports = createHandler({
    GET: async ({ res, db }) => {
        const records = await db.models.TeacherAttendance.findAll({
            order: [['date', 'ASC']]
        });
        sendJson(res, 200, {
            success: true,
            attendance: buildTeacherAttendanceStore(records)
        });
    },
    POST: async ({ res, db, body }) => {
        const TeacherAttendance = db.models.TeacherAttendance;
        const payload = Array.isArray(body) ? body : [body];

        for (const item of payload) {
            const teacherId = String(item?.teacherId || '').trim();
            const date = String(item?.date || '').trim();
            const status = normalizeStatus(item?.status);

            if (!teacherId || !date) {
                const error = new Error('teacherId and date are required.');
                error.statusCode = 400;
                throw error;
            }

            const recordId = `${teacherId}_${date}`;

            if (status === 'Not Marked') {
                await TeacherAttendance.destroy({ where: { id: recordId } });
                continue;
            }

            await TeacherAttendance.upsert({
                id: recordId,
                teacherId,
                date,
                status
            });
        }

        const records = await TeacherAttendance.findAll({
            order: [['date', 'ASC']]
        });

        sendJson(res, 200, {
            success: true,
            attendance: buildTeacherAttendanceStore(records)
        });
    }
}, { getDb });
