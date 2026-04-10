const { app, startServer } = require('../server.js');

module.exports = async (req, res) => {
    try {
        await startServer();
    } catch (error) {
        console.error('Serverless startup warning:', error.message);
    }
    return app(req, res);
};
