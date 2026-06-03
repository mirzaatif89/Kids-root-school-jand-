const { sendSmtpEmail } = require('./mailer');
const { getSchoolEmailBranding, renderSchoolEmail } = require('./email-template');

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeEmail(value) {
    return normalizeText(value);
}

function formatLeaveDate(value) {
    const raw = normalizeText(value);
    if (!raw) return '-';
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    return parsed.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function buildLeaveReviewEmail(leaveRequest = {}) {
    const { schoolName } = getSchoolEmailBranding();
    const applicantRole = normalizeText(leaveRequest.applicantRole) || 'Student';
    const applicantName = normalizeText(leaveRequest.applicantName) || applicantRole;
    const status = normalizeText(leaveRequest.status) || 'Reviewed';
    const rows = [
        [applicantRole, applicantName],
        ...(applicantRole === 'Student'
            ? [
                ['Class', leaveRequest.classGrade || '-'],
                ['Roll No', leaveRequest.rollNo || '-']
            ]
            : [['Subject', leaveRequest.subject || '-']]),
        ['From Date', formatLeaveDate(leaveRequest.fromDate)],
        ['To Date', formatLeaveDate(leaveRequest.toDate)],
        ['Status', status],
        ...(status === 'Rejected' && normalizeText(leaveRequest.reviewReason)
            ? [['Rejection Reason', leaveRequest.reviewReason]]
            : [])
    ];
    const text = [
        `Dear ${applicantName},`,
        '',
        `Your leave request has been ${status.toLowerCase()}.`,
        '',
        ...rows.map(([label, value]) => `${label}: ${value}`),
        '',
        schoolName
    ].join('\n');
    const html = renderSchoolEmail({
        title: `Leave ${status}`,
        badge: 'Leave Request Update',
        preheader: `Your leave request has been ${status.toLowerCase()}.`,
        greeting: applicantName,
        intro: `Your leave request has been ${status.toLowerCase()}. The current status is also available in your portal leave history.`,
        accentColor: status === 'Approved' ? '#15803d' : '#b91c1c',
        rows,
        footerNote: 'For questions about this decision, please contact the school administration.'
    });

    return {
        to: normalizeEmail(leaveRequest.email),
        subject: `Leave Request ${status}`,
        text,
        html
    };
}

async function sendLeaveReviewEmail(leaveRequest = {}) {
    if (!['Approved', 'Rejected'].includes(normalizeText(leaveRequest.status))) {
        return { skipped: true, reason: 'Leave request is not approved or rejected.' };
    }
    if (!normalizeEmail(leaveRequest.email)) {
        return { skipped: true, reason: `${normalizeText(leaveRequest.applicantRole) || 'Applicant'} email is missing.` };
    }

    return sendSmtpEmail(buildLeaveReviewEmail(leaveRequest));
}

module.exports = {
    buildLeaveReviewEmail,
    sendLeaveReviewEmail
};
