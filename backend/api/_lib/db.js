const mysql = require('mysql2/promise');
const { Sequelize, DataTypes, Op } = require('sequelize');
const { syncAuthUsers } = require('./services');

require('dotenv').config();

let startupPromise = null;
let sequelize = null;

function defineStudentModel(db) {
    return db.define('Student', {
        id: { type: DataTypes.STRING, primaryKey: true },
        studentCode: DataTypes.STRING,
        fullName: DataTypes.STRING,
        profileImage: DataTypes.TEXT('long'),
        fingerprintData: DataTypes.TEXT('long'),
        fatherName: DataTypes.STRING,
        dob: DataTypes.STRING,
        admissionDate: DataTypes.STRING,
        classGrade: DataTypes.STRING,
        campusName: DataTypes.STRING,
        gender: DataTypes.STRING,
        parentPhone: DataTypes.STRING,
        email: { type: DataTypes.STRING, unique: true, allowNull: true },
        address: DataTypes.TEXT,
        rollNo: DataTypes.STRING,
        formB: DataTypes.STRING,
        familyId: DataTypes.STRING,
        familyName: DataTypes.STRING,
        familyNo: DataTypes.STRING,
        familyContact: DataTypes.STRING,
        monthlyFee: DataTypes.STRING,
        monthlyFeeCustom: DataTypes.BOOLEAN,
        freeStudy: DataTypes.BOOLEAN,
        zeroFeeReason: DataTypes.TEXT,
        remainingAmount: DataTypes.STRING,
        feeFrequency: DataTypes.STRING,
        feesStatus: { type: DataTypes.STRING, defaultValue: 'Pending' },
        paymentDate: DataTypes.STRING,
        username: { type: DataTypes.STRING, unique: true },
        password: DataTypes.STRING,
        plainPassword: DataTypes.STRING,
        role: { type: DataTypes.STRING, defaultValue: 'Student' },
        enrollmentStatus: { type: DataTypes.STRING, defaultValue: 'Active' },
        stuckOffAt: DataTypes.STRING,
        terminatedAt: DataTypes.STRING,
        terminationNote: DataTypes.TEXT
    });
}

function defineTeacherModel(db) {
    return db.define('Teacher', {
        id: { type: DataTypes.STRING, primaryKey: true },
        employeeCode: DataTypes.STRING,
        fullName: DataTypes.STRING,
        profileImage: DataTypes.TEXT('long'),
        fingerprintData: DataTypes.TEXT('long'),
        fatherName: DataTypes.STRING,
        dob: DataTypes.STRING,
        cnic: DataTypes.STRING,
        phone: DataTypes.STRING,
        email: { type: DataTypes.STRING, unique: true, allowNull: true },
        address: DataTypes.TEXT,
        qualification: DataTypes.STRING,
        campusName: DataTypes.STRING,
        gender: DataTypes.STRING,
        designation: DataTypes.STRING,
        subject: DataTypes.STRING,
        salary: DataTypes.STRING,
        idCardFront: DataTypes.TEXT('long'),
        idCardBack: DataTypes.TEXT('long'),
        cvFile: DataTypes.TEXT('long'),
        bankName: DataTypes.STRING,
        bankAccountTitle: DataTypes.STRING,
        bankAccountNumber: DataTypes.STRING,
        bankBranch: DataTypes.STRING,
        schedule: DataTypes.TEXT('long'),
        username: { type: DataTypes.STRING, unique: true },
        password: DataTypes.STRING,
        plainPassword: DataTypes.STRING,
        employmentStatus: { type: DataTypes.STRING, defaultValue: 'Active' },
        stuckOffAt: DataTypes.STRING,
        stuckOffNote: DataTypes.TEXT,
        groupKey: DataTypes.STRING,
        role: { type: DataTypes.STRING, defaultValue: 'Teacher' }
    });
}

function defineUserModel(db) {
    return db.define('User', {
        id: { type: DataTypes.STRING, primaryKey: true },
        profileId: { type: DataTypes.STRING, allowNull: false },
        fullName: DataTypes.STRING,
        campusName: DataTypes.STRING,
        email: { type: DataTypes.STRING, unique: true, allowNull: true },
        username: { type: DataTypes.STRING, unique: true, allowNull: false },
        password: { type: DataTypes.STRING, allowNull: false },
        plainPassword: DataTypes.STRING,
        groupKey: DataTypes.STRING,
        role: { type: DataTypes.STRING, allowNull: false },
        isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
    });
}

function defineStaffModel(db) {
    return db.define('Staff', {
        id: { type: DataTypes.STRING, primaryKey: true },
        employeeCode: DataTypes.STRING,
        fullName: DataTypes.STRING,
        fatherName: DataTypes.STRING,
        dob: DataTypes.STRING,
        designation: DataTypes.STRING,
        cnic: DataTypes.STRING,
        phone: DataTypes.STRING,
        email: { type: DataTypes.STRING, unique: true, allowNull: true },
        address: DataTypes.TEXT,
        gender: DataTypes.STRING,
        salary: DataTypes.STRING,
        idCardFront: DataTypes.TEXT('long'),
        idCardBack: DataTypes.TEXT('long'),
        bankName: DataTypes.STRING,
        bankAccountTitle: DataTypes.STRING,
        bankAccountNumber: DataTypes.STRING,
        bankBranch: DataTypes.STRING,
        username: { type: DataTypes.STRING, unique: true, allowNull: true },
        password: DataTypes.STRING,
        plainPassword: DataTypes.STRING,
        groupKey: DataTypes.STRING,
        role: { type: DataTypes.STRING, defaultValue: 'Staff' }
    });
}

function defineFeePaymentModel(db) {
    return db.define('FeePayment', {
        challanNumber: { type: DataTypes.STRING, primaryKey: true },
        studentId: { type: DataTypes.STRING, allowNull: false },
        studentName: DataTypes.STRING,
        rollNo: DataTypes.STRING,
        classGrade: DataTypes.STRING,
        session: DataTypes.STRING,
        feeMonth: DataTypes.STRING,
        amount: DataTypes.DECIMAL(10, 2),
        status: { type: DataTypes.STRING, defaultValue: 'Pending' },
        paidAt: { type: DataTypes.DATE, allowNull: true },
        paymentDateLabel: DataTypes.STRING,
        paymentSource: DataTypes.STRING
    });
}

function defineFeeDueBalanceModel(db) {
    return db.define('FeeDueBalance', {
        studentId: { type: DataTypes.STRING, primaryKey: true },
        balance: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
        updatedAtLabel: DataTypes.STRING
    });
}

function defineStudentAttendanceModel(db) {
    return db.define('StudentAttendance', {
        id: { type: DataTypes.STRING, primaryKey: true },
        studentId: { type: DataTypes.STRING, allowNull: false },
        date: { type: DataTypes.STRING, allowNull: false },
        status: { type: DataTypes.STRING, allowNull: false }
    });
}

function defineStudentAssignmentSubmissionModel(db) {
    return db.define('StudentAssignmentSubmission', {
        id: { type: DataTypes.STRING, primaryKey: true },
        studentId: DataTypes.STRING,
        studentCode: DataTypes.STRING,
        studentName: DataTypes.STRING,
        rollNo: DataTypes.STRING,
        classGrade: DataTypes.STRING,
        assignmentTitle: DataTypes.STRING,
        subject: DataTypes.STRING,
        note: DataTypes.TEXT,
        fileName: DataTypes.STRING,
        fileType: DataTypes.STRING,
        fileData: DataTypes.TEXT('long'),
        submittedAt: DataTypes.STRING,
        status: { type: DataTypes.STRING, defaultValue: 'Submitted' }
    });
}

function defineTeacherAttendanceModel(db) {
    return db.define('TeacherAttendance', {
        id: { type: DataTypes.STRING, primaryKey: true },
        teacherId: { type: DataTypes.STRING, allowNull: false },
        date: { type: DataTypes.STRING, allowNull: false },
        status: { type: DataTypes.STRING, allowNull: false }
    });
}

function defineLeaveRequestModel(db) {
    return db.define('LeaveRequest', {
        id: { type: DataTypes.STRING, primaryKey: true },
        applicantRole: { type: DataTypes.STRING, allowNull: false },
        applicantId: { type: DataTypes.STRING, allowNull: false },
        applicantName: DataTypes.STRING,
        email: DataTypes.STRING,
        studentCode: DataTypes.STRING,
        rollNo: DataTypes.STRING,
        classGrade: DataTypes.STRING,
        subject: DataTypes.STRING,
        campusName: DataTypes.STRING,
        fromDate: { type: DataTypes.STRING, allowNull: false },
        toDate: { type: DataTypes.STRING, allowNull: false },
        reason: { type: DataTypes.TEXT, allowNull: false },
        fileName: DataTypes.STRING,
        fileType: DataTypes.STRING,
        fileData: DataTypes.TEXT('long'),
        status: { type: DataTypes.STRING, defaultValue: 'Pending' },
        reviewReason: DataTypes.TEXT,
        reviewedAt: DataTypes.STRING,
        reviewEmailSentAt: DataTypes.STRING
    });
}

function defineSpecialNoticeModel(db) {
    return db.define('SpecialNotice', {
        id: { type: DataTypes.STRING, primaryKey: true },
        title: { type: DataTypes.STRING, allowNull: false },
        message: { type: DataTypes.TEXT('long'), allowNull: false },
        targetPortals: { type: DataTypes.TEXT('long'), allowNull: false },
        status: { type: DataTypes.STRING, defaultValue: 'draft' },
        executedAt: { type: DataTypes.DATE, allowNull: true },
        createdAtLabel: DataTypes.STRING
    });
}

function defineBannerModel(db) {
    return db.define('Banner', {
        id: { type: DataTypes.STRING, primaryKey: true },
        title: { type: DataTypes.STRING, allowNull: false },
        subtitle: { type: DataTypes.STRING, allowNull: true },
        imageUrl: { type: DataTypes.TEXT('long'), allowNull: false },
        linkUrl: { type: DataTypes.STRING, allowNull: true },
        displayOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
        isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
    });
}

function defineAppSettingModel(db) {
    return db.define('AppSetting', {
        settingKey: { type: DataTypes.STRING, primaryKey: true },
        settingValue: { type: DataTypes.TEXT('long'), allowNull: false }
    });
}

function defineLibraryIssueModel(db) {
    return db.define('LibraryIssue', {
        id: { type: DataTypes.STRING, primaryKey: true },
        bookTitle: { type: DataTypes.STRING, allowNull: false },
        bookNumber: { type: DataTypes.STRING, allowNull: false },
        accessionNumber: DataTypes.STRING,
        isbn: DataTypes.STRING,
        author: DataTypes.STRING,
        category: DataTypes.STRING,
        shelfLocation: DataTypes.STRING,
        studentId: { type: DataTypes.STRING, allowNull: false },
        studentName: DataTypes.STRING,
        rollNo: DataTypes.STRING,
        classGrade: DataTypes.STRING,
        fatherName: DataTypes.STRING,
        parentPhone: DataTypes.STRING,
        studentEmail: DataTypes.STRING,
        issueDate: { type: DataTypes.STRING, allowNull: false },
        loanDays: { type: DataTypes.INTEGER, defaultValue: 7 },
        dueDate: { type: DataTypes.STRING, allowNull: false },
        returnDate: DataTypes.STRING,
        status: { type: DataTypes.STRING, defaultValue: 'Issued' },
        finePerDay: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
        conditionIssue: DataTypes.STRING,
        conditionReturn: DataTypes.STRING,
        notes: DataTypes.TEXT
    });
}

function defineCafeContractModel(db) {
    return db.define('CafeContract', {
        id: { type: DataTypes.STRING, primaryKey: true },
        contractorName: { type: DataTypes.STRING, allowNull: false },
        companyName: DataTypes.STRING,
        contactNumber: DataTypes.STRING,
        cnic: DataTypes.STRING,
        email: DataTypes.STRING,
        contractType: DataTypes.STRING,
        startDate: DataTypes.STRING,
        endDate: DataTypes.STRING,
        monthlyRent: DataTypes.DECIMAL(10, 2),
        securityDeposit: DataTypes.DECIMAL(10, 2),
        paymentStatus: DataTypes.STRING,
        menuItems: DataTypes.TEXT,
        hygieneStatus: DataTypes.STRING,
        licenseNumber: DataTypes.STRING,
        staffCount: DataTypes.INTEGER,
        status: { type: DataTypes.STRING, defaultValue: 'Active' },
        notes: DataTypes.TEXT
    });
}

function defineTransportAssignmentModel(db) {
    return db.define('TransportAssignment', {
        id: { type: DataTypes.STRING, primaryKey: true },
        driverName: { type: DataTypes.STRING, allowNull: false },
        driverPhone: DataTypes.STRING,
        driverCnic: DataTypes.STRING,
        licenseNumber: DataTypes.STRING,
        licenseExpiry: DataTypes.STRING,
        vehicleNumber: { type: DataTypes.STRING, allowNull: false },
        vehicleType: DataTypes.STRING,
        vehicleModel: DataTypes.STRING,
        seatingCapacity: DataTypes.INTEGER,
        routeName: DataTypes.STRING,
        routeArea: DataTypes.STRING,
        pickupTime: DataTypes.STRING,
        dropTime: DataTypes.STRING,
        helperName: DataTypes.STRING,
        helperPhone: DataTypes.STRING,
        insuranceExpiry: DataTypes.STRING,
        fitnessExpiry: DataTypes.STRING,
        status: { type: DataTypes.STRING, defaultValue: 'Active' },
        notes: DataTypes.TEXT
    });
}

async function initializeDatabase() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'school_system'}\`;`);
    await connection.end();
}

async function ensureTableColumns(db, tableName, columnDefinitions) {
    const queryInterface = db.getQueryInterface();
    const table = await queryInterface.describeTable(tableName);

    for (const [columnName, definition] of Object.entries(columnDefinitions)) {
        if (!table[columnName]) {
            await queryInterface.addColumn(tableName, columnName, definition);
        }
    }
}

async function ensureLegacySchema(db) {
    await ensureTableColumns(db, 'Students', {
        studentCode: { type: DataTypes.STRING, allowNull: true },
        fullName: { type: DataTypes.STRING, allowNull: true },
        profileImage: { type: DataTypes.TEXT('long'), allowNull: true },
        fingerprintData: { type: DataTypes.TEXT('long'), allowNull: true },
        fatherName: { type: DataTypes.STRING, allowNull: true },
        dob: { type: DataTypes.STRING, allowNull: true },
        admissionDate: { type: DataTypes.STRING, allowNull: true },
        classGrade: { type: DataTypes.STRING, allowNull: true },
        campusName: { type: DataTypes.STRING, allowNull: true },
        gender: { type: DataTypes.STRING, allowNull: true },
        parentPhone: { type: DataTypes.STRING, allowNull: true },
        email: { type: DataTypes.STRING, allowNull: true },
        address: { type: DataTypes.TEXT, allowNull: true },
        rollNo: { type: DataTypes.STRING, allowNull: true },
        formB: { type: DataTypes.STRING, allowNull: true },
        familyId: { type: DataTypes.STRING, allowNull: true },
        familyName: { type: DataTypes.STRING, allowNull: true },
        familyNo: { type: DataTypes.STRING, allowNull: true },
        familyContact: { type: DataTypes.STRING, allowNull: true },
        monthlyFee: { type: DataTypes.STRING, allowNull: true },
        monthlyFeeCustom: { type: DataTypes.BOOLEAN, allowNull: true },
        freeStudy: { type: DataTypes.BOOLEAN, allowNull: true },
        zeroFeeReason: { type: DataTypes.TEXT, allowNull: true },
        remainingAmount: { type: DataTypes.STRING, allowNull: true },
        feeFrequency: { type: DataTypes.STRING, allowNull: true },
        feesStatus: { type: DataTypes.STRING, allowNull: true },
        paymentDate: { type: DataTypes.STRING, allowNull: true },
        username: { type: DataTypes.STRING, allowNull: true },
        password: { type: DataTypes.STRING, allowNull: true },
        plainPassword: { type: DataTypes.STRING, allowNull: true },
        role: { type: DataTypes.STRING, allowNull: true },
        enrollmentStatus: { type: DataTypes.STRING, allowNull: true },
        stuckOffAt: { type: DataTypes.STRING, allowNull: true },
        terminatedAt: { type: DataTypes.STRING, allowNull: true },
        terminationNote: { type: DataTypes.TEXT, allowNull: true }
    });

    await ensureTableColumns(db, 'Users', {
        fullName: { type: DataTypes.STRING, allowNull: true },
        campusName: { type: DataTypes.STRING, allowNull: true },
        email: { type: DataTypes.STRING, allowNull: true },
        username: { type: DataTypes.STRING, allowNull: false },
        password: { type: DataTypes.STRING, allowNull: false },
        plainPassword: { type: DataTypes.STRING, allowNull: true },
        groupKey: { type: DataTypes.STRING, allowNull: true },
        role: { type: DataTypes.STRING, allowNull: false },
        isActive: { type: DataTypes.BOOLEAN, allowNull: true }
    });

    await ensureTableColumns(db, 'Teachers', {
        employeeCode: { type: DataTypes.STRING, allowNull: true },
        fullName: { type: DataTypes.STRING, allowNull: true },
        profileImage: { type: DataTypes.TEXT('long'), allowNull: true },
        fingerprintData: { type: DataTypes.TEXT('long'), allowNull: true },
        fatherName: { type: DataTypes.STRING, allowNull: true },
        dob: { type: DataTypes.STRING, allowNull: true },
        cnic: { type: DataTypes.STRING, allowNull: true },
        phone: { type: DataTypes.STRING, allowNull: true },
        email: { type: DataTypes.STRING, allowNull: true },
        address: { type: DataTypes.TEXT, allowNull: true },
        qualification: { type: DataTypes.STRING, allowNull: true },
        campusName: { type: DataTypes.STRING, allowNull: true },
        gender: { type: DataTypes.STRING, allowNull: true },
        designation: { type: DataTypes.STRING, allowNull: true },
        subject: { type: DataTypes.STRING, allowNull: true },
        salary: { type: DataTypes.STRING, allowNull: true },
        idCardFront: { type: DataTypes.TEXT('long'), allowNull: true },
        idCardBack: { type: DataTypes.TEXT('long'), allowNull: true },
        cvFile: { type: DataTypes.TEXT('long'), allowNull: true },
        bankName: { type: DataTypes.STRING, allowNull: true },
        bankAccountTitle: { type: DataTypes.STRING, allowNull: true },
        bankAccountNumber: { type: DataTypes.STRING, allowNull: true },
        bankBranch: { type: DataTypes.STRING, allowNull: true },
        schedule: { type: DataTypes.TEXT('long'), allowNull: true },
        username: { type: DataTypes.STRING, allowNull: true },
        password: { type: DataTypes.STRING, allowNull: true },
        plainPassword: { type: DataTypes.STRING, allowNull: true },
        employmentStatus: { type: DataTypes.STRING, allowNull: true },
        stuckOffAt: { type: DataTypes.STRING, allowNull: true },
        stuckOffNote: { type: DataTypes.TEXT, allowNull: true },
        groupKey: { type: DataTypes.STRING, allowNull: true },
        role: { type: DataTypes.STRING, allowNull: true }
    });

    await ensureTableColumns(db, 'Staffs', {
        employeeCode: { type: DataTypes.STRING, allowNull: true },
        fullName: { type: DataTypes.STRING, allowNull: true },
        fatherName: { type: DataTypes.STRING, allowNull: true },
        dob: { type: DataTypes.STRING, allowNull: true },
        designation: { type: DataTypes.STRING, allowNull: true },
        cnic: { type: DataTypes.STRING, allowNull: true },
        phone: { type: DataTypes.STRING, allowNull: true },
        email: { type: DataTypes.STRING, allowNull: true },
        address: { type: DataTypes.TEXT, allowNull: true },
        gender: { type: DataTypes.STRING, allowNull: true },
        salary: { type: DataTypes.STRING, allowNull: true },
        idCardFront: { type: DataTypes.TEXT('long'), allowNull: true },
        idCardBack: { type: DataTypes.TEXT('long'), allowNull: true },
        bankName: { type: DataTypes.STRING, allowNull: true },
        bankAccountTitle: { type: DataTypes.STRING, allowNull: true },
        bankAccountNumber: { type: DataTypes.STRING, allowNull: true },
        bankBranch: { type: DataTypes.STRING, allowNull: true },
        username: { type: DataTypes.STRING, allowNull: true },
        password: { type: DataTypes.STRING, allowNull: true },
        plainPassword: { type: DataTypes.STRING, allowNull: true },
        groupKey: { type: DataTypes.STRING, allowNull: true },
        role: { type: DataTypes.STRING, allowNull: true }
    });

    await ensureTableColumns(db, 'StudentAssignmentSubmissions', {
        studentId: { type: DataTypes.STRING, allowNull: true },
        studentCode: { type: DataTypes.STRING, allowNull: true },
        studentName: { type: DataTypes.STRING, allowNull: true },
        rollNo: { type: DataTypes.STRING, allowNull: true },
        classGrade: { type: DataTypes.STRING, allowNull: true },
        assignmentTitle: { type: DataTypes.STRING, allowNull: true },
        subject: { type: DataTypes.STRING, allowNull: true },
        note: { type: DataTypes.TEXT, allowNull: true },
        fileName: { type: DataTypes.STRING, allowNull: true },
        fileType: { type: DataTypes.STRING, allowNull: true },
        fileData: { type: DataTypes.TEXT('long'), allowNull: true },
        submittedAt: { type: DataTypes.STRING, allowNull: true },
        status: { type: DataTypes.STRING, allowNull: true }
    });

    await ensureTableColumns(db, 'LeaveRequests', {
        reviewReason: { type: DataTypes.TEXT, allowNull: true },
        fileName: { type: DataTypes.STRING, allowNull: true },
        fileType: { type: DataTypes.STRING, allowNull: true },
        fileData: { type: DataTypes.TEXT('long'), allowNull: true }
    });
}

async function getDb() {
    if (sequelize) {
        return sequelize;
    }

    if (!startupPromise) {
        startupPromise = (async () => {
            await initializeDatabase();

            const db = new Sequelize(
                process.env.DB_NAME || 'school_system',
                process.env.DB_USER || 'root',
                process.env.DB_PASSWORD || '',
                {
                    host: process.env.DB_HOST || 'localhost',
                    port: Number(process.env.DB_PORT || 3306),
                    dialect: 'mysql',
                    logging: false
                }
            );

            defineStudentModel(db);
            defineTeacherModel(db);
            defineUserModel(db);
            defineStaffModel(db);
            defineFeePaymentModel(db);
            defineFeeDueBalanceModel(db);
            defineStudentAttendanceModel(db);
            defineStudentAssignmentSubmissionModel(db);
            defineTeacherAttendanceModel(db);
            defineLeaveRequestModel(db);
            defineAppSettingModel(db);
            defineSpecialNoticeModel(db);
            defineBannerModel(db);
            defineLibraryIssueModel(db);
            defineCafeContractModel(db);
            defineTransportAssignmentModel(db);

            await db.sync();
            await ensureLegacySchema(db);
            await syncAuthUsers(db);

            sequelize = db;
            return db;
        })().catch((error) => {
            startupPromise = null;
            throw error;
        });
    }

    return startupPromise;
}

module.exports = {
    DataTypes,
    Op,
    getDb
};
