const { createHandler, sendJson } = require('../_lib/http');
const { getDb, Op } = require('../_lib/db');

module.exports = createHandler({
    DELETE: async ({ req, res, db }) => {
        const { id } = req.query;
        const { Student, User } = db.models;
        const deletedCount = await Student.destroy({ where: { id } });

        await User.destroy({
            where: {
                [Op.or]: [
                    { profileId: id, role: 'Student' },
                    { id: `student_${id}` }
                ]
            }
        });

        if (!deletedCount) {
            sendJson(res, 404, { success: false, message: 'Student not found.' });
            return;
        }

        sendJson(res, 200, { success: true, message: 'Student deleted successfully.' });
    }
}, { getDb });
