const { Op } = require('sequelize');
const { sendSmtpEmail } = require('./mailer');

const REMINDER_LOG_KEY = 'pending_fee_email_log';
const REMINDER_CHECK_INTERVAL_MS = 60 * 60 * 1000;

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

function isPendingStudent(student, dueBalance = 0) {
    const status = String(student?.feesStatus || 'Pending').trim().toLowerCase();
    return status !== 'paid' || Number(dueBalance || 0) > 0;
}

function buildPendingFeeEmail(student, dueBalance = 0) {
    const name = student.fullName || 'Student';
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
        'Apexiums School'
    ].filter(Boolean).join('\n');

    const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827">
            <p>Dear ${escapeHtml(name)},</p>
            <p>This is a reminder that your school fee is pending.</p>
            <p><strong>${escapeHtml(amountLine)}</strong></p>
            <p>
                ${student.classGrade ? `Class: ${escapeHtml(student.classGrade)}<br>` : ''}
                ${student.rollNo ? `Roll No: ${escapeHtml(student.rollNo)}<br>` : ''}
            </p>
            <p>Please clear the pending fee at the earliest.</p>
            <p>Apexiums School</p>
        </div>
    `;

    return {
        to: normalizeEmail(student.email),
        subject: 'Pending Fee Reminder',
        text,
        html
    };
}

function buildFeePaymentConfirmationEmail(student, payment = {}, remainingDue = 0) {
    const name = student.fullName || payment.studentName || 'Student';
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
        'Apexiums School'
    ].join('\n');

    const tableRows = rows.map(([label, value]) => `
        <tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;color:#6b7280">${escapeHtml(label)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-weight:700;color:#111827">${escapeHtml(value)}</td>
        </tr>
    `).join('');

    const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827">
            <div style="max-width:560px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
                <div style="background:#16a34a;color:#ffffff;padding:16px 18px">
                    <div style="font-size:18px;font-weight:700">${escapeHtml(subject)}</div>
                    <div style="font-size:13px;margin-top:4px">${escapeHtml(statusLine)}</div>
                </div>
                <div style="padding:18px">
                    <p>Dear ${escapeHtml(name)},</p>
                    <table style="width:100%;border-collapse:collapse;margin:12px 0">${tableRows}</table>
                    <p>Thank you.</p>
                    <p>Apexiums School</p>
                </div>
            </div>
        </div>
    `;

    return {
        to: normalizeEmail(student.email),
        subject,
        text,
        html
    };
}

async function sendFeePaymentConfirmationEmail(student, payment = {}, remainingDue = 0) {
    const email = normalizeEmail(student?.email);
    if (!email) {
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
    const { Student, FeeDueBalance, AppSetting } = db.models;
    const dateKey = options.dateKey || todayKey();
    const log = await getReminderLog(AppSetting);
    const alreadySent = new Set(Array.isArray(log[dateKey]) ? log[dateKey].map(String) : []);

    const where = {
        email: {
            [Op.ne]: null
        }
    };
    const students = await Student.findAll({ where });
    const dueBalances = await loadDueBalanceMap(FeeDueBalance);
    const pendingStudents = students.filter((student) => {
        const email = normalizeEmail(student.email);
        if (!email) return false;
        if (!options.force && alreadySent.has(String(student.id))) return false;
        return isPendingStudent(student, dueBalances.get(String(student.id)) || 0);
    });

    const result = {
        attempted: pendingStudents.length,
        sent: 0,
        skipped: students.length - pendingStudents.length,
        failed: []
    };

    for (const student of pendingStudents) {
        try {
            await sendSmtpEmail(buildPendingFeeEmail(student, dueBalances.get(String(student.id)) || 0));
            result.sent += 1;
            alreadySent.add(String(student.id));
        } catch (error) {
            result.failed.push({
                studentId: student.id,
                email: normalizeEmail(student.email),
                message: error.message || 'Email failed.'
            });
        }
    }

    log[dateKey] = Array.from(alreadySent);
    await saveReminderLog(AppSetting, log);

    return result;
}

function startPendingFeeReminderScheduler(getDb, logger = console) {
    const run = async () => {
        try {
            const db = await getDb();
            const result = await sendPendingFeeReminderEmails(db);
            if (result.sent || result.failed.length) {
                logger.log(`Pending fee email reminders: sent ${result.sent}, failed ${result.failed.length}.`);
            }
        } catch (error) {
            logger.warn(`Pending fee email reminders skipped: ${error.message || error}`);
        }
    };

    setTimeout(run, 5000);
    return setInterval(run, REMINDER_CHECK_INTERVAL_MS);
}

module.exports = {
    sendFeePaymentConfirmationEmail,
    sendPendingFeeReminderEmails,
    startPendingFeeReminderScheduler
};
