const { Op } = require('sequelize');
const { sendSmtpEmail } = require('./mailer');

const BIRTHDAY_LOG_KEY = 'student_birthday_email_log';
const NOTICE_LOG_KEY = 'student_notice_email_log';
const FINE_LOG_KEY = 'student_fine_email_log';
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

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

function normalizeEmail(value) {
    return String(value || '').trim();
}

function parseLog(row) {
    if (!row?.settingValue) return {};
    try {
        const parsed = JSON.parse(row.settingValue);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_error) {
        return {};
    }
}

async function getLog(AppSetting, key) {
    if (!AppSetting) return {};
    return parseLog(await AppSetting.findByPk(key));
}

async function saveLog(AppSetting, key, log, keep = 30) {
    if (!AppSetting) return;
    const entries = Object.entries(log || {}).sort(([a], [b]) => b.localeCompare(a)).slice(0, keep);
    await AppSetting.upsert({
        settingKey: key,
        settingValue: JSON.stringify(Object.fromEntries(entries))
    });
}

async function loadStudentsWithEmail(Student) {
    const students = await Student.findAll({
        where: {
            email: {
                [Op.ne]: null
            }
        }
    });
    return students.filter((student) => normalizeEmail(student.email));
}

function parseDobMonthDay(dob) {
    const raw = String(dob || '').trim();
    if (!raw) return null;

    const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (iso) return { month: Number(iso[2]), day: Number(iso[3]) };

    const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (dmy) return { month: Number(dmy[2]), day: Number(dmy[1]) };

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return { month: parsed.getMonth() + 1, day: parsed.getDate() };
    }

    return null;
}

function isBirthdayToday(student, date = new Date()) {
    const birthday = parseDobMonthDay(student?.dob);
    if (!birthday) return false;
    return birthday.month === date.getMonth() + 1 && birthday.day === date.getDate();
}

function buildBirthdayEmail(student) {
    const name = student.fullName || 'Student';
    const text = [
        `Dear ${name},`,
        '',
        'Happy Birthday from Apexiums School.',
        'We wish you a successful and happy year ahead.',
        '',
        'Apexiums School'
    ].join('\n');

    const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827">
            <p>Dear ${escapeHtml(name)},</p>
            <p><strong>Happy Birthday from Apexiums School.</strong></p>
            <p>We wish you a successful and happy year ahead.</p>
            <p>Apexiums School</p>
        </div>
    `;

    return {
        to: normalizeEmail(student.email),
        subject: 'Happy Birthday',
        text,
        html
    };
}

function buildNoticeEmail(student, notice) {
    const title = String(notice?.title || 'School Notice').trim();
    const message = String(notice?.message || '').trim();
    const name = student.fullName || 'Student';

    const text = [
        `Dear ${name},`,
        '',
        title,
        '',
        message,
        '',
        'Apexiums School'
    ].join('\n');

    const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827">
            <p>Dear ${escapeHtml(name)},</p>
            <h2 style="font-size:18px;margin:0 0 12px">${escapeHtml(title)}</h2>
            <p style="white-space:pre-line">${escapeHtml(message)}</p>
            <p>Apexiums School</p>
        </div>
    `;

    return {
        to: normalizeEmail(student.email),
        subject: title,
        text,
        html
    };
}

function buildFineEmail(student, payload = {}) {
    const name = student.fullName || payload.studentName || 'Student';
    const fineAmount = Number(payload.fineAmount || 0);
    const totalDue = Number(payload.fullAmount || payload.totalDue || 0);
    const feeMonth = payload.feeMonth || 'Fee';

    const rows = [
        ['Student', name],
        ['Class', payload.classGrade || student.classGrade || '-'],
        ['Roll No', payload.rollNo || student.rollNo || '-'],
        ['Fee Month', feeMonth],
        ['Fine Amount', `PKR ${fineAmount.toLocaleString('en-PK')}`],
        ...(totalDue > 0 ? [['Total Due', `PKR ${totalDue.toLocaleString('en-PK')}`]] : []),
        ['Challan No.', payload.challanNumber || '-']
    ];

    const text = [
        `Dear ${name},`,
        '',
        'A fine has been applied on your school fee.',
        '',
        ...rows.map(([label, value]) => `${label}: ${value}`),
        '',
        'Please clear the pending amount at the earliest.',
        '',
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
            <p>Dear ${escapeHtml(name)},</p>
            <p>A fine has been applied on your school fee.</p>
            <table style="width:100%;max-width:560px;border-collapse:collapse;margin:12px 0">${tableRows}</table>
            <p>Please clear the pending amount at the earliest.</p>
            <p>Apexiums School</p>
        </div>
    `;

    return {
        to: normalizeEmail(student.email),
        subject: 'Fee Fine Applied',
        text,
        html
    };
}

async function sendBirthdayStudentEmails(db, options = {}) {
    const { Student, AppSetting } = db.models;
    const date = options.date || new Date();
    const dateKey = options.dateKey || todayKey();
    const log = await getLog(AppSetting, BIRTHDAY_LOG_KEY);
    const alreadySent = new Set(Array.isArray(log[dateKey]) ? log[dateKey].map(String) : []);
    const students = (await loadStudentsWithEmail(Student)).filter((student) => {
        if (!options.force && alreadySent.has(String(student.id))) return false;
        return isBirthdayToday(student, date);
    });

    const result = { attempted: students.length, sent: 0, skipped: 0, failed: [] };

    for (const student of students) {
        try {
            await sendSmtpEmail(buildBirthdayEmail(student));
            result.sent += 1;
            alreadySent.add(String(student.id));
        } catch (error) {
            result.failed.push({ studentId: student.id, email: normalizeEmail(student.email), message: error.message || 'Email failed.' });
        }
    }

    log[dateKey] = Array.from(alreadySent);
    await saveLog(AppSetting, BIRTHDAY_LOG_KEY, log);
    return result;
}

async function sendSpecialNoticeStudentEmails(db, notice, options = {}) {
    const { Student, AppSetting } = db.models;
    const targets = Array.isArray(notice?.targetPortals) ? notice.targetPortals : [];
    if (notice?.status !== 'executed' || !targets.includes('student')) {
        return { attempted: 0, sent: 0, skipped: 0, failed: [] };
    }

    const noticeId = String(notice.id || '').trim();
    const log = await getLog(AppSetting, NOTICE_LOG_KEY);
    const alreadySent = new Set(Array.isArray(log[noticeId]) ? log[noticeId].map(String) : []);
    const students = (await loadStudentsWithEmail(Student)).filter((student) => options.force || !alreadySent.has(String(student.id)));
    const result = { attempted: students.length, sent: 0, skipped: 0, failed: [] };

    for (const student of students) {
        try {
            await sendSmtpEmail(buildNoticeEmail(student, notice));
            result.sent += 1;
            alreadySent.add(String(student.id));
        } catch (error) {
            result.failed.push({ studentId: student.id, email: normalizeEmail(student.email), message: error.message || 'Email failed.' });
        }
    }

    if (noticeId) {
        log[noticeId] = Array.from(alreadySent);
        await saveLog(AppSetting, NOTICE_LOG_KEY, log, 100);
    }

    return result;
}

async function sendFineAppliedEmail(db, payload = {}, options = {}) {
    const { Student, AppSetting } = db.models;
    const studentId = String(payload.studentId || '').trim();
    const fineAmount = Number(payload.fineAmount || 0);
    if (!studentId || !Number.isFinite(fineAmount) || fineAmount <= 0) {
        return { skipped: true, reason: 'Fine amount is missing.' };
    }

    const student = await Student.findByPk(studentId);
    const email = normalizeEmail(student?.email);
    if (!student || !email) {
        return { skipped: true, reason: 'Student email is missing.' };
    }

    const dateKey = todayKey();
    const uniqueKey = String(payload.challanNumber || `${studentId}-${payload.feeMonth || dateKey}-${fineAmount}`).trim();
    const log = await getLog(AppSetting, FINE_LOG_KEY);
    const sentKeys = new Set(Array.isArray(log[dateKey]) ? log[dateKey].map(String) : []);
    if (!options.force && sentKeys.has(uniqueKey)) {
        return { skipped: true, reason: 'Fine email already sent.' };
    }

    const result = await sendSmtpEmail(buildFineEmail(student, payload));
    sentKeys.add(uniqueKey);
    log[dateKey] = Array.from(sentKeys);
    await saveLog(AppSetting, FINE_LOG_KEY, log);
    return result;
}

function startStudentEmailNotificationScheduler(getDb, logger = console) {
    const run = async () => {
        try {
            const db = await getDb();
            const birthdayResult = await sendBirthdayStudentEmails(db);
            if (birthdayResult.sent || birthdayResult.failed.length) {
                logger.log(`Birthday emails: sent ${birthdayResult.sent}, failed ${birthdayResult.failed.length}.`);
            }
        } catch (error) {
            logger.warn(`Student email notifications skipped: ${error.message || error}`);
        }
    };

    setTimeout(run, 8000);
    return setInterval(run, CHECK_INTERVAL_MS);
}

module.exports = {
    sendBirthdayStudentEmails,
    sendSpecialNoticeStudentEmails,
    sendFineAppliedEmail,
    startStudentEmailNotificationScheduler
};
