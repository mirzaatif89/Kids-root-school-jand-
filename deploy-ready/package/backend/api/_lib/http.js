function setBaseHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, statusCode, payload) {
    setBaseHeaders(res);
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
    setBaseHeaders(res);
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
}

async function readBody(req) {
    if (req.body !== undefined) {
        return req.body;
    }

    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }

    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (!raw) {
        return {};
    }

    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (contentType.includes('application/json')) {
        return JSON.parse(raw);
    }

    return raw;
}

function createHandler(handlers, { getDb } = {}) {
    return async (req, res) => {
        setBaseHeaders(res);

        if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
        }

        const methodHandler = handlers[req.method];
        if (!methodHandler) {
            sendJson(res, 405, {
                success: false,
                message: `Method ${req.method} not allowed.`
            });
            return;
        }

        try {
            const db = getDb ? await getDb() : null;
            const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req) : undefined;
            await methodHandler({ req, res, db, body });
        } catch (error) {
            if (res.writableEnded) {
                return;
            }

            sendJson(res, error.statusCode || 500, {
                success: false,
                message: error.message || 'Internal server error.'
            });
        }
    };
}

module.exports = {
    createHandler,
    sendJson,
    sendHtml
};
