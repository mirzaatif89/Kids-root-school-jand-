const fs = require('fs');
const path = require('path');

const STORE_DIR = path.join(process.cwd(), 'data', 'mobile_api_store');
fs.mkdirSync(STORE_DIR, { recursive: true });

function safeStoreName(name = '') {
    return String(name || '').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}

function storePath(storeName) {
    return path.join(STORE_DIR, `${safeStoreName(storeName)}.json`);
}

function readStore(storeName) {
    try {
        const filePath = storePath(storeName);
        if (!fs.existsSync(filePath)) return [];
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
        return [];
    }
}

function writeStore(storeName, records = []) {
    const normalized = Array.isArray(records) ? records : [];
    fs.writeFileSync(storePath(storeName), JSON.stringify(normalized, null, 2), 'utf8');
    return normalized;
}

function normalizeRecord(payload = {}, prefix = 'REC') {
    const raw = payload && typeof payload === 'object' ? payload : {};
    const now = new Date().toISOString();
    return {
        ...raw,
        id: String(raw.id || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
        createdAt: raw.createdAt || now,
        updatedAt: now
    };
}

function upsertRecord(storeName, payload, prefix) {
    const records = readStore(storeName);
    const record = normalizeRecord(payload, prefix);
    const index = records.findIndex((item) => String(item.id) === String(record.id));
    if (index >= 0) records[index] = { ...records[index], ...record };
    else records.unshift(record);
    return { record, records: writeStore(storeName, records) };
}

function deleteRecord(storeName, id) {
    return writeStore(storeName, readStore(storeName).filter((item) => String(item.id) !== String(id)));
}

module.exports = {
    deleteRecord,
    readStore,
    upsertRecord,
    writeStore
};
