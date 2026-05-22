const cron = require('node-cron');
const { sendWhatsAppMessage } = require('../whatsappmessage/messagehandler');

const WHATSAPP_BIRTHDAY_LOG_KEY = 'student_birthday_whatsapp_log';

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
    return Boolean(birthday && birthday.month === date.getMonth() + 1 && birthday.day === date.getDate());
}

function todayKey() {
    return new Date().toISOString().slice(0, 10);
}

function parseLog(row) {
    try {
        return row?.settingValue ? JSON.parse(row.settingValue) : {};
    } catch (_error) {
        return {};
    }
}

async function sendBirthdayWhatsAppMessages(db, options = {}) {
    const { Student, AppSetting } = db.models;
    const dateKey = todayKey();
    const force = options.force === true;
    const log = AppSetting ? parseLog(await AppSetting.findByPk(WHATSAPP_BIRTHDAY_LOG_KEY)) : {};
    const sentToday = new Set(force ? [] : (log[dateKey] || []));
    const result = { attempted: 0, sent: 0, skipped: 0, failed: [] };
    const students = await Student.findAll();

    for (const student of students) {
        if (!isBirthdayToday(student)) continue;
        if (!student.parentPhone) {
            result.skipped += 1;
            continue;
        }
        if (sentToday.has(student.id)) {
            result.skipped += 1;
            continue;
        }

        result.attempted += 1;
        try {
            await sendWhatsAppMessage(
                student,
                `Happy Birthday ${student.fullName || 'Student'}! Best wishes from Apexiums School.`
            );
            result.sent += 1;
            sentToday.add(student.id);
        } catch (error) {
            result.failed.push({
                studentId: student.id,
                studentName: student.fullName,
                message: error.response?.data?.error?.message || error.message || 'WhatsApp message failed.'
            });
        }
    }

    if (AppSetting) {
        log[dateKey] = Array.from(sentToday);
        await AppSetting.upsert({
            settingKey: WHATSAPP_BIRTHDAY_LOG_KEY,
            settingValue: JSON.stringify(Object.fromEntries(Object.entries(log).slice(-30)))
        });
    }

    return result;
}

function startWhatsAppBirthdayScheduler(getDb, logger = console) {
    if (process.env.ENABLE_WHATSAPP_CRON === 'false') return null;

    return cron.schedule(process.env.WHATSAPP_BIRTHDAY_CRON || '0 9 * * *', async () => {
        try {
            const db = await getDb();
            const result = await sendBirthdayWhatsAppMessages(db);
            if (result.attempted || result.sent || result.failed.length) {
                logger.log(`WhatsApp birthday messages: sent ${result.sent}, failed ${result.failed.length}, skipped ${result.skipped}`);
            }
        } catch (error) {
            logger.error('WhatsApp birthday scheduler failed:', error.message || error);
        }
    }, {
        timezone: process.env.TZ || 'Asia/Karachi'
    });
}

module.exports = {
    sendBirthdayWhatsAppMessages,
    startWhatsAppBirthdayScheduler
};
