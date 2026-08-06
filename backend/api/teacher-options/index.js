const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');

module.exports = createHandler({
    GET: async ({ res, db }) => {
        const teachers = await db.models.Teacher.findAll({
            attributes: ['id', 'fullName', 'username', 'employeeCode', 'subject', 'campusName'],
            order: [['fullName', 'ASC']]
        });

        sendJson(res, 200, { success: true, teachers });
    }
}, { getDb });
