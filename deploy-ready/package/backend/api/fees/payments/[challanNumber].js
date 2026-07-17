const { createHandler, sendJson } = require('../../_lib/http');
const { getDb } = require('../../_lib/db');
const { authenticateToken } = require('../../_lib/services');

function assertAdmin(req) {
    const user = authenticateToken(req);
    if (String(user?.role || '').trim() !== 'Admin') {
        const error = new Error('Admin access required.');
        error.statusCode = 403;
        throw error;
    }
}

function parsePaymentDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const slashDate = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (slashDate) {
        const parsed = new Date(Number(slashDate[3]), Number(slashDate[2]) - 1, Number(slashDate[1]));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getChallanNumber(req) {
    return String(req.query?.challanNumber || '').trim();
}

module.exports = createHandler({
    PUT: async ({ req, res, db, body }) => {
        assertAdmin(req);
        const challanNumber = getChallanNumber(req);
        const { FeePayment } = db.models;
        const payment = await FeePayment.findByPk(challanNumber);
        if (!payment) {
            sendJson(res, 404, { success: false, message: 'Payment record not found.' });
            return;
        }

        const amount = Math.max(Number(body?.amount || 0), 0);
        const status = ['Paid', 'Partial'].includes(String(body?.status || '')) ? String(body.status) : payment.status;
        const paidAt = parsePaymentDate(body?.paidAt || body?.paymentDate || body?.paymentDateLabel) || payment.paidAt || new Date();

        payment.amount = amount;
        payment.status = status;
        payment.paidAt = paidAt;
        payment.paymentDateLabel = paidAt.toLocaleDateString('en-GB');
        if (String(body?.feeMonth || '').trim()) payment.feeMonth = String(body.feeMonth).trim();
        if (String(body?.paymentSource || '').trim()) payment.paymentSource = String(body.paymentSource).trim();
        await payment.save();

        sendJson(res, 200, { success: true, payment });
    },
    DELETE: async ({ req, res, db }) => {
        assertAdmin(req);
        const challanNumber = getChallanNumber(req);
        const { FeePayment } = db.models;
        const payment = await FeePayment.findByPk(challanNumber);
        if (!payment) {
            sendJson(res, 404, { success: false, message: 'Payment record not found.' });
            return;
        }

        payment.status = 'Voided';
        payment.paymentSource = 'Correction';
        await payment.save();

        sendJson(res, 200, { success: true, message: 'Payment record deleted.', payment });
    }
}, { getDb });
