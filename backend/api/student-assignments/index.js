const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');

function formatSubmission(record) {
    const raw = record && typeof record.toJSON === 'function' ? record.toJSON() : (record || {});
    return {
        id: raw.id || '',
        studentId: raw.studentId || '',
        studentCode: raw.studentCode || '',
        studentName: raw.studentName || '',
        rollNo: raw.rollNo || '',
        classGrade: raw.classGrade || '',
        assignmentTitle: raw.assignmentTitle || '',
        subject: raw.subject || '',
        note: raw.note || '',
        fileName: raw.fileName || '',
        fileType: raw.fileType || '',
        fileData: raw.fileData || '',
        submittedAt: raw.submittedAt || raw.createdAt || '',
        status: raw.status || 'Submitted'
    };
}

module.exports = createHandler({
    GET: async ({ res, db }) => {
        const records = await db.models.StudentAssignmentSubmission.findAll({
            order: [['submittedAt', 'DESC']]
        });
        sendJson(res, 200, { success: true, assignments: records.map(formatSubmission) });
    },
    POST: async ({ res, db, body }) => {
        const submittedAt = new Date().toISOString();
        const record = {
            id: body.id || `ASG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            studentId: body.studentId || '',
            studentCode: body.studentCode || '',
            studentName: body.studentName || 'Student',
            rollNo: body.rollNo || '',
            classGrade: body.classGrade || '',
            assignmentTitle: body.assignmentTitle || '',
            subject: body.subject || '',
            note: body.note || '',
            fileName: body.fileName || body.file?.name || '',
            fileType: body.fileType || body.file?.type || '',
            fileData: body.fileData || body.file?.dataUrl || '',
            submittedAt,
            status: 'Submitted'
        };

        if (!record.assignmentTitle) {
            sendJson(res, 400, { success: false, message: 'Assignment title is required.' });
            return;
        }

        await db.models.StudentAssignmentSubmission.upsert(record);
        const records = await db.models.StudentAssignmentSubmission.findAll({
            order: [['submittedAt', 'DESC']]
        });
        sendJson(res, 200, {
            success: true,
            assignment: formatSubmission(record),
            assignments: records.map(formatSubmission)
        });
    }
}, { getDb });
