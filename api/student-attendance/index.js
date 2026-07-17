const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');

function normalizeStatus(status) {
    if (status === 'P') return 'Present';
    if (status === 'A') return 'Absent';
    if (status === 'Present' || status === 'Late' || status === 'Absent') return status;
    return 'Not Marked';
}

function buildStudentAttendanceStore(records) {
    return records.reduce((store, record) => {
        const studentId = String(record.studentId || '').trim();
        const date = String(record.date || '').trim();
        const status = normalizeStatus(record.status);

        if (!studentId || !date || status === 'Not Marked') {
            return store;
        }

        if (!Array.isArray(store[studentId])) {
            store[studentId] = [];
        }

        store[studentId].push({ date, status });
        store[studentId].sort((a, b) => a.date.localeCompare(b.date));
        return store;
    }, {});
}

module.exports = createHandler({
    GET: async ({ res, db }) => {
        const records = await db.models.StudentAttendance.findAll({
            order: [['date', 'ASC']]
        });
        sendJson(res, 200, {
            success: true,
            attendance: buildStudentAttendanceStore(records)
        });
    },
    POST: async ({ res, db, body }) => {
        const StudentAttendance = db.models.StudentAttendance;
        const payload = Array.isArray(body) ? body : [body];

        for (const item of payload) {
            const studentId = String(item?.studentId || '').trim();
            const date = String(item?.date || '').trim();
            const status = normalizeStatus(item?.status);

            if (!studentId || !date) {
                const error = new Error('studentId and date are required.');
                error.statusCode = 400;
                throw error;
            }

            const recordId = `${studentId}_${date}`;

            if (status === 'Not Marked') {
                await StudentAttendance.destroy({ where: { id: recordId } });
                continue;
            }

            await StudentAttendance.upsert({
                id: recordId,
                studentId,
                date,
                status
            });
        }

        const records = await StudentAttendance.findAll({
            order: [['date', 'ASC']]
        });

        sendJson(res, 200, {
            success: true,
            attendance: buildStudentAttendanceStore(records)
        });
    }
}, { getDb });
