const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const { authenticateToken } = require('../_lib/services');
const { sendLeaveReviewEmail } = require('../_lib/leave-emails');
const {
    canReviewLeaves,
    formatLeaveRequest,
    readReviewStatus,
    throwHttp
} = require('../_lib/leave-requests');

function routeId(req) {
    return String(req.query?.id || req.params?.id || '').trim();
}

module.exports = createHandler({
    POST: async ({ req, res, db, body }) => {
        const user = authenticateToken(req);
        if (!canReviewLeaves(user)) throwHttp(403, 'Admin or staff access required.');
        const status = readReviewStatus(body?.status);
        if (!status) throwHttp(400, 'Review status must be Approved or Rejected.');
        const reviewReason = String(body?.reviewReason || '').trim();
        if (status === 'Rejected' && !reviewReason) throwHttp(400, 'Rejection reason is required.');

        const record = await db.models.LeaveRequest.findByPk(routeId(req));
        if (!record) throwHttp(404, 'Leave request not found.');

        await record.update({
            status,
            reviewReason: status === 'Rejected' ? reviewReason : '',
            reviewedAt: new Date().toISOString()
        });
        const leaveRequest = formatLeaveRequest(record);
        let emailResult = null;
        try {
            emailResult = await sendLeaveReviewEmail(leaveRequest);
            if (!emailResult?.skipped) {
                await record.update({ reviewEmailSentAt: new Date().toISOString() });
            }
        } catch (error) {
            emailResult = { success: false, message: error.message || 'Leave status email could not be sent.' };
        }

        sendJson(res, 200, {
            success: true,
            leaveRequest: formatLeaveRequest(record),
            emailResult
        });
    },
    DELETE: async ({ req, res, db }) => {
        const user = authenticateToken(req);
        const record = await db.models.LeaveRequest.findByPk(routeId(req));
        if (!record) {
            sendJson(res, 200, { success: true, deleted: false });
            return;
        }

        const ownPendingRequest = ['Student', 'Teacher'].includes(user.role)
            && record.applicantRole === user.role
            && String(record.applicantId) === String(user.id)
            && String(record.status || 'Pending') === 'Pending';
        if (!canReviewLeaves(user) && !ownPendingRequest) {
            throwHttp(403, 'Only pending portal leave requests can be deleted.');
        }

        await record.destroy();
        sendJson(res, 200, { success: true, deleted: true });
    }
}, { getDb });
