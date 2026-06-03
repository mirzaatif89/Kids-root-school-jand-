const { Op } = require('sequelize');
const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');

module.exports = createHandler({
    POST: async ({ res, body, db }) => {
        const { studentId, feeMonth, challanNumbers } = body || {};
        const sid = String(studentId || '').trim();
        const month = String(feeMonth || '').trim();

        if (!sid || !month) {
            sendJson(res, 400, { success: false, message: 'studentId and feeMonth are required.' });
            return;
        }

        const { Student, FeePayment, FeeDueBalance } = db.models;
        const student = await Student.findByPk(sid);

        if (!student) {
            sendJson(res, 404, { success: false, message: 'Student not found.' });
            return;
        }

        const cleanChallans = Array.isArray(challanNumbers)
            ? challanNumbers.map((item) => String(item || '').trim()).filter(Boolean)
            : [];

        const where = {
            studentId: sid,
            status: { [Op.in]: ['Paid', 'Partial'] }
        };

        if (cleanChallans.length) {
            where.challanNumber = { [Op.in]: cleanChallans };
        } else {
            where.feeMonth = { [Op.like]: `%${month}%` };
        }

        const payments = await FeePayment.findAll({ where });
        if (!payments.length) {
            sendJson(res, 404, { success: false, message: 'No paid payment record found for this month.' });
            return;
        }

        const removedAmount = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        await FeePayment.update({
            status: 'Voided',
            paymentSource: 'Correction'
        }, { where });

        if (FeeDueBalance && removedAmount > 0) {
            const existingDue = await FeeDueBalance.findByPk(sid);
            const currentBalance = existingDue ? Number(existingDue.balance || 0) : 0;
            const safeCurrent = Number.isFinite(currentBalance) ? currentBalance : 0;

            await FeeDueBalance.upsert({
                studentId: sid,
                balance: safeCurrent + removedAmount,
                updatedAtLabel: new Date().toLocaleString('en-GB')
            });
        }

        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        if (month.toLowerCase() === months[new Date().getMonth()].toLowerCase()) {
            await Student.update({ feesStatus: 'Pending', paymentDate: null }, { where: { id: sid } });
        }

        sendJson(res, 200, {
            success: true,
            message: 'Fee marked as unpaid.',
            removedCount: payments.length,
            removedAmount
        });
    }
}, { getDb });
