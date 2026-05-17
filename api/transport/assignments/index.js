const { createHandler, sendJson } = require('../../_lib/http');
const { getDb } = require('../../_lib/db');

function mapRecord(record) {
    return record && typeof record.toJSON === 'function' ? record.toJSON() : record;
}

module.exports = createHandler({
    GET: async ({ res, db }) => {
        const records = await db.models.TransportAssignment.findAll({ order: [['updatedAt', 'DESC']] });
        sendJson(res, 200, { success: true, assignments: records.map(mapRecord) });
    },
    POST: async ({ res, body, db }) => {
        const payload = body || {};
        const driverName = String(payload.driverName || '').trim();
        const vehicleNumber = String(payload.vehicleNumber || '').trim();
        if (!driverName || !vehicleNumber) {
            sendJson(res, 400, { success: false, message: 'Driver name and vehicle number are required.' });
            return;
        }

        const record = {
            id: String(payload.id || `TRN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).trim(),
            driverName,
            driverPhone: String(payload.driverPhone || '').trim(),
            driverCnic: String(payload.driverCnic || '').trim(),
            licenseNumber: String(payload.licenseNumber || '').trim(),
            licenseExpiry: String(payload.licenseExpiry || '').trim(),
            vehicleNumber,
            vehicleType: String(payload.vehicleType || '').trim(),
            vehicleModel: String(payload.vehicleModel || '').trim(),
            seatingCapacity: Number.parseInt(payload.seatingCapacity || '0', 10) || 0,
            routeName: String(payload.routeName || '').trim(),
            routeArea: String(payload.routeArea || '').trim(),
            pickupTime: String(payload.pickupTime || '').trim(),
            dropTime: String(payload.dropTime || '').trim(),
            helperName: String(payload.helperName || '').trim(),
            helperPhone: String(payload.helperPhone || '').trim(),
            insuranceExpiry: String(payload.insuranceExpiry || '').trim(),
            fitnessExpiry: String(payload.fitnessExpiry || '').trim(),
            status: String(payload.status || 'Active').trim(),
            notes: String(payload.notes || '').trim()
        };

        await db.models.TransportAssignment.upsert(record);
        const records = await db.models.TransportAssignment.findAll({ order: [['updatedAt', 'DESC']] });
        sendJson(res, 200, { success: true, assignment: record, assignments: records.map(mapRecord) });
    }
}, { getDb });
