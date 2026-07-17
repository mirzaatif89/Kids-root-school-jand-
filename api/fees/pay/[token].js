const { createHandler, sendHtml } = require('../../_lib/http');
const { getDb } = require('../../_lib/db');
const { JWT_SECRET, jwt, renderFeePaymentPage } = require('../../_lib/services');

module.exports = createHandler({
    GET: async ({ req, res, db }) => {
        let payload;

        try {
            payload = jwt.verify(req.query.token, JWT_SECRET);
        } catch (error) {
            sendHtml(res, 400, renderFeePaymentPage({
                title: 'Invalid QR Code',
                message: 'This QR code is invalid or has expired, so the fee could not be recorded.',
                success: false
            }));
            return;
        }

        const { Student, FeePayment } = db.models;
        const { FeeDueBalance } = db.models;
        const student = await Student.findByPk(payload.studentId);
        if (!student) {
            sendHtml(res, 404, renderFeePaymentPage({
                title: 'Student Not Found',
                message: 'This challan is valid, but the linked student record was not found.',
                success: false
            }));
            return;
        }

        const existingPayment = await FeePayment.findByPk(payload.challanNumber);
        const alreadyRecorded = existingPayment && ['Paid', 'Partial'].includes(String(existingPayment.status || ''));
        const paidAt = existingPayment?.paidAt || new Date();
        const paymentDateLabel = new Date(paidAt).toLocaleDateString('en-GB');

        const paymentAmount = Number(payload.amount || student.monthlyFee || 0);
        const fullAmount = Number(payload.fullAmount || payload.amount || student.monthlyFee || 0);
        const remainingDue = Math.max(fullAmount - paymentAmount, 0);
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

        let selectedMonths = normalizeMonthList(payload.feeMonths);
        if (!selectedMonths.length) selectedMonths = extractMonthList(payload.feeMonth);
        const monthsPaid = selectedMonths;
        const feeMonthRecorded = monthsPaid.length ? monthsPaid.join(', ') : 'Dues';

        await FeePayment.upsert({
            challanNumber: payload.challanNumber,
            studentId: payload.studentId,
            studentName: payload.studentName || student.fullName || '',
            rollNo: payload.rollNo || student.rollNo || '',
            classGrade: payload.classGrade || student.classGrade || '',
            session: payload.session || '',
            feeMonth: feeMonthRecorded,
            amount: paymentAmount,
            status: resolvedStatus,
            paidAt,
            paymentDateLabel,
            paymentSource: 'QR Scan'
        });

        if (!alreadyRecorded && FeeDueBalance) {
            const existingDue = await FeeDueBalance.findByPk(payload.studentId);
            const currentBalance = existingDue ? Number(existingDue.balance || 0) : 0;
            const safeCurrent = Number.isFinite(currentBalance) ? currentBalance : 0;
            const reducedBalance = Math.max(safeCurrent - paymentAmount, 0);

            await FeeDueBalance.upsert({
                studentId: payload.studentId,
                balance: reducedBalance,
                updatedAtLabel: new Date().toLocaleString('en-GB')
            });
        }

        const currentMonthName = MONTHS[new Date().getMonth()];
        const feeMonthRaw = String(payload.feeMonth || '');
        const feeMonthLower = feeMonthRaw.toLowerCase();
        const currentLower = currentMonthName.toLowerCase();
        const currentShortLower = currentMonthName.slice(0, 3).toLowerCase();
        const shouldUpdateCurrentMonthStatus = feeMonthLower.includes(currentLower) || feeMonthLower.includes(currentShortLower);

        const currentMonthPaid = monthsPaid.some((month) => {
            const lower = String(month || '').toLowerCase();
            return lower === currentLower || lower === currentShortLower;
        });
        if (resolvedStatus === 'Paid' && (shouldUpdateCurrentMonthStatus || currentMonthPaid) && monthsPaid.length) {
            await Student.update({
                feesStatus: 'Paid',
                paymentDate: paymentDateLabel
            }, {
                where: { id: payload.studentId }
            });
        }

        sendHtml(res, 200, renderFeePaymentPage({
            title: alreadyRecorded ? 'Already Recorded' : (resolvedStatus === 'Paid' ? 'Fee Marked Paid' : 'Payment Recorded'),
            message: alreadyRecorded
                ? 'This challan was already scanned earlier. The payment remains recorded in the system.'
                : (resolvedStatus === 'Paid'
                    ? 'The fee has been marked as paid successfully in the system.'
                    : 'Payment has been recorded. Remaining amount is still due.'),
            details: [
                { label: 'Student', value: payload.studentName || student.fullName || '-' },
                { label: 'Roll No', value: payload.rollNo || student.rollNo || '-' },
                { label: 'Class', value: payload.classGrade || student.classGrade || '-' },
                { label: 'Fee Month', value: payload.feeMonth || '-' },
                { label: 'Session', value: payload.session || '-' },
                { label: 'Amount', value: `PKR ${Number(paymentAmount || 0).toLocaleString('en-PK')}` },
                ...(remainingDue > 0 ? [{ label: 'Remaining Due', value: `PKR ${Number(remainingDue || 0).toLocaleString('en-PK')}` }] : []),
                { label: 'Challan No.', value: payload.challanNumber || '-' },
                { label: 'Paid On', value: paymentDateLabel }
            ],
            success: true
        }));
    }
}, { getDb });
