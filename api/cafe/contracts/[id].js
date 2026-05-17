const { createHandler, sendJson } = require('../../_lib/http');
const { getDb } = require('../../_lib/db');

function mapRecord(record) {
    return record && typeof record.toJSON === 'function' ? record.toJSON() : record;
}

module.exports = createHandler({
    DELETE: async ({ req, res, db }) => {
        const id = String(req.query?.id || '').trim();
        await db.models.CafeContract.destroy({ where: { id } });
        const records = await db.models.CafeContract.findAll({ order: [['updatedAt', 'DESC']] });
        sendJson(res, 200, { success: true, contracts: records.map(mapRecord) });
    }
}, { getDb });
