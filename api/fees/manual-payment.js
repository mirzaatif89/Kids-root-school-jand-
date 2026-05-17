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

        const paymentAmount = Number(amount || 0);
        const safeFullAmount = Number(fullAmount || amount || student.monthlyFee || 0);
        const remainingDue = Math.max(safeFullAmount - paymentAmount, 0);
        const resolvedStatus = remainingDue > 0 ? 'Partial' : 'Paid';

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

        const existingPayment = await FeePayment.findByPk(safeChallanNumber);
        const alreadyRecorded = existingPayment && ['Paid', 'Partial'].includes(String(existingPayment.status || ''));
        const paidAt = existingPayment?.paidAt || new Date();
        const paymentDateLabel = new Date(paidAt).toLocaleDateString('en-GB');

        const paymentRow = {
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
        };

        await FeePayment.upsert(paymentRow);

        if (!alreadyRecorded && FeeDueBalance) {
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

        if (currentMonthPaid && resolvedStatus === 'Paid') {
            await Student.update({
                feesStatus: 'Paid',
                paymentDate: paymentDateLabel
            }, {
                where: { id: studentId }
            });
        }

        let emailResult = null;
        let fineEmailResult = null;
        if (!alreadyRecorded && Number(fineAmount || 0) > 0) {
            try {
                fineEmailResult = await sendFineAppliedEmail(db, {
                    studentId,
                    studentName: studentName || student.fullName || '',
                    rollNo: rollNo || student.rollNo || '',
                    classGrade: classGrade || student.classGrade || '',
                    feeMonth: feeMonthRecorded,
                    fullAmount: safeFullAmount,
                    fineAmount: Number(fineAmount || 0),
                    challanNumber: safeChallanNumber
                });
            } catch (error) {
                fineEmailResult = { success: false, message: error.message || 'Fine email could not be sent.' };
            }
        }

        if (!alreadyRecorded && resolvedStatus === 'Paid') {
            try {
                emailResult = await sendFeePaymentConfirmationEmail(student, paymentRow, remainingDue);
            } catch (error) {
                emailResult = { success: false, message: error.message || 'Fee paid email could not be sent.' };
            }
        }

        sendJson(res, 200, { success: true, payment: paymentRow, alreadyRecorded, emailResult, fineEmailResult });
    }
}, { getDb });
