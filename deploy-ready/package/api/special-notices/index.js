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

    if (Array.isArray(raw.targetPortals)) {
        targetPortals = raw.targetPortals;
    } else {
        try {
            targetPortals = JSON.parse(raw.targetPortals || '[]');
        } catch (error) {
            targetPortals = [];
        }
    }

    return {
        ...raw,
        targetPortals: normalizeNoticeTargets(targetPortals)
    };
}

module.exports = createHandler({
    GET: async ({ req, res, db }) => {
        const portal = String(req.query?.portal || '').toLowerCase();
        const records = await db.models.SpecialNotice.findAll({
            where: portal ? { status: 'executed' } : {},
            order: [['updatedAt', 'DESC']]
        });
        const notices = records.map(formatSpecialNotice)
            .filter((notice) => !portal || notice.targetPortals.includes(portal));

        sendJson(res, 200, { success: true, notices });
    },
    POST: async ({ res, db, body }) => {
        const title = String(body?.title || '').trim();
        const message = String(body?.message || '').trim();
        const targetPortals = normalizeNoticeTargets(body?.targetPortals);
        const status = body?.status === 'executed' ? 'executed' : 'draft';

        if (!title || !message) {
            const error = new Error('Notice title and message are required.');
            error.statusCode = 400;
            throw error;
        }

        if (status === 'executed' && !targetPortals.length) {
            const error = new Error('Select at least one portal before executing.');
            error.statusCode = 400;
            throw error;
        }

        const notice = {
            id: body?.id || `NOTICE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            title,
            message,
            targetPortals: JSON.stringify(targetPortals),
            status,
            executedAt: status === 'executed' ? (body?.executedAt || new Date()) : null,
            createdAtLabel: body?.createdAtLabel || new Date().toLocaleString('en-GB')
        };

        await db.models.SpecialNotice.upsert(notice);
        const records = await db.models.SpecialNotice.findAll({
            order: [['updatedAt', 'DESC']]
        });

        sendJson(res, 200, {
            success: true,
            notice: formatSpecialNotice(notice),
            notices: records.map(formatSpecialNotice)
        });
    }
}, { getDb });
