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
        const paidAt = existingPayment?.paidAt || new Date();
        const paymentDateLabel = new Date(paidAt).toLocaleDateString('en-GB');

        await FeePayment.upsert({
            challanNumber: payload.challanNumber,
            studentId: payload.studentId,
            studentName: payload.studentName || student.fullName || '',
            rollNo: payload.rollNo || student.rollNo || '',
            classGrade: payload.classGrade || student.classGrade || '',
            session: payload.session || '',
            feeMonth: payload.feeMonth || '',
            amount: Number(payload.amount || student.monthlyFee || 0),
            status: 'Paid',
            paidAt,
            paymentDateLabel,
            paymentSource: 'QR Scan'
        });

        await Student.update({
            feesStatus: 'Paid',
            paymentDate: paymentDateLabel
        }, {
            where: { id: payload.studentId }
        });

        sendHtml(res, 200, renderFeePaymentPage({
            title: existingPayment?.status === 'Paid' ? 'Already Marked Paid' : 'Fee Marked Paid',
            message: existingPayment?.status === 'Paid'
                ? 'This challan was already scanned earlier. The payment remains recorded in the system.'
                : 'The fee has been marked as paid successfully in the system.',
            details: [
                { label: 'Student', value: payload.studentName || student.fullName || '-' },
                { label: 'Roll No', value: payload.rollNo || student.rollNo || '-' },
                { label: 'Class', value: payload.classGrade || student.classGrade || '-' },
                { label: 'Fee Month', value: payload.feeMonth || '-' },
                { label: 'Session', value: payload.session || '-' },
                { label: 'Amount', value: `PKR ${Number(payload.amount || student.monthlyFee || 0).toLocaleString('en-PK')}` },
                { label: 'Challan No.', value: payload.challanNumber || '-' },
                { label: 'Paid On', value: paymentDateLabel }
            ],
            success: true
        }));
    }
}, { getDb });
