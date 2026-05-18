require('dotenv').config();

const { startServer, server } = require('./server');

const PORT = process.env.PORT || 3000;

startServer()
    .then(() => {
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`Apexiums app running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Startup failed:', err?.message || err);
        process.exit(1);
    });
