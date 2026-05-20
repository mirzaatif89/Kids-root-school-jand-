const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');

function normalizeLibraryStatus(item = {}) {
    const status = String(item.status || 'Issued').trim();
    if (status === 'Returned' || status === 'Lost') return status;
    const due = new Date(`${item.dueDate}T23:59:59`);
    if (item.dueDate && !Number.isNaN(due.getTime()) && due < new Date()) return 'Overdue';
    return 'Issued';
}

function formatLibraryIssue(record) {
    const raw = record && typeof record.toJSON === 'function' ? record.toJSON() : record;
    return {
        ...raw,
        status: normalizeLibraryStatus(raw),
        loanDays: Number(raw.loanDays || 0),
        finePerDay: Number(raw.finePerDay || 0)
    };
}

module.exports = createHandler({
    POST: async ({ req, res, body, db }) => {
        const id = String(req.query?.id || body?.id || '').trim();
        const issue = await db.models.LibraryIssue.findByPk(id);
        if (!issue) {
            sendJson(res, 404, { success: false, message: 'Library record not found.' });
            return;
        }

        await issue.update({
            status: 'Returned',
            returnDate: body?.returnDate || new Date().toISOString().slice(0, 10),
            conditionReturn: String(body?.conditionReturn || issue.conditionReturn || '').trim(),
            notes: String(body?.notes || issue.notes || '').trim()
        });

        const records = await db.models.LibraryIssue.findAll({ order: [['updatedAt', 'DESC']] });
        sendJson(res, 200, { success: true, issue: formatLibraryIssue(issue), issues: records.map(formatLibraryIssue) });
    },
    DELETE: async ({ req, res, db }) => {
        const id = String(req.query?.id || '').trim();
        await db.models.LibraryIssue.destroy({ where: { id } });
        const records = await db.models.LibraryIssue.findAll({ order: [['updatedAt', 'DESC']] });
        sendJson(res, 200, { success: true, issues: records.map(formatLibraryIssue) });
    }
}, { getDb });
