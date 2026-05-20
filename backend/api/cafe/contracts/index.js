const { createHandler, sendJson } = require('../../_lib/http');
const { getDb } = require('../../_lib/db');

function mapRecord(record) {
    return record && typeof record.toJSON === 'function' ? record.toJSON() : record;
}

module.exports = createHandler({
    GET: async ({ res, db }) => {
        const records = await db.models.CafeContract.findAll({ order: [['updatedAt', 'DESC']] });
        sendJson(res, 200, { success: true, contracts: records.map(mapRecord) });
    },
    POST: async ({ res, body, db }) => {
        const payload = body || {};
        const contractorName = String(payload.contractorName || '').trim();
        if (!contractorName) {
            sendJson(res, 400, { success: false, message: 'Contractor name is required.' });
            return;
        }

        const record = {
            id: String(payload.id || `CAFE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).trim(),
            contractorName,
            companyName: String(payload.companyName || '').trim(),
            contactNumber: String(payload.contactNumber || '').trim(),
            cnic: String(payload.cnic || '').trim(),
            email: String(payload.email || '').trim(),
            contractType: String(payload.contractType || 'Cafe Operations').trim(),
            startDate: String(payload.startDate || '').trim(),
            endDate: String(payload.endDate || '').trim(),
            monthlyRent: Number(payload.monthlyRent || 0),
            securityDeposit: Number(payload.securityDeposit || 0),
            paymentStatus: String(payload.paymentStatus || 'Pending').trim(),
            menuItems: String(payload.menuItems || '').trim(),
            hygieneStatus: String(payload.hygieneStatus || 'Good').trim(),
            licenseNumber: String(payload.licenseNumber || '').trim(),
            staffCount: Number.parseInt(payload.staffCount || '0', 10) || 0,
            status: String(payload.status || 'Active').trim(),
            notes: String(payload.notes || '').trim()
        };

        await db.models.CafeContract.upsert(record);
        const records = await db.models.CafeContract.findAll({ order: [['updatedAt', 'DESC']] });
        sendJson(res, 200, { success: true, contract: record, contracts: records.map(mapRecord) });
    }
}, { getDb });
