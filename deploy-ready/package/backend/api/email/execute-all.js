const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const { sendPendingFeeReminderEmails } = require('../_lib/fee-reminders');
const { sendBirthdayStudentEmails, sendSpecialNoticeStudentEmails } = require('../_lib/student-emails');

function parseNoticeTargets(value) {
    if (Array.isArray(value)) return value;
    try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        return [];
    }
}

function formatNotice(record) {
    const raw = record && typeof record.toJSON === 'function' ? record.toJSON() : record;
    return {
        ...raw,
        targetPortals: parseNoticeTargets(raw?.targetPortals)
    };
}

module.exports = createHandler({
    POST: async ({ res, db, body }) => {
        const force = body?.force === true;
        const result = {
            pendingFees: { attempted: 0, sent: 0, skipped: 0, failed: [] },
            birthdays: { attempted: 0, sent: 0, skipped: 0, failed: [] },
            specialNotices: { attempted: 0, sent: 0, skipped: 0, failed: [] }
        };

        result.pendingFees = await sendPendingFeeReminderEmails(db, { force });
        result.birthdays = await sendBirthdayStudentEmails(db, { force });

        const notices = await db.models.SpecialNotice.findAll({
            where: { status: 'executed' },
            order: [['updatedAt', 'DESC']]
        });

        for (const noticeRecord of notices.map(formatNotice).filter((notice) => notice.targetPortals.includes('student'))) {
            const noticeResult = await sendSpecialNoticeStudentEmails(db, noticeRecord, { force });
            result.specialNotices.attempted += Number(noticeResult.attempted || 0);
            result.specialNotices.sent += Number(noticeResult.sent || 0);
            result.specialNotices.skipped += Number(noticeResult.skipped || 0);
            result.specialNotices.failed.push(...(Array.isArray(noticeResult.failed) ? noticeResult.failed : []));
        }

        const totalSent = result.pendingFees.sent + result.birthdays.sent + result.specialNotices.sent;
        const totalFailed = result.pendingFees.failed.length + result.birthdays.failed.length + result.specialNotices.failed.length;

        sendJson(res, 200, {
            success: true,
            message: `All email jobs executed. Sent: ${totalSent}. Failed: ${totalFailed}.`,
            totalSent,
            totalFailed,
            result
        });
    }
}, { getDb });
