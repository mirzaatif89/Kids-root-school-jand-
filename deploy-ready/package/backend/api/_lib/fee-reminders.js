const cron = require('node-cron');
const { sendSmtpEmail } = require('./mailer');
const { getSchoolEmailBranding, renderSchoolEmail } = require('./email-template');

const REMINDER_LOG_KEY = 'pending_fee_email_log';
const MONTHS_LIST = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function parseReminderLog(row) {
    if (!row?.settingValue) return {};
    try {
        const parsed = JSON.parse(row.settingValue);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_error) {
        return {};
    }
}

async function getReminderLog(AppSetting) {
    if (!AppSetting) return {};
    return parseReminderLog(await AppSetting.findByPk(REMINDER_LOG_KEY));
}

async function saveReminderLog(AppSetting, log) {
    if (!AppSetting) return;
    const entries = Object.entries(log || {}).sort(([a], [b]) => b.localeCompare(a)).slice(0, 14);
    await AppSetting.upsert({
        settingKey: REMINDER_LOG_KEY,
        settingValue: JSON.stringify(Object.fromEntries(entries))
    });
}

function normalizeEmail(value) {
    return String(value || '').trim();
}

function resolveStudentEmails(student = {}) {
    return Array.from(new Set([
        student.email,
        student.parentEmail,
        student.guardianEmail,
        student.fatherEmail,
        student.motherEmail
    ].map(normalizeEmail).filter(Boolean)));
}

function isPendingStudent(student, dueBalance = 0) {
    const status = String(student?.feesStatus || 'Pending').trim().toLowerCase();
    return status !== 'paid' || Number(dueBalance || 0) > 0;
}

function getApplicableFeeMonths(student, date = new Date()) {
    let admissionMonthIndex = 0;
    let admissionYear = date.getFullYear();

    if (student?.admissionDate) {
        const admissionDate = new Date(student.admissionDate);
        if (!Number.isNaN(admissionDate.getTime())) {
            admissionMonthIndex = admissionDate.getMonth();
            admissionYear = admissionDate.getFullYear();
        }
    }

    const currentYear = date.getFullYear();
    const currentMonthIndex = date.getMonth();
    const applicableMonths = [];

    for (let year = admissionYear; year <= currentYear; year += 1) {
        const startMonth = year === admissionYear ? admissionMonthIndex : 0;
        const endMonth = year === currentYear ? currentMonthIndex : 11;
        for (let i = startMonth; i <= endMonth; i += 1) {
            applicableMonths.push(MONTHS_LIST[i]);
        }
    }

    return applicableMonths;
}

function extractPaymentMonthNames(value) {
    const raw = String(value || '').trim();
    if (!raw) return [];
    const lower = raw.toLowerCase();
    const hits = MONTHS_LIST.filter((month) => lower.includes(month.toLowerCase()) || lower.includes(month.slice(0, 3).toLowerCase()));
    if (hits.length) return hits;

    const parsed = new Date(raw.replace(',', ' 1,'));
    if (!Number.isNaN(parsed.getTime())) return [MONTHS_LIST[parsed.getMonth()]];
    return [];
}

async function loadPaidAmountMap(FeePayment) {
    const paidMap = new Map();
    if (!FeePayment) return paidMap;

    const payments = await FeePayment.findAll();
    payments.forEach((payment) => {
        if (String(payment.paymentSource || '').toLowerCase() === 'fine') return;
        const status = String(payment.status || '').trim();
        if (!['Paid', 'Partial'].includes(status)) return;
        const studentId = String(payment.studentId || '').trim();
        if (!studentId) return;
        const months = extractPaymentMonthNames(payment.feeMonth);
        if (!months.length) return;

        const totalAmount = Number(payment.amount || 0);
        const perMonthAmount = months.length ? totalAmount / months.length : totalAmount;
        if (!Number.isFinite(perMonthAmount) || perMonthAmount <= 0) return;

        months.forEach((month) => {
            const key = `${studentId}:${month}`;
            paidMap.set(key, Number(paidMap.get(key) || 0) + perMonthAmount);
        });
    });

    return paidMap;
}

async function loadFineChargeMap(FeePayment) {
    const fineMap = new Map();
    if (!FeePayment) return fineMap;

    const payments = await FeePayment.findAll();
    payments.forEach((payment) => {
        if (String(payment.paymentSource || '').toLowerCase() !== 'fine') return;
        const studentId = String(payment.studentId || '').trim();
        if (!studentId) return;
        const months = extractPaymentMonthNames(payment.feeMonth);
        if (!months.length) return;
        const totalAmount = Number(payment.amount || 0);
        const perMonthAmount = months.length ? totalAmount / months.length : totalAmount;
        if (!Number.isFinite(perMonthAmount) || perMonthAmount <= 0) return;

        months.forEach((month) => {
            const key = `${studentId}:${month}`;
            fineMap.set(key, Number(fineMap.get(key) || 0) + perMonthAmount);
        });
    });

    return fineMap;
}

function calculateStudentPendingFee(student, paidAmountMap, fineChargeMap, dueBalance = 0) {
    const monthlyFee = Number(student?.monthlyFee || 0) || 0;
    const studentId = String(student?.id || '').trim();
    const summary = {
        pendingAmount: Math.max(Number(dueBalance || 0), 0),
        pendingMonths: [],
        paidAmount: 0
    };

    if (!studentId || monthlyFee <= 0) {
        return summary;
    }

    const calculated = getApplicableFeeMonths(student).reduce((acc, month) => {
        const paidForMonth = Number(paidAmountMap.get(`${studentId}:${month}`) || 0);
        const fineForMonth = Number(fineChargeMap.get(`${studentId}:${month}`) || 0);
        const monthTotalDue = monthlyFee + fineForMonth;
        acc.paidAmount += paidForMonth;
        const dueForMonth = Math.max(monthTotalDue - paidForMonth, 0);
        if (dueForMonth > 0) {
            acc.pendingMonths.push({ month, dueAmount: dueForMonth, paidAmount: paidForMonth });
            acc.pendingAmount += dueForMonth;
        }
        return acc;
    }, { pendingAmount: 0, pendingMonths: [], paidAmount: 0 });

    return calculated.pendingAmount > summary.pendingAmount ? calculated : summary;
}

function buildPendingFeeEmail(student, dueBalance = 0) {
    const name = student.fullName || 'Student';
    const { schoolName } = getSchoolEmailBranding();
    const amount = Number(dueBalance || student.monthlyFee || 0);
    const amountLine = amount > 0
        ? `Pending amount: PKR ${amount.toLocaleString('en-PK')}`
        : 'Your fee is currently pending in the school system.';

    const text = [
        `Dear ${name},`,
        '',
        'This is a reminder that your school fee is pending.',
        amountLine,
        student.classGrade ? `Class: ${student.classGrade}` : '',
        student.rollNo ? `Roll No: ${student.rollNo}` : '',
        '',
        'Please clear the pending fee at the earliest.',
        '',
        schoolName
    ].filter(Boolean).join('\n');

    const html = renderSchoolEmail({
        title: 'Pending Fee Reminder',
        badge: 'Fee Department',
        preheader: amountLine,
        greeting: name,
        intro: 'This is a polite reminder that your school fee is currently pending. Please clear the pending amount at the earliest.',
        accentColor: '#dc2626',
        rows: [
            ['Student Name', name],
            ['Class', student.classGrade || '-'],
            ['Roll No', student.rollNo || '-'],
            ['Pending Amount', amount > 0 ? `PKR ${amount.toLocaleString('en-PK')}` : 'Pending'],
            ['Status', 'Payment Pending']
        ],
        footerNote: 'If you have already paid this fee, please ignore this reminder or contact the school office with your payment receipt.'
    });

    return {
        to: resolveStudentEmails(student),
        subject: 'Pending Fee Reminder',
        text,
        html
    };
}

function buildFeePaymentConfirmationEmail(student, payment = {}, remainingDue = 0) {
    const name = student.fullName || payment.studentName || 'Student';
    const { schoolName } = getSchoolEmailBranding();
    const amount = Number(payment.amount || 0);
    const status = String(payment.status || 'Paid').trim() || 'Paid';
    const isPaid = status.toLowerCase() === 'paid';
    const subject = isPaid ? 'Fee Paid Successfully' : 'Fee Payment Recorded';
    const statusLine = isPaid
        ? 'Your fee has been paid successfully.'
        : `Your fee payment has been recorded with status: ${status}.`;

    const rows = [
        ['Status', isPaid ? 'Successfully Paid' : status],
        ['Student', name],
        ['Class', payment.classGrade || student.classGrade || '-'],
        ['Roll No', payment.rollNo || student.rollNo || '-'],
        ['Fee Month', payment.feeMonth || '-'],
        ['Session', payment.session || '-'],
        ['Amount Paid', `PKR ${amount.toLocaleString('en-PK')}`],
        ['Challan No.', payment.challanNumber || '-'],
        ['Paid On', payment.paymentDateLabel || new Date().toLocaleDateString('en-GB')],
        ...(Number(remainingDue || 0) > 0
            ? [['Remaining Due', `PKR ${Number(remainingDue || 0).toLocaleString('en-PK')}`]]
            : [])
    ];

    const text = [
        `Dear ${name},`,
        '',
        statusLine,
        '',
        ...rows.map(([label, value]) => `${label}: ${value}`),
        '',
        'Thank you.',
        schoolName
    ].join('\n');

    const html = renderSchoolEmail({
        title: subject,
        badge: 'Fee Department',
        preheader: statusLine,
        greeting: name,
        intro: statusLine,
        accentColor: isPaid ? '#16a34a' : '#0f766e',
        rows,
        footerNote: 'Thank you for keeping your school fee record updated.'
    });

    return {
        to: resolveStudentEmails(student),
        subject,
        text,
        html
    };
}

async function sendFeePaymentConfirmationEmail(student, payment = {}, remainingDue = 0) {
    const emails = resolveStudentEmails(student);
    if (!emails.length) {
        return { skipped: true, reason: 'Student email is missing.' };
    }

    return sendSmtpEmail(buildFeePaymentConfirmationEmail(student, payment, remainingDue));
}

async function loadDueBalanceMap(FeeDueBalance) {
    if (!FeeDueBalance) return new Map();
    const rows = await FeeDueBalance.findAll();
    return new Map(rows.map((row) => [String(row.studentId), Number(row.balance || 0)]));
}

async function sendPendingFeeReminderEmails(db, options = {}) {
    const { Student, FeeDueBalance, FeePayment, AppSetting } = db.models;
    const dateKey = options.dateKey || todayKey();
    const log = await getReminderLog(AppSetting);
    const alreadySent = new Set(Array.isArray(log[dateKey]) ? log[dateKey].map(String) : []);
    const requestedStudentIds = Array.isArray(options.studentIds)
        ? new Set(options.studentIds.map((id) => String(id || '').trim()).filter(Boolean))
        : null;

    const students = await Student.findAll();
    const dueBalances = await loadDueBalanceMap(FeeDueBalance);
    const paidAmountMap = await loadPaidAmountMap(FeePayment);
    const fineChargeMap = await loadFineChargeMap(FeePayment);
    const pendingByStudentId = new Map();
    const pendingStudents = students.filter((student) => {
        if (requestedStudentIds && !requestedStudentIds.has(String(student.id))) return false;
        const emails = resolveStudentEmails(student);
        if (!emails.length) return false;
        if (!options.force && alreadySent.has(String(student.id))) return false;
        const pendingDetails = calculateStudentPendingFee(student, paidAmountMap, fineChargeMap, dueBalances.get(String(student.id)) || 0);
        pendingByStudentId.set(String(student.id), pendingDetails);
        return isPendingStudent(student, pendingDetails.pendingAmount);
    });

    const result = {
        attempted: pendingStudents.length,
        sent: 0,
        skipped: students.length - pendingStudents.length,
        failed: []
    };

    for (const student of pendingStudents) {
        try {
            const pendingDetails = pendingByStudentId.get(String(student.id)) || {};
            await sendSmtpEmail(buildPendingFeeEmail(student, pendingDetails.pendingAmount || 0));
            result.sent += 1;
            alreadySent.add(String(student.id));
        } catch (error) {
            result.failed.push({
                studentId: student.id,
                email: resolveStudentEmails(student).join(', '),
                message: error.message || 'Email failed.'
            });
        }
    }

    log[dateKey] = Array.from(alreadySent);
    await saveReminderLog(AppSetting, log);

    return result;
}

function startPendingFeeReminderScheduler(getDb, logger = console) {
    if (String(process.env.PENDING_FEE_REMINDER_ENABLED || 'true').toLowerCase() === 'false') {
        logger.log('Pending fee email scheduler disabled.');
        return null;
    }

    const run = async () => {
        try {
            const db = await getDb();
            const result = await sendPendingFeeReminderEmails(db);
            logger.log(`Pending fee email reminders: attempted ${result.attempted}, sent ${result.sent}, failed ${result.failed.length}.`);
        } catch (error) {
            logger.warn(`Pending fee email reminders skipped: ${error.message || error}`);
        }
    };

    const configuredCron = String(process.env.PENDING_FEE_REMINDER_CRON || '').trim();
    const configuredTime = String(process.env.PENDING_FEE_REMINDER_TIME || '09:00').trim();
    const timezone = String(process.env.PENDING_FEE_REMINDER_TIMEZONE || 'Asia/Karachi').trim();
    const timeMatch = configuredTime.match(/^(\d{1,2}):(\d{2})$/);
    const cronExpression = configuredCron || (timeMatch
        ? `${Number(timeMatch[2])} ${Number(timeMatch[1])} * * *`
        : '0 9 * * *');

    const task = cron.schedule(cronExpression, run, { timezone });
    logger.log(`Pending fee email scheduler active: ${cronExpression} (${timezone}).`);

    if (String(process.env.PENDING_FEE_REMINDER_RUN_ON_START || 'true').toLowerCase() !== 'false') {
        setTimeout(run, 5000);
    }

    return task;
}

module.exports = {
    sendFeePaymentConfirmationEmail,
    sendPendingFeeReminderEmails,
    startPendingFeeReminderScheduler
};
