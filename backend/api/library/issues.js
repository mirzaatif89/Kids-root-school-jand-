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
    GET: async ({ res, db }) => {
        const records = await db.models.LibraryIssue.findAll({ order: [['updatedAt', 'DESC']] });
        sendJson(res, 200, { success: true, issues: records.map(formatLibraryIssue) });
    },
    POST: async ({ res, body, db }) => {
        const payload = body || {};
        const id = String(payload.id || `LIB-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).trim();
        const bookTitle = String(payload.bookTitle || '').trim();
        const bookNumber = String(payload.bookNumber || '').trim();
        const studentId = String(payload.studentId || '').trim();
        const issueDate = String(payload.issueDate || new Date().toISOString().slice(0, 10)).trim();
        const loanDays = Math.max(Number.parseInt(payload.loanDays || '7', 10) || 7, 1);

        if (!bookTitle || !bookNumber || !studentId) {
            sendJson(res, 400, { success: false, message: 'Book title, book number, and student are required.' });
            return;
        }

        const issueDateValue = new Date(`${issueDate}T00:00:00`);
        const dueDateValue = new Date(issueDateValue);
        dueDateValue.setDate(dueDateValue.getDate() + loanDays);
        const dueDate = payload.dueDate || dueDateValue.toISOString().slice(0, 10);

        const record = {
            id,
            bookTitle,
            bookNumber,
            accessionNumber: String(payload.accessionNumber || '').trim(),
            isbn: String(payload.isbn || '').trim(),
            author: String(payload.author || '').trim(),
            category: String(payload.category || '').trim(),
            shelfLocation: String(payload.shelfLocation || '').trim(),
            studentId,
            studentName: String(payload.studentName || '').trim(),
            rollNo: String(payload.rollNo || '').trim(),
            classGrade: String(payload.classGrade || '').trim(),
            fatherName: String(payload.fatherName || '').trim(),
            parentPhone: String(payload.parentPhone || '').trim(),
            studentEmail: String(payload.studentEmail || '').trim(),
            issueDate,
            loanDays,
            dueDate,
            returnDate: payload.returnDate || null,
            status: payload.status === 'Returned' || payload.status === 'Lost' ? payload.status : 'Issued',
            finePerDay: Number(payload.finePerDay || 0),
            conditionIssue: String(payload.conditionIssue || '').trim(),
            conditionReturn: String(payload.conditionReturn || '').trim(),
            notes: String(payload.notes || '').trim()
        };

        await db.models.LibraryIssue.upsert(record);
        const records = await db.models.LibraryIssue.findAll({ order: [['updatedAt', 'DESC']] });
        sendJson(res, 200, { success: true, issue: formatLibraryIssue(record), issues: records.map(formatLibraryIssue) });
    }
}, { getDb });
