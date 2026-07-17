const { Op } = require('sequelize');
const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');
const { sendFeePaymentConfirmationEmail } = require('../_lib/fee-reminders');
const { sendFineAppliedEmail } = require('../_lib/student-emails');

module.exports = createHandler({
    POST: async ({ req, res, body, db }) => {
        const {
            studentId,
            studentName,
            rollNo,
            classGrade,
            feeMonth,
            feeMonths,
            session,
            amount,
            fullAmount,
            fineAmount,
            paymentMode,
            paymentDate,
            challanNumber
        } = body || {};

        if (!studentId) {
            sendJson(res, 400, { success: false, message: 'studentId is required.' });
            return;
        }

        const { Student, FeePayment, FeeDueBalance } = db.models;
        const student = await Student.findByPk(studentId);
        if (!student) {
            sendJson(res, 404, { success: false, message: 'Student not found.' });
            return;
        }

        const requestedPaymentAmount = Math.max(Number(amount || 0), 0);
        const safeFineAmount = Math.max(Number(fineAmount || 0), 0);
        const fineOnly = String(paymentMode || '').toLowerCase() === 'fine' || (requestedPaymentAmount <= 0 && safeFineAmount > 0);
        const safeFullAmount = Number(fullAmount || student.monthlyFee || 0);

        if (!fineOnly && safeFullAmount <= 0) {
            sendJson(res, 400, { success: false, message: 'Monthly fee is not set for this student.' });
            return;
        }

        const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const normalizeMonthList = (value) => Array.isArray(value)
            ? value.map((item) => String(item || '').trim()).filter(Boolean)
            : [];
        const extractMonthList = (value) => {
            const lower = String(value || '').toLowerCase();
            return MONTHS.filter((month) => {
                const full = month.toLowerCase();
                const short = month.slice(0, 3).toLowerCase();
                return lower.includes(full) || lower.includes(short);
            });
        };

        let selectedMonths = normalizeMonthList(feeMonths);
        if (!selectedMonths.length) selectedMonths = extractMonthList(feeMonth);

        const feeMonthRecorded = selectedMonths.length ? selectedMonths.join(', ') : 'Dues';
        const safeChallanNumber = String(challanNumber || '').trim() || `MAN-${Date.now()}`;
        const existingMonthPayments = fineOnly ? [] : await FeePayment.findAll({
            where: {
                studentId,
                status: { [Op.in]: ['Paid', 'Partial'] },
                paymentSource: { [Op.notIn]: ['Fine', 'Fine Correction'] }
            }
        });
        const existingPaidForMonth = existingMonthPayments.reduce((sum, payment) => {
            const paymentMonths = extractMonthList(payment.feeMonth);
            const overlaps = selectedMonths.some((month) => paymentMonths.includes(month));
            return overlaps ? sum + Number(payment.amount || 0) : sum;
        }, 0);
        const remainingBeforePayment = Math.max(safeFullAmount - existingPaidForMonth, 0);
        const paymentAmount = fineOnly ? 0 : Math.min(requestedPaymentAmount, remainingBeforePayment);
        const remainingDue = Math.max(safeFullAmount - existingPaidForMonth - paymentAmount, 0);
        const resolvedStatus = remainingDue > 0 ? 'Partial' : 'Paid';

        const existingPayment = fineOnly ? null : await FeePayment.findByPk(safeChallanNumber);
        const alreadyRecorded = existingPayment && ['Paid', 'Partial'].includes(String(existingPayment.status || ''));
        const parsePaymentDate = (value) => {
            const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!match) return null;
            const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };
        const paidAt = existingPayment?.paidAt || parsePaymentDate(paymentDate) || new Date();
        const paymentDateLabel = new Date(paidAt).toLocaleDateString('en-GB');

        const paymentRow = !fineOnly && paymentAmount > 0 ? {
            challanNumber: safeChallanNumber,
            studentId,
            studentName: studentName || student.fullName || '',
            rollNo: rollNo || student.rollNo || '',
            classGrade: classGrade || student.classGrade || '',
            session: session || '',
            feeMonth: feeMonthRecorded,
            amount: paymentAmount,
            status: resolvedStatus,
            paidAt,
            paymentDateLabel,
            paymentSource: 'Manual'
        } : null;

        if (paymentRow) {
            await FeePayment.upsert(paymentRow);
        }

        let fineRow = null;
        if (safeFineAmount > 0) {
            const fineChallanNumber = `${safeChallanNumber}-FINE`;
            fineRow = {
                challanNumber: fineChallanNumber,
                studentId,
                studentName: studentName || student.fullName || '',
                rollNo: rollNo || student.rollNo || '',
                classGrade: classGrade || student.classGrade || '',
                session: session || '',
                feeMonth: `Fine - ${feeMonthRecorded}`,
                amount: safeFineAmount,
                status: 'Paid',
                paidAt,
                paymentDateLabel,
                paymentSource: 'Fine'
            };
            await FeePayment.upsert(fineRow);
        }

        if (!alreadyRecorded && FeeDueBalance && paymentAmount > 0) {
            const existingDue = await FeeDueBalance.findByPk(studentId);
            const currentBalance = existingDue ? Number(existingDue.balance || 0) : 0;
            const safeCurrent = Number.isFinite(currentBalance) ? currentBalance : 0;
            const reducedBalance = Math.max(safeCurrent - paymentAmount, 0);

            await FeeDueBalance.upsert({
                studentId,
                balance: reducedBalance,
                updatedAtLabel: new Date().toLocaleString('en-GB')
            });
        }

        const currentMonthName = MONTHS[new Date().getMonth()];
        const currentLower = currentMonthName.toLowerCase();
        const currentShortLower = currentMonthName.slice(0, 3).toLowerCase();
        const currentMonthPaid = selectedMonths.some((month) => {
            const lower = String(month || '').toLowerCase();
            return lower === currentLower || lower === currentShortLower;
        });

        if (paymentRow && currentMonthPaid && resolvedStatus === 'Paid') {
            await Student.update({
                feesStatus: 'Paid',
                paymentDate: paymentDateLabel
            }, {
                where: { id: studentId }
            });
        }

        let emailResult = null;
        let fineEmailResult = null;
        if (safeFineAmount > 0) {
            try {
                fineEmailResult = await sendFineAppliedEmail(db, {
                    studentId,
                    studentName: studentName || student.fullName || '',
                    rollNo: rollNo || student.rollNo || '',
                    classGrade: classGrade || student.classGrade || '',
                    feeMonth: feeMonthRecorded,
                    fullAmount: safeFullAmount + safeFineAmount,
                    fineAmount: safeFineAmount,
                    challanNumber: fineRow?.challanNumber || safeChallanNumber
                });
            } catch (error) {
                fineEmailResult = { success: false, message: error.message || 'Fine email could not be sent.' };
            }
        }

        if (paymentRow && !alreadyRecorded && resolvedStatus === 'Paid') {
            try {
                emailResult = await sendFeePaymentConfirmationEmail(student, paymentRow, remainingDue);
            } catch (error) {
                emailResult = { success: false, message: error.message || 'Fee paid email could not be sent.' };
            }
        }

        sendJson(res, 200, { success: true, payment: paymentRow || fineRow, finePayment: fineRow, alreadyRecorded, emailResult, fineEmailResult });
    }
}, { getDb });
