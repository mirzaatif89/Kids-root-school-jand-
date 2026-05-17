const { createHandler, sendJson } = require('../_lib/http');
const { getDb, Op } = require('../_lib/db');

module.exports = createHandler({
    DELETE: async ({ req, res, db }) => {
        const { id } = req.query;
        const { Teacher, User } = db.models;
        const deletedCount = await Teacher.destroy({ where: { id } });

        await User.destroy({
            where: {
                [Op.or]: [
                    { profileId: id, role: 'Teacher' },
                    { id: `teacher_${id}` }
                ]
            }
        });

        if (!deletedCount) {
            sendJson(res, 404, { success: false, message: 'Teacher not found.' });
            return;
        }

        sendJson(res, 200, { success: true, message: 'Teacher deleted successfully.' });
    }
}, { getDb });
