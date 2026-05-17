const { createHandler, sendJson } = require('../_lib/http');
const { createChallanToken } = require('../_lib/services');

module.exports = createHandler({
    POST: async ({ req, res, body }) => {
        const items = Array.isArray(body) ? body : body?.items;

        if (!Array.isArray(items) || !items.length) {
            sendJson(res, 400, { success: false, message: 'items array is required.' });
            return;
        }

        if (items.length > 250) {
            sendJson(res, 400, { success: false, message: 'Too many challans requested at once.' });
            return;
        }

        const tokens = [];
        for (const item of items) {
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
                challanNumber
            } = item || {};

            if (!studentId || !feeMonth || !challanNumber) {
                sendJson(res, 400, {
                    success: false,
                    message: 'studentId, feeMonth, and challanNumber are required.'
                });
                return;
            }

            const result = await createChallanToken(req, {
                studentId,
                studentName: studentName || '',
                rollNo: rollNo || '',
                classGrade: classGrade || '',
                feeMonth,
                feeMonths: Array.isArray(feeMonths) ? feeMonths : [],
                session: session || '',
                amount: Number(amount || 0),
                fullAmount: Number(fullAmount || amount || 0),
                challanNumber
            });

            tokens.push({
                challanNumber,
                ...result
            });
        }

        sendJson(res, 200, {
            success: true,
            tokens
        });
    }
});
