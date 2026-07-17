const REVIEW_STATUSES = new Set(['Approved', 'Rejected']);

function trim(value) {
    return String(value || '').trim();
}

function throwHttp(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
}

function formatLeaveRequest(record) {
    const raw = record && typeof record.toJSON === 'function' ? record.toJSON() : record;
    return {
        ...raw,
        applicantRole: trim(raw?.applicantRole),
        applicantId: trim(raw?.applicantId),
        applicantName: trim(raw?.applicantName),
        status: trim(raw?.status) || 'Pending'
    };
}

function canReviewLeaves(user = {}) {
    return !['Student', 'Teacher'].includes(trim(user.role));
}

function ownLeaveWhere(user = {}) {
    if (user.role === 'Student') return { applicantRole: 'Student', applicantId: trim(user.id) };
    if (user.role === 'Teacher') return { applicantRole: 'Teacher', applicantId: trim(user.id) };
    return {};
}

function readReviewStatus(value) {
    const status = trim(value);
    return REVIEW_STATUSES.has(status) ? status : '';
}

async function resolveApplicant(db, user) {
    if (user.role === 'Student') {
        const student = await db.models.Student.findByPk(user.id);
        if (!student) throwHttp(404, 'Student record not found.');
        return {
            applicantRole: 'Student',
            applicantId: trim(student.id),
            applicantName: student.fullName || user.fullName || 'Student',
            email: student.email || user.email || '',
            studentCode: student.studentCode || '',
            rollNo: student.rollNo || '',
            classGrade: student.classGrade || '',
            campusName: student.campusName || user.campusName || ''
        };
    }

    if (user.role === 'Teacher') {
        const teacher = await db.models.Teacher.findByPk(user.id);
        if (!teacher) throwHttp(404, 'Teacher record not found.');
        return {
            applicantRole: 'Teacher',
            applicantId: trim(teacher.id),
            applicantName: teacher.fullName || user.fullName || 'Teacher',
            email: teacher.email || user.email || '',
            subject: teacher.subject || '',
            campusName: teacher.campusName || user.campusName || ''
        };
    }

    throwHttp(403, 'Student or teacher portal access required.');
}

async function createOwnLeaveRequest(db, user, body = {}) {
    const fromDate = trim(body.fromDate);
    const toDate = trim(body.toDate);
    const reason = trim(body.reason);
    if (!fromDate || !toDate || !reason) {
        throwHttp(400, 'Leave dates and reason are required.');
    }
    if (toDate < fromDate) {
        throwHttp(400, 'Leave end date cannot be before the start date.');
    }

    const applicant = await resolveApplicant(db, user);
    const id = trim(body.id) || `${applicant.applicantRole === 'Teacher' ? 'TLEAVE' : 'LEAVE'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const existing = await db.models.LeaveRequest.findByPk(id);
    if (existing && (existing.applicantRole !== applicant.applicantRole || existing.applicantId !== applicant.applicantId)) {
        throwHttp(403, 'This leave request belongs to another portal user.');
    }
    if (existing && trim(existing.status) !== 'Pending') {
        throwHttp(409, 'Reviewed leave requests cannot be edited.');
    }

    const payload = {
        id,
        ...applicant,
        fromDate,
        toDate,
        reason,
        fileName: trim(body.fileName),
        fileType: trim(body.fileType),
        fileData: body.fileData ? String(body.fileData) : '',
        status: 'Pending',
        reviewReason: null,
        reviewedAt: null,
        reviewEmailSentAt: null
    };
    await db.models.LeaveRequest.upsert(payload);
    return formatLeaveRequest(await db.models.LeaveRequest.findByPk(id));
}

module.exports = {
    canReviewLeaves,
    createOwnLeaveRequest,
    formatLeaveRequest,
    ownLeaveWhere,
    readReviewStatus,
    throwHttp
};
