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
    GET: async ({ res, db }) => {
        const records = await db.models.Banner.findAll({
            order: [['displayOrder', 'ASC'], ['updatedAt', 'DESC']]
        });
        sendJson(res, 200, { success: true, banners: records.map(formatBanner) });
    },
    POST: async ({ res, db, body }) => {
        const title = String(body?.title || '').trim();
        const imageUrl = String(body?.imageUrl || '').trim();

        if (!title || !imageUrl) {
            const error = new Error('Banner title and image URL are required.');
            error.statusCode = 400;
            throw error;
        }

        const banner = {
            id: body?.id || `BANNER-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title,
            subtitle: String(body?.subtitle || '').trim(),
            imageUrl,
            linkUrl: String(body?.linkUrl || '').trim(),
            displayOrder: Number(body?.displayOrder || 0),
            isActive: body?.isActive !== false
        };

        await db.models.Banner.upsert(banner);
        const records = await db.models.Banner.findAll({
            order: [['displayOrder', 'ASC'], ['updatedAt', 'DESC']]
        });

        sendJson(res, 200, {
            success: true,
            banner: formatBanner(banner),
            banners: records.map(formatBanner)
        });
    }
}, { getDb });
