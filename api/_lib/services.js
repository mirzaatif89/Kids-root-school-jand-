const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

const JWT_SECRET = process.env.JWT_SECRET || 'eduCore_secret_key_2026';
const PRINCIPAL_USERNAME = process.env.PRINCIPAL_USERNAME || 'principal@school.com';
const PRINCIPAL_PASSWORD = process.env.PRINCIPAL_PASSWORD || 'Principal123';
const PERMISSIONS_FILE = path.join(process.cwd(), 'permissions.json');
const defaultPermissions = {
    loginAccess: {
        student: true
    },
    modules: {}
};

function isPasswordHash(value) {
    return typeof value === 'string' && /^\$2[aby]\$/.test(value);
}

function normalizeOptionalEmail(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || null;
}

function getRequestBaseUrl(req) {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    return `${protocol}://${host}`;
}

async function upsertAuthUser(User, payload) {
    if (!payload.username || !payload.password || !payload.profileId || !payload.role) {
        return;
    }

    await User.upsert({
        id: payload.id,
        profileId: payload.profileId,
        fullName: payload.fullName || '',
        campusName: payload.campusName || null,
        email: normalizeOptionalEmail(payload.email),
        username: payload.username,
        password: payload.password,
        plainPassword: payload.plainPassword || null,
        role: payload.role,
        isActive: true
    });
}

async function syncAuthUsers(db) {
    const { Student, Teacher, User, Staff } = db.models;

    const students = await Student.findAll({
        attributes: ['id', 'fullName', 'campusName', 'email', 'username', 'password', 'plainPassword']
    });
    for (const student of students) {
        await upsertAuthUser(User, {
            id: `student_${student.id}`,
            profileId: student.id,
            fullName: student.fullName,
            campusName: student.campusName || null,
            email: normalizeOptionalEmail(student.email),
            username: student.username,
            password: student.password,
            plainPassword: student.plainPassword || null,
            role: 'Student'
        });
    }

    const teachers = await Teacher.findAll({
        attributes: ['id', 'fullName', 'campusName', 'email', 'username', 'password', 'plainPassword']
    });
    for (const teacher of teachers) {
        await upsertAuthUser(User, {
            id: `teacher_${teacher.id}`,
            profileId: teacher.id,
            fullName: teacher.fullName,
            campusName: teacher.campusName || null,
            email: normalizeOptionalEmail(teacher.email),
            username: teacher.username,
            password: teacher.password,
            plainPassword: teacher.plainPassword || null,
            role: 'Teacher'
        });
    }

    const staffMembers = await Staff.findAll({
        attributes: ['id', 'fullName', 'email', 'username', 'password', 'plainPassword']
    });
    for (const member of staffMembers) {
        await upsertAuthUser(User, {
            id: `staff_${member.id}`,
            profileId: member.id,
            fullName: member.fullName,
            email: normalizeOptionalEmail(member.email),
            username: member.username,
            password: member.password,
            plainPassword: member.plainPassword || null,
            role: 'Staff'
        });
    }
}

async function loadPermissions(db) {
    const { AppSetting } = db.models;
    const existing = await AppSetting.findByPk('permissions');

    if (existing) {
        try {
            const saved = JSON.parse(existing.settingValue);
            return {
                ...defaultPermissions,
                ...saved,
                loginAccess: {
                    ...defaultPermissions.loginAccess,
                    ...(saved.loginAccess || {})
                },
                modules: saved.modules || {}
            };
        } catch (error) {
            return defaultPermissions;
        }
    }

    if (fs.existsSync(PERMISSIONS_FILE)) {
        try {
            const raw = fs.readFileSync(PERMISSIONS_FILE, 'utf8');
            const saved = JSON.parse(raw);
            const normalized = {
                ...defaultPermissions,
                ...saved,
                loginAccess: {
                    ...defaultPermissions.loginAccess,
                    ...(saved.loginAccess || {})
                },
                modules: saved.modules || {}
            };
            await AppSetting.upsert({
                settingKey: 'permissions',
                settingValue: JSON.stringify(normalized)
            });
            return normalized;
        } catch (error) {
            return defaultPermissions;
        }
    }

    return defaultPermissions;
}

async function savePermissions(db, data) {
    const nextPermissions = {
        ...defaultPermissions,
        ...data,
        loginAccess: {
            ...defaultPermissions.loginAccess,
            ...(data.loginAccess || {})
        },
        modules: data.modules || {}
    };

    await db.models.AppSetting.upsert({
        settingKey: 'permissions',
        settingValue: JSON.stringify(nextPermissions)
    });

    return nextPermissions;
}

function getEmailConfig() {
    const host = process.env.SMTP_HOST || '';
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
    const fromEmail = process.env.SMTP_FROM_EMAIL || user;
    const fromName = process.env.SMTP_FROM_NAME || 'My Own School';

    return {
        configured: Boolean(host && port && user && pass && fromEmail),
        host,
        port,
        user,
        pass,
        secure,
        fromEmail,
        fromName
    };
}

function createEmailTransporter() {
    const config = getEmailConfig();
    if (!config.configured) {
        return null;
    }

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

function authenticateToken(req) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        const error = new Error('Authentication token required.');
        error.statusCode = 401;
        throw error;
    }

    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        const authError = new Error('Invalid or expired token.');
        authError.statusCode = 401;
        throw authError;
    }
}

async function ensureUniqueStudentIdentity(Student, User, item, Op) {
    const studentId = item.id || null;
    const normalizedEmail = normalizeOptionalEmail(item.email);
    const normalizedUsername = String(item.username || '').trim();

    if (!normalizedUsername) {
        throw new Error('Student username is required.');
    }

    const usernameConflict = await Student.findOne({
        where: {
            username: normalizedUsername,
            ...(studentId ? { id: { [Op.ne]: studentId } } : {})
        }
    });
    if (usernameConflict) {
        throw new Error('This student username is already assigned to another student.');
    }

    const userUsernameConflict = await User.findOne({
        where: {
            username: normalizedUsername,
            ...(studentId ? { profileId: { [Op.ne]: studentId } } : {})
        }
    });
    if (userUsernameConflict) {
        throw new Error('This username is already used by another account.');
    }

    if (!normalizedEmail) {
        return;
    }

    const emailConflict = await Student.findOne({
        where: {
            email: normalizedEmail,
            ...(studentId ? { id: { [Op.ne]: studentId } } : {})
        }
    });
    if (emailConflict) {
        throw new Error('This student email is already assigned to another student.');
    }

    const userEmailConflict = await User.findOne({
        where: {
            email: normalizedEmail,
            ...(studentId ? { profileId: { [Op.ne]: studentId } } : {})
        }
    });
    if (userEmailConflict) {
        throw new Error('This email is already used by another account.');
    }
}

async function ensureUniqueTeacherIdentity(Teacher, User, item, Op) {
    const teacherId = item.id || null;
    const normalizedEmail = normalizeOptionalEmail(item.email);
    const normalizedUsername = String(item.username || '').trim();

    if (!normalizedUsername) {
        throw new Error('Teacher username is required.');
    }

    const usernameConflict = await Teacher.findOne({
        where: {
            username: normalizedUsername,
            ...(teacherId ? { id: { [Op.ne]: teacherId } } : {})
        }
    });
    if (usernameConflict) {
        throw new Error('This teacher username is already assigned to another teacher.');
    }

    const userUsernameConflict = await User.findOne({
        where: {
            username: normalizedUsername,
            ...(teacherId ? { profileId: { [Op.ne]: teacherId } } : {})
        }
    });
    if (userUsernameConflict) {
        throw new Error('This username is already used by another account.');
    }

    if (!normalizedEmail) {
        return;
    }

    const emailConflict = await Teacher.findOne({
        where: {
            email: normalizedEmail,
            ...(teacherId ? { id: { [Op.ne]: teacherId } } : {})
        }
    });
    if (emailConflict) {
        throw new Error('This teacher email is already assigned to another teacher.');
    }

    const userEmailConflict = await User.findOne({
        where: {
            email: normalizedEmail,
            ...(teacherId ? { profileId: { [Op.ne]: teacherId } } : {})
        }
    });
    if (userEmailConflict) {
        throw new Error('This email is already used by another account.');
    }
}

function renderFeePaymentPage({ title, message, details = [], success = true }) {
    const detailRows = details.map(({ label, value }) => `
        <div class="detail-row">
            <span>${label}</span>
            <strong>${value}</strong>
        </div>
    `).join('');

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>
                body { margin: 0; font-family: Arial, sans-serif; background: #f4f7fb; color: #1f2937; display: grid; place-items: center; min-height: 100vh; padding: 24px; }
                .card { width: min(520px, 100%); background: #fff; border: 1px solid #dbe3ee; border-radius: 20px; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.12); padding: 28px; }
                .badge { display: inline-block; padding: 6px 12px; border-radius: 999px; background: ${success ? '#dcfce7' : '#fee2e2'}; color: ${success ? '#166534' : '#991b1b'}; font-size: 12px; font-weight: 700; margin-bottom: 14px; }
                h1 { margin: 0 0 10px; font-size: 28px; }
                p { margin: 0 0 20px; color: #475569; line-height: 1.6; }
                .details { display: grid; gap: 12px; margin-top: 18px; }
                .detail-row { display: flex; justify-content: space-between; gap: 16px; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; }
                .detail-row span { color: #64748b; font-size: 14px; }
                .detail-row strong { text-align: right; font-size: 14px; }
            </style>
        </head>
        <body>
            <section class="card">
                <div class="badge">${success ? 'Payment Captured' : 'Payment Failed'}</div>
                <h1>${title}</h1>
                <p>${message}</p>
                <div class="details">${detailRows}</div>
            </section>
        </body>
        </html>
    `;
}

async function createChallanToken(req, payload) {
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '120d' });
    const paymentUrl = `${getRequestBaseUrl(req)}/api/fees/pay/${encodeURIComponent(token)}`;
    const qrDataUrl = await QRCode.toDataURL(paymentUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 220
    });

    return { token, paymentUrl, qrDataUrl };
}

module.exports = {
    JWT_SECRET,
    PRINCIPAL_USERNAME,
    PRINCIPAL_PASSWORD,
    createChallanToken,
    createEmailTransporter,
    ensureUniqueStudentIdentity,
    ensureUniqueTeacherIdentity,
    authenticateToken,
    getEmailConfig,
    getRequestBaseUrl,
    isPasswordHash,
    jwt,
    bcrypt,
    loadPermissions,
    normalizeOptionalEmail,
    renderFeePaymentPage,
    savePermissions,
    syncAuthUsers,
    upsertAuthUser
};
