const { JWT_SECRET, jwt } = require('./services');
const { sendSmtpEmail } = require('./mailer');
const { getSchoolEmailBranding } = require('./email-template');

const OTP_EXPIRY_MS = 10 * 60 * 1000;

function readBearerToken(req) {
    const authHeader = req.headers.authorization || '';
    return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
}

function assertAdmin(req) {
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

    if (user.role !== 'Admin') {
        const error = new Error('Admin access required.');
        error.statusCode = 403;
        throw error;
    }
}

function getFallbackCredentials() {
    return {
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin123'
    };
}

async function getSavedAdminCredentials(db) {
    const fallback = getFallbackCredentials();
    const row = await db.models.AppSetting.findByPk('admin_credentials');
    if (!row?.settingValue) return fallback;

    try {
        const parsed = JSON.parse(row.settingValue);
        const username = String(parsed?.username || '').trim();
        const password = String(parsed?.password || '');
        return username && password ? { username, password } : fallback;
    } catch (_error) {
        return fallback;
    }
}

async function saveAdminCredentials(db, credentials = {}) {
    const username = String(credentials.username || '').trim();
    const password = String(credentials.password || '');

    if (!username) {
        const error = new Error('Admin username is required.');
        error.statusCode = 400;
        throw error;
    }

    if (!password) {
        const error = new Error('Admin password is required.');
        error.statusCode = 400;
        throw error;
    }

    await db.models.AppSetting.upsert({
        settingKey: 'admin_credentials',
        settingValue: JSON.stringify({ username, password })
    });
    return { username, password };
}

function getAdminRecoveryEmail() {
    return String(process.env.ADMIN_RECOVERY_EMAIL || process.env.SMTP_USER || process.env.SMTP_FROM_EMAIL || 'softwaredemo17@gmail.com').trim();
}

function maskEmail(value = '') {
    return String(value || '').trim().replace(/^(.{2}).*(@.*)$/, '$1***$2');
}

function createOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function saveOtp(db, purpose, otp) {
    await db.models.AppSetting.upsert({
        settingKey: `admin_otp:${purpose}`,
        settingValue: JSON.stringify({
            otp,
            purpose,
            expiresAt: Date.now() + OTP_EXPIRY_MS
        })
    });
}

async function verifyOtp(db, purpose, otp) {
    await checkOtp(db, purpose, otp);
    await db.models.AppSetting.destroy({ where: { settingKey: `admin_otp:${purpose}` } });
}

async function checkOtp(db, purpose, otp) {
    const code = String(otp || '').trim();
    if (!code) {
        const error = new Error('OTP is required.');
        error.statusCode = 400;
        throw error;
    }

    const row = await db.models.AppSetting.findByPk(`admin_otp:${purpose}`);
    let payload = null;
    try {
        payload = row?.settingValue ? JSON.parse(row.settingValue) : null;
    } catch (_error) {
        payload = null;
    }

    if (!payload?.otp || String(payload.otp) !== code || Date.now() > Number(payload.expiresAt || 0)) {
        const error = new Error('Invalid or expired OTP.');
        error.statusCode = 400;
        throw error;
    }
}

async function sendAdminOtpEmail(db, purpose) {
    const otp = createOtp();
    await saveOtp(db, purpose, otp);
    const to = getAdminRecoveryEmail();
    const purposeLabel = purpose === 'forgot-password' ? 'admin password reset' : 'admin password change';
    const { schoolName } = getSchoolEmailBranding();

    await sendSmtpEmail({
        to,
        subject: 'Admin Password OTP',
        text: [
            `Your OTP for ${purposeLabel} is: ${otp}`,
            '',
            'This OTP will expire in 10 minutes.',
            '',
            schoolName
        ].join('\n'),
        html: `
            <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827">
                <p>Your OTP for ${purposeLabel} is:</p>
                <div style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${otp}</div>
                <p>This OTP will expire in 10 minutes.</p>
                <p>${schoolName}</p>
            </div>
        `
    });

    return { sentTo: maskEmail(to) };
}

module.exports = {
    assertAdmin,
    getSavedAdminCredentials,
    saveAdminCredentials,
    getAdminRecoveryEmail,
    maskEmail,
    sendAdminOtpEmail,
    verifyOtp,
    checkOtp
};
