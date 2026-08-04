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
        campusName: raw.campusName || '',
        sourceAssignmentId: raw.sourceAssignmentId || '',
        sourceAssignmentTitle: raw.sourceAssignmentTitle || '',
        sourceAssignmentDueDate: raw.sourceAssignmentDueDate || '',
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

function normalizeSubmissionPayload(body = {}) {
    const raw = body && typeof body === 'object' ? body : {};
    const submittedAt = String(raw.submittedAt || '').trim() || new Date().toISOString();
    const id = String(raw.id || '').trim() || `ASG-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return {
        id,
        studentId: String(raw.studentId || '').trim(),
        studentCode: String(raw.studentCode || '').trim(),
        studentName: String(raw.studentName || 'Student').trim() || 'Student',
        rollNo: String(raw.rollNo || '').trim(),
        classGrade: String(raw.classGrade || '').trim(),
        campusName: String(raw.campusName || '').trim(),
        sourceAssignmentId: String(raw.sourceAssignmentId || '').trim(),
        sourceAssignmentTitle: String(raw.sourceAssignmentTitle || '').trim(),
        sourceAssignmentDueDate: String(raw.sourceAssignmentDueDate || '').trim(),
        assignmentTitle: String(raw.assignmentTitle || '').trim(),
        subject: String(raw.subject || '').trim(),
        note: String(raw.note || '').trim(),
        fileName: String(raw.fileName || raw.file?.name || '').trim(),
        fileType: String(raw.fileType || raw.file?.type || '').trim(),
        fileData: String(raw.fileData || raw.file?.dataUrl || ''),
        submittedAt,
        status: 'Submitted'
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
        const payload = Array.isArray(body) ? body : [body];
        const submissions = payload.map(normalizeSubmissionPayload).filter((item) => item.assignmentTitle);

        if (!submissions.length) {
            sendJson(res, 400, { success: false, message: 'Assignment title is required.' });
            return;
        }

        for (const submission of submissions) {
            await db.models.StudentAssignmentSubmission.upsert(submission);
        }

        const records = await db.models.StudentAssignmentSubmission.findAll({
            order: [['submittedAt', 'DESC']]
        });
        sendJson(res, 200, {
            success: true,
            assignment: formatSubmission(submissions[0]),
            assignments: records.map(formatSubmission)
        });
    }
}, { getDb });
