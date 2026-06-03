const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');

function formatBanner(record) {
    const raw = record && typeof record.toJSON === 'function' ? record.toJSON() : record;
    return {
        ...raw,
        displayOrder: Number(raw.displayOrder || 0),
        isActive: raw.isActive !== false
    };
}

module.exports = createHandler({
    DELETE: async ({ req, res, db }) => {
        const deletedCount = await db.models.Banner.destroy({ where: { id: req.query.id } });
        const records = await db.models.Banner.findAll({
            order: [['displayOrder', 'ASC'], ['updatedAt', 'DESC']]
        });

        sendJson(res, 200, {
            success: true,
            deleted: deletedCount > 0,
            banners: records.map(formatBanner)
        });
    }
}, { getDb });
