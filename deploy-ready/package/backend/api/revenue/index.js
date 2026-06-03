const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');

module.exports = createHandler({
    GET: async ({ res, db }) => {
        try {
            const { Student, Teacher, Staff, FeePayment } = db.models;
            
            // Get all active students
            const students = await Student.findAll({
                where: { enrollmentStatus: ['Active', 'enrolled'] },
                attributes: ['id', 'name', 'classGrade', 'monthlyFee', 'admissionDate', 'enrollmentStatus']
            });

            // Get all teachers with salary
            const teachers = await Teacher.findAll({
                where: { salary: { $gt: 0 } },
                attributes: ['id', 'fullName', 'salary', 'campusName', 'designation']
            });

            // Get all staff with salary
            const staff = await Staff.findAll({
                where: { salary: { $gt: 0 } },
                attributes: ['id', 'fullName', 'salary', 'designation']
            });

            // Get fee payments
            const fees = await FeePayment.findAll({
                order: [['paidAt', 'DESC']]
            });

            sendJson(res, 200, {
                success: true,
                data: {
                    students: students || [],
                    teachers: teachers || [],
                    staff: staff || [],
                    fees: fees || []
                }
            });
        } catch (error) {
            console.error('Revenue data fetch error:', error);
            sendJson(res, 500, {
                success: false,
                error: error.message || 'Failed to fetch revenue data'
            });
        }
    }
}, { getDb });
