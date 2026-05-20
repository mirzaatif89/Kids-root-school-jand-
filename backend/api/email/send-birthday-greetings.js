const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const { sendBirthdayStudentEmails } = require('../_lib/student-emails');

module.exports = createHandler({
    POST: async ({ res, body, db }) => {
        const result = await sendBirthdayStudentEmails(db, {
            force: body?.force === true
        });

        sendJson(res, 200, {
            success: true,
            message: `Birthday emails sent: ${result.sent}.`,
            ...result
        });
    }
}, { getDb });
