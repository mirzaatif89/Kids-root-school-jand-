const { createHandler, sendJson } = require('../_lib/http');
const { createChallanToken } = require('../_lib/services');

module.exports = createHandler({
    POST: async ({ req, res, body }) => {
        const {
            studentId,
            studentName,
            rollNo,
            classGrade,
            feeMonth,
            session,
            amount,
            challanNumber
        } = body || {};

        if (!studentId || !feeMonth || !challanNumber) {
            sendJson(res, 400, {
                success: false,
                message: 'Student, fee month, and challan number are required.'
            });
            return;
        }

        const result = await createChallanToken(req, {
            studentId,
            studentName: studentName || '',
            rollNo: rollNo || '',
            classGrade: classGrade || '',
            feeMonth,
            session: session || '',
            amount: Number(amount || 0),
            challanNumber
        });

        sendJson(res, 200, {
            success: true,
            ...result
        });
    }
});
