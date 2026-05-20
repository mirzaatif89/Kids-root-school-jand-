const path = require('path');
const nodemailer = require('nodemailer');
const { getSchoolLogoAttachment, SCHOOL_LOGO_CID } = require('./email-template');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

function normalizeBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function getSmtpConfig() {
    const host = String(process.env.SMTP_HOST || '').trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = normalizeBoolean(process.env.SMTP_SECURE, port === 465);
    const user = String(process.env.SMTP_USER || '').trim();
    const pass = String(process.env.SMTP_PASS || process.env.SMTP_PSAS || '').trim();
    const fromEmail = String(process.env.SMTP_FROM_EMAIL || user || '').trim();
    const fromName = String(process.env.SMTP_FROM_NAME || 'Apexiums School').trim();

    return {
        host,
        port,
        secure,
        user,
        pass,
        fromEmail,
        fromName
    };
}

function assertSmtpConfigured(config = getSmtpConfig()) {
    const missing = [];
    if (!config.host) missing.push('SMTP_HOST');
    if (!config.port) missing.push('SMTP_PORT');
    if (!config.user) missing.push('SMTP_USER');
    if (!config.pass) missing.push('SMTP_PASS');
    if (!config.fromEmail) missing.push('SMTP_FROM_EMAIL');

    if (missing.length) {
        const error = new Error(`SMTP is not configured. Missing: ${missing.join(', ')}`);
        error.statusCode = 400;
        throw error;
    }
}

function describeSmtpError(error) {
    const message = String(error?.message || error || 'Email could not be sent.');
    const responseCode = Number(error?.responseCode || 0);
    const code = String(error?.code || '');

    if (responseCode === 535 || code === 'EAUTH') {
        return 'SMTP login failed. Check SMTP_USER and SMTP_PASS. For Gmail, use a 16-character App Password, not the normal Gmail password.';
    }

    if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET'].includes(code)) {
        return 'SMTP server connection failed. Check SMTP_HOST, SMTP_PORT, SMTP_SECURE, and hosting firewall/network access.';
    }

    if (responseCode === 550 || responseCode === 553) {
        return `SMTP rejected the sender or recipient: ${message}`;
    }

    return message;
}

function createTransporter() {
    const config = getSmtpConfig();
    assertSmtpConfigured(config);

    return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.pass
        },
        connectionTimeout: 20000,
        greetingTimeout: 20000,
        socketTimeout: 30000
    });
}

function normalizeRecipients(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function validateEmailPayload(payload = {}) {
    const to = normalizeRecipients(payload.to);
    const cc = normalizeRecipients(payload.cc);
    const bcc = normalizeRecipients(payload.bcc);
    const subject = String(payload.subject || '').trim();
    const text = String(payload.text || '').trim();
    const html = String(payload.html || '').trim();

    if (!to.length) {
        const error = new Error('At least one recipient email is required.');
        error.statusCode = 400;
        throw error;
    }

    if (!subject) {
        const error = new Error('Email subject is required.');
        error.statusCode = 400;
        throw error;
    }

    if (!text && !html) {
        const error = new Error('Email body is required.');
        error.statusCode = 400;
        throw error;
    }

    return { to, cc, bcc, subject, text, html };
}

async function sendSmtpEmail(payload = {}) {
    const config = getSmtpConfig();
    assertSmtpConfigured(config);
    const email = validateEmailPayload(payload);
    const transporter = createTransporter();

    const attachments = Array.isArray(payload.attachments) ? [...payload.attachments] : [];
    if (email.html.includes(`cid:${SCHOOL_LOGO_CID}`) && !attachments.some((item) => item?.cid === SCHOOL_LOGO_CID)) {
        attachments.push(getSchoolLogoAttachment());
    }

    let result;
    try {
        result = await transporter.sendMail({
            from: `"${config.fromName.replace(/"/g, '\\"')}" <${config.fromEmail}>`,
            to: email.to,
            cc: email.cc.length ? email.cc : undefined,
            bcc: email.bcc.length ? email.bcc : undefined,
            subject: email.subject,
            text: email.text || undefined,
            html: email.html || undefined,
            attachments: attachments.length ? attachments : undefined,
            replyTo: payload.replyTo ? String(payload.replyTo).trim() : undefined
        });
    } catch (error) {
        const smtpError = new Error(describeSmtpError(error));
        smtpError.statusCode = error.statusCode || 502;
        smtpError.code = error.code;
        smtpError.responseCode = error.responseCode;
        throw smtpError;
    }

    return {
        messageId: result.messageId,
        accepted: result.accepted || [],
        rejected: result.rejected || []
    };
}

module.exports = {
    getSmtpConfig,
    sendSmtpEmail
};
