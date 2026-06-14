const path = require('path');
const fs = require('fs');
const Module = require('module');

const nodevenvCandidates = [
    path.join(__dirname, '..', 'nodevenv', path.basename(__dirname), '20', 'lib', 'node_modules'),
    path.join(__dirname, '..', 'nodevenv', path.basename(__dirname), 'node_modules')
];

for (const nodeModulesPath of nodevenvCandidates) {
    if (fs.existsSync(nodeModulesPath)) {
        process.env.NODE_PATH = process.env.NODE_PATH
            ? `${nodeModulesPath}${path.delimiter}${process.env.NODE_PATH}`
            : nodeModulesPath;
    }
}
Module._initPaths();

require('dotenv').config({ path: path.join(__dirname, '.env') });

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const { server, startServer } = require('./backend/server');

const PORT = Number(process.env.PORT || 3000);

startServer()
    .then(() => {
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`School CRM running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Startup failed:', error?.message || error);
        process.exit(1);
    });
