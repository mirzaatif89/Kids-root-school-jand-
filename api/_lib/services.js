const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');

const JWT_SECRET = process.env.JWT_SECRET || 'eduCore_secret_key_2026';
const PRINCIPAL_USERNAME = process.env.PRINCIPAL_USERNAME || 'principal@school.com';
const PRINCIPAL_PASSWORD = process.env.PRINCIPAL_PASSWORD || 'Principal123';
const PERMISSIONS_FILE = path.join(process.cwd(), 'permissions.json');
const MODULE_KEYS = [
    'dashboard',
    'students',
    'teachers',
    'staff',
    'classes',
    'fees',
    'fee_challan',
    'teacher_salaries',
    'student_attendance',
    'teacher_attendance',
    'student_attendance_report',
    'teacher_attendance_report',
    'notifications',
    'exams',
    'revenue',
    'settings',
    'permissions',
    'branch_registration',
    'aboutme',
    'student_portal'
];
const ACCESS_LEVELS = ['none', 'view', 'edit', 'manage'];
const ALLOWED_HOME_PAGES = new Set([
    'dashboard.html',
    'students.html',
    'teachers.html',
    'staff.html',
    'classes.html',
    'fees.html',
    'fee_challan.html',
    'teacher_salaries.html',
    'student_attendance.html',
    'teacher_attendance.html',
    'student_attendance_report.html',
    'teacher_attendance_report.html',
    'notifications.html',
    'special_notices.html',
    'exams.html',
    'revenue.html',
    'settings.html',
    'permissions.html',
    'branch_registration.html',
    'aboutme.html',
    'student_portal.html'
]);

function buildModuleSet(defaultAccess = 'none', overrides = {}) {
    const acc = MODULE_KEYS.reduce((next, key) => {
        const requested = overrides[key];
        next[key] = ACCESS_LEVELS.includes(requested) ? requested : defaultAccess;
        return next;
    }, {});
    Object.entries(overrides || {}).forEach(([key, value]) => {
        if (!acc[key] && ACCESS_LEVELS.includes(value)) acc[key] = value;
    });
    return acc;
}

const defaultPermissions = {
    loginAccess: {
        admin: true,
        principal: true,
        branch: true,
        teacher: true,
        student: true,
        staff: true
    },
    roleGroups: {
        Admin: 'admin',
        Principal: 'principal',
        Branch: 'branch_manager',
        Teacher: 'teacher',
        Student: 'student',
        Staff: 'staff'
    },
    groups: {
        admin: {
            name: 'System Administrators',
            homePage: 'dashboard.html',
            permissions: buildModuleSet('manage')
        },
        principal: {
            name: 'Principal Group',
            homePage: 'dashboard.html',
            permissions: buildModuleSet('none', {
                dashboard: 'view',
                students: 'view',
                teachers: 'view',
                staff: 'view',
                classes: 'view',
                notifications: 'view',
                exams: 'view',
                revenue: 'view',
                aboutme: 'view'
            })
        },
        branch_manager: {
            name: 'Branch Managers',
            homePage: 'students.html',
            permissions: buildModuleSet('none', {
                students: 'manage',
                dashboard: 'view',
                classes: 'view',
                aboutme: 'view'
            })
        },
        teacher: {
            name: 'Teachers',
            homePage: 'dashboard.html',
            permissions: buildModuleSet('none', {
                dashboard: 'view',
                students: 'view',
                classes: 'view',
                student_attendance: 'edit',
                student_attendance_report: 'view',
                exams: 'edit',
                aboutme: 'view'
            })
        },
        senior_teacher: {
            name: 'Senior Teachers',
            homePage: 'dashboard.html',
            permissions: buildModuleSet('none', {
                dashboard: 'view',
                students: 'view',
                teachers: 'view',
                classes: 'view',
                student_attendance: 'edit',
                student_attendance_report: 'view',
                exams: 'edit',
                aboutme: 'view'
            })
        },
        coordinator: {
            name: 'Coordinators',
            homePage: 'dashboard.html',
            permissions: buildModuleSet('none', {
                dashboard: 'view',
                students: 'view',
                teachers: 'view',
                classes: 'manage',
                student_attendance: 'manage',
                student_attendance_report: 'view',
                teacher_attendance: 'view',
                exams: 'edit',
                aboutme: 'view'
            })
        },
        student: {
            name: 'Students',
            homePage: 'student_portal.html',
            permissions: buildModuleSet('none', {
                student_portal: 'manage',
                fees: 'view',
                fee_challan: 'view',
                exams: 'view',
                aboutme: 'view'
            })
        },
        staff: {
            name: 'Staff',
            homePage: 'dashboard.html',
            permissions: buildModuleSet('none', {
                dashboard: 'view',
                aboutme: 'view'
            })
        },
        accountant: {
            name: 'Accountants',
            homePage: 'dashboard.html',
            permissions: buildModuleSet('none', {
                dashboard: 'view',
                fees: 'manage',
                fee_challan: 'manage',
                revenue: 'view',
                aboutme: 'view'
            })
        },
        receptionist: {
            name: 'Receptionists',
            homePage: 'dashboard.html',
            permissions: buildModuleSet('none', {
                dashboard: 'view',
                students: 'view',
                fees: 'view',
                fee_challan: 'view',
                notifications: 'view',
                aboutme: 'view'
            })
        },
        office_assistant: {
            name: 'Office Assistants',
            homePage: 'dashboard.html',
            permissions: buildModuleSet('none', {
                dashboard: 'view',
                students: 'view',
                classes: 'view',
                notifications: 'view',
                aboutme: 'view'
            })
        }
    }
};

function normalizePermissionsConfig(input = {}) {
    const raw = input && typeof input === 'object' ? input : {};
    const groupsInput = raw.groups && typeof raw.groups === 'object' ? raw.groups : {};
    const customModules = Array.isArray(raw.customModules) ? raw.customModules : [];
    const allowedHomePages = new Set(ALLOWED_HOME_PAGES);
    customModules.forEach((module) => {
        if (module && module.page) allowedHomePages.add(String(module.page));
    });
    const groups = Object.entries({
        ...defaultPermissions.groups,
        ...groupsInput
    }).reduce((acc, [key, groupValue]) => {
        const baseGroup = defaultPermissions.groups[key] || {
            name: key,
            homePage: 'dashboard.html',
            permissions: buildModuleSet('none')
        };
        const nextGroup = groupValue && typeof groupValue === 'object' ? groupValue : {};
        const requestedHomePage = String(nextGroup.homePage || baseGroup.homePage || 'dashboard.html');
        acc[key] = {
            name: String(nextGroup.name || baseGroup.name || key),
            homePage: allowedHomePages.has(requestedHomePage) ? requestedHomePage : 'dashboard.html',
            permissions: buildModuleSet('none', {
                ...baseGroup.permissions,
                ...(nextGroup.permissions || {})
            })
        };
        return acc;
    }, {});

    return {
        loginAccess: {
            ...defaultPermissions.loginAccess,
            ...(raw.loginAccess || {})
        },
        roleGroups: {
            ...defaultPermissions.roleGroups,
            ...(raw.roleGroups || {})
        },
        customModules,
        groups
    };
}

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
        groupKey: payload.groupKey || null,
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
            groupKey: teacher.groupKey || 'teacher',
            role: 'Teacher'
        });
    }

    const staffMembers = await Staff.findAll({
        attributes: ['id', 'fullName', 'email', 'username', 'password', 'plainPassword', 'groupKey']
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
            groupKey: member.groupKey || 'staff',
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
            return normalizePermissionsConfig(saved);
        } catch (error) {
            return defaultPermissions;
        }
    }

    if (fs.existsSync(PERMISSIONS_FILE)) {
        try {
            const raw = fs.readFileSync(PERMISSIONS_FILE, 'utf8');
            const saved = JSON.parse(raw);
            const normalized = normalizePermissionsConfig(saved);
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
    const nextPermissions = normalizePermissionsConfig(data);

    await db.models.AppSetting.upsert({
        settingKey: 'permissions',
        settingValue: JSON.stringify(nextPermissions)
    });

    return nextPermissions;
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
    ensureUniqueStudentIdentity,
    ensureUniqueTeacherIdentity,
    authenticateToken,
    getRequestBaseUrl,
    isPasswordHash,
    jwt,
    bcrypt,
    loadPermissions,
    normalizeOptionalEmail,
    renderFeePaymentPage,
    savePermissions,
    syncAuthUsers,
    upsertAuthUser,
    normalizePermissionsConfig
};
