const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const { sendPendingFeeReminderEmails } = require('../_lib/fee-reminders');

module.exports = createHandler({
    POST: async ({ res, db, body }) => {
        const result = await sendPendingFeeReminderEmails(db, {
            force: body?.force === true,
            studentIds: Array.isArray(body?.studentIds) ? body.studentIds : undefined
        });

        sendJson(res, 200, {
            success: true,
            message: `Pending fee reminders sent: ${result.sent}.`,
            ...result
        });
    }
}, { getDb });
