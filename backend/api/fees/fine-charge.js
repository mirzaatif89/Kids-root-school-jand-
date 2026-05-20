const { Op } = require('sequelize');
const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');

module.exports = createHandler({
    POST: async ({ res, body, db }) => {
        const { studentId, studentName, rollNo, classGrade, session, feeMonth, fineAmount } = body || {};
        const sid = String(studentId || '').trim();
        const month = String(feeMonth || '').trim();
        const amount = Math.max(Number(fineAmount || 0), 0);

        if (!sid || !month) {
            sendJson(res, 400, { success: false, message: 'Student and month are required.' });
            return;
        }

        const { Student, FeePayment } = db.models;
        const student = await Student.findByPk(sid);
        if (!student) {
            sendJson(res, 404, { success: false, message: 'Student not found.' });
            return;
        }

        await FeePayment.update({
            status: 'Voided',
            paymentSource: 'Fine Correction'
        }, {
            where: {
                studentId: sid,
                paymentSource: 'Fine',
                feeMonth: { [Op.like]: `%${month}%` },
                status: { [Op.in]: ['Paid', 'Partial'] }
            }
        });

        let finePayment = null;
        if (amount > 0) {
            const paidAt = new Date();
            finePayment = {
                challanNumber: `FINE-${sid}-${month.replace(/[^a-z0-9]/gi, '').toUpperCase()}`,
                studentId: sid,
                studentName: studentName || student.fullName || '',
                rollNo: rollNo || student.rollNo || '',
                classGrade: classGrade || student.classGrade || '',
                session: session || '',
                feeMonth: `Fine - ${month}`,
                amount,
                status: 'Paid',
                paidAt,
                paymentDateLabel: paidAt.toLocaleDateString('en-GB'),
                paymentSource: 'Fine'
            };
            await FeePayment.upsert(finePayment);
        }

        sendJson(res, 200, { success: true, finePayment, fineAmount: amount });
    }
}, { getDb });
