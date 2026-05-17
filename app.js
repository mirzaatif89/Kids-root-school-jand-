const { server, startServer } = require('./server');

const PORT = Number(process.env.PORT || 3000);

async function main() {
    await startServer();

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Real-Time SQL Server running on http://localhost:${PORT}`);
    });

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use. Close the old server terminal or stop node.exe, then run npm start again.`);
            process.exit(1);
        }
        throw error;
    });
}

main().catch((err) => {
    console.error('Startup failed:', err?.message || err);
    process.exit(1);
});
