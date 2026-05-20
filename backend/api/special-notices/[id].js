const { createHandler, sendJson } = require('../_lib/http');
const { getDb } = require('../_lib/db');

function normalizeNoticeTargets(targetPortals) {
    const allowedTargets = new Set(['student', 'teacher', 'staff']);
    const targets = Array.isArray(targetPortals) ? targetPortals : [];
    return [...new Set(targets.map((target) => String(target || '').toLowerCase()).filter((target) => allowedTargets.has(target)))];
}

function formatSpecialNotice(record) {
    const raw = record && typeof record.toJSON === 'function' ? record.toJSON() : record;
    let targetPortals = [];
    try {
        targetPortals = JSON.parse(raw.targetPortals || '[]');
    } catch (error) {
        targetPortals = [];
    }
    return {
        ...raw,
        targetPortals: normalizeNoticeTargets(targetPortals)
    };
}

module.exports = createHandler({
    DELETE: async ({ req, res, db }) => {
        const id = req.query?.id || req.url.split('/').pop();
        const deletedCount = await db.models.SpecialNotice.destroy({ where: { id } });
        const records = await db.models.SpecialNotice.findAll({
            order: [['updatedAt', 'DESC']]
        });

        sendJson(res, 200, {
            success: true,
            deleted: deletedCount > 0,
            notices: records.map(formatSpecialNotice)
        });
    }
}, { getDb });
