const { createHandler, sendJson } = require('../_lib/http');
const { getDb, Op } = require('../_lib/db');
const { JWT_SECRET, jwt } = require('../_lib/services');

function normalizeClassFeeConfig(input = {}) {
    const raw = input && typeof input === 'object' ? input : {};
    return Object.entries(raw).reduce((acc, [className, config]) => {
        const name = String(className || '').trim();
        if (!name) return acc;
        const monthlyFee = String(config?.monthlyFee ?? config?.fee ?? '').trim();
        const feeFrequency = String(config?.feeFrequency || 'Monthly').trim() || 'Monthly';
        const feeMonth = String(config?.feeMonth || '').trim();
        const feeYear = String(config?.feeYear || '').trim();
        if (!monthlyFee) return acc;
        acc[name] = { monthlyFee, feeFrequency, feeMonth, feeYear };
        return acc;
    }, {});
}

async function readClassFeeConfig(db) {
    const row = await db.models.AppSetting.findByPk('class_fees');
    if (!row?.settingValue) return {};
    try {
        return normalizeClassFeeConfig(JSON.parse(row.settingValue));
    } catch (_error) {
        return {};
    }
}

async function readClassFeeHistory(db) {
    const row = await db.models.AppSetting.findByPk('class_fee_history');
    if (!row?.settingValue) return [];
    try {
        const parsed = JSON.parse(row.settingValue);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        return [];
    }
}

function readBearerToken(req) {
    const authHeader = req.headers.authorization || '';
    return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
}

function assertAdminOrPrincipal(req) {
    const token = readBearerToken(req);
    if (!token) {
        const error = new Error('Admin access required.');
        error.statusCode = 401;
        throw error;
    }

    let user = null;
    try {
        user = jwt.verify(token, JWT_SECRET);
    } catch (_error) {
        const error = new Error('Admin access required.');
        error.statusCode = 401;
        throw error;
    }

    if (user.role !== 'Admin' && user.role !== 'Principal') {
        const error = new Error('Admin access required.');
        error.statusCode = 403;
        throw error;
    }
}

async function applyClassFeeToStudents(db, className, monthlyFee, feeFrequency, previousMonthlyFee = '') {
    if (!db.models.Student || !className) return;
    const students = await db.models.Student.findAll({ where: { classGrade: className } });
    const previousFee = String(previousMonthlyFee || '').trim();
    for (const student of students) {
        const studentFee = String(student.monthlyFee ?? '').trim();
        const studentFeeAmount = Number(studentFee || 0) || 0;
        const isFreeStudy = student.freeStudy === true || String(student.zeroFeeReason || '').trim();
        const hasManualFee = studentFeeAmount > 0 && (
            student.monthlyFeeCustom === true ||
            (previousFee && studentFee !== previousFee)
        ) || isFreeStudy;
        if (hasManualFee) continue;
        student.feeFrequency = feeFrequency;
        if (monthlyFee) student.monthlyFee = monthlyFee;
        student.monthlyFeeCustom = false;
        await student.save();
    }
}

module.exports = createHandler({
    GET: async ({ res, db }) => {
        sendJson(res, 200, { success: true, classFees: await readClassFeeConfig(db), classFeeHistory: await readClassFeeHistory(db) });
    },
    POST: async ({ req, res, db, body }) => {
        assertAdminOrPrincipal(req);

        const className = String(body?.className || '').trim();
        const monthlyFee = String(body?.monthlyFee || '').trim();
        const feeFrequency = String(body?.feeFrequency || 'Monthly').trim() || 'Monthly';
        const feeMonth = String(body?.feeMonth || '').trim();
        const feeYear = String(body?.feeYear || '').trim();

        if (!className || !monthlyFee) {
            const error = new Error('Class and monthly fee are required.');
            error.statusCode = 400;
            throw error;
        }

        const classFees = await readClassFeeConfig(db);
        const previousMonthlyFee = String(classFees[className]?.monthlyFee || '').trim();
        classFees[className] = { monthlyFee, feeFrequency, feeMonth, feeYear };
        const classFeeHistory = await readClassFeeHistory(db);
        const historyEntry = {
            id: `CFH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            className,
            monthlyFee,
            feeFrequency,
            feeMonth,
            feeYear,
            updatedAt: new Date().toISOString()
        };
        classFeeHistory.unshift(historyEntry);

        await db.models.AppSetting.upsert({
            settingKey: 'class_fees',
            settingValue: JSON.stringify(classFees)
        });
        await db.models.AppSetting.upsert({
            settingKey: 'class_fee_history',
            settingValue: JSON.stringify(classFeeHistory.slice(0, 500))
        });

        await applyClassFeeToStudents(db, className, monthlyFee, feeFrequency, previousMonthlyFee);

        sendJson(res, 200, { success: true, classFees, classFeeHistory });
    }
}, { getDb });
