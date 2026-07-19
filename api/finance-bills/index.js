const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');

function normalizeFinanceBillPayload(input = {}) {
    const id = String(input.id || '').trim() || `BILL-${Date.now()}`;
    const status = String(input.status || 'Pending').trim();
    const amount = Math.max(Number(input.amount || 0), 0);

    return {
        id,
        category: String(input.category || '').trim(),
        amount,
        date: String(input.date || input.billDate || '').trim(),
        status: status || 'Pending',
        note: String(input.note || '').trim(),
        campusName: String(input.campusName || input.branchName || input.campus || '').trim(),
        invoice: input.invoice || null,
        receipt: input.receipt || null,
        paymentConfirmedDate: input.paymentConfirmedDate || null
    };
}

module.exports = createHandler({
    GET: async ({ res, db }) => {
        const { FinanceBill } = db.models;
        const bills = await FinanceBill.findAll({ order: [['date', 'DESC'], ['createdAt', 'DESC']] });
        sendJson(res, 200, { success: true, bills });
    },

    POST: async ({ res, body, db }) => {
        const { FinanceBill } = db.models;
        const bill = normalizeFinanceBillPayload(body || {});

        if (!bill.category) {
            sendJson(res, 400, { success: false, message: 'Bill category is required.' });
            return;
        }

        await FinanceBill.upsert(bill);
        const saved = await FinanceBill.findByPk(bill.id);
        sendJson(res, 200, { success: true, bill: saved });
    },

    DELETE: async ({ req, res, body, db }) => {
        const { FinanceBill } = db.models;
        const requestUrl = new URL(req.url, 'http://localhost');
        const id = String(requestUrl.searchParams.get('id') || body?.id || '').trim();

        if (!id) {
            sendJson(res, 400, { success: false, message: 'Bill id is required.' });
            return;
        }

        const deleted = await FinanceBill.destroy({ where: { id } });
        sendJson(res, 200, { success: true, deleted });
    }
}, { getDb });
