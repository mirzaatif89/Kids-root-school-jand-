const nodemailer = require('nodemailer');

function getSmtpConfig() {
    const host = String(process.env.SMTP_HOST || '').trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
    const user = String(process.env.SMTP_USER || '').trim();
    const pass = String(process.env.SMTP_PASS || process.env.SMTP_PSAS || '').trim();
    const fromEmail = String(process.env.SMTP_FROM_EMAIL || user || '').trim();
    const fromName = String(process.env.SMTP_FROM_NAME || 'Kids Roots Jand').trim();

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
        }
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

    const result = await transporter.sendMail({
        from: `"${config.fromName.replace(/"/g, '\\"')}" <${config.fromEmail}>`,
        to: email.to,
        cc: email.cc.length ? email.cc : undefined,
        bcc: email.bcc.length ? email.bcc : undefined,
        subject: email.subject,
        text: email.text || undefined,
        html: email.html || undefined,
        replyTo: payload.replyTo ? String(payload.replyTo).trim() : undefined
    });

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
