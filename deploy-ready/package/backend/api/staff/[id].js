const { createHandler, sendJson } = require('../_lib/http');
const { getDb, Op } = require('../_lib/db');

module.exports = createHandler({
    DELETE: async ({ req, res, db }) => {
        const { id } = req.query;
        const { Staff, User } = db.models;
        const deletedCount = await Staff.destroy({ where: { id } });

        await User.destroy({
            where: {
                [Op.or]: [
                    { profileId: id, role: 'Staff' },
                    { id: `staff_${id}` }
                ]
            }
        });

        if (!deletedCount) {
            sendJson(res, 404, { success: false, message: 'Staff not found.' });
            return;
        }

        sendJson(res, 200, { success: true, message: 'Staff deleted successfully.' });
    }
}, { getDb });
