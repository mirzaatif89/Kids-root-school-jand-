const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const { authenticateToken } = require('../_lib/services');
const {
    canReviewLeaves,
    createOwnLeaveRequest,
    formatLeaveRequest,
    ownLeaveWhere
} = require('../_lib/leave-requests');

module.exports = createHandler({
    GET: async ({ req, res, db }) => {
        const user = authenticateToken(req);
        const role = String(req.query?.role || '').trim();
        const where = ownLeaveWhere(user);
        if (canReviewLeaves(user) && ['Student', 'Teacher'].includes(role)) {
            where.applicantRole = role;
        }

        const records = await db.models.LeaveRequest.findAll({
            where,
            order: [['createdAt', 'DESC']]
        });
        sendJson(res, 200, { success: true, leaveRequests: records.map(formatLeaveRequest) });
    },
    POST: async ({ req, res, db, body }) => {
        const user = authenticateToken(req);
        const leaveRequest = await createOwnLeaveRequest(db, user, body);
        sendJson(res, 200, { success: true, leaveRequest });
    }
}, { getDb });
