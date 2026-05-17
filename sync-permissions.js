#!/usr/bin/env node

require('dotenv').config();

const path = require('path');
const fs = require('fs');

// Load the database configuration from environment variables
const dbConfig = {
    development: {
        username: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'school_system',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false
    }
};

const env = process.env.NODE_ENV || 'development';
const config = dbConfig[env];

// Try to load database if it exists
async function syncPermissions() {
    try {
        const { Sequelize } = require('sequelize');
        const sequelize = new Sequelize(
            config.database,
            config.username,
            config.password,
            {
                host: config.host,
                port: config.port,
                dialect: config.dialect,
                logging: false
            }
        );

        // Load permissions.json
        const permissionsPath = path.join(__dirname, 'permissions.json');
        if (!fs.existsSync(permissionsPath)) {
            console.error('❌ permissions.json not found');
            process.exit(1);
        }

        const permissionsData = fs.readFileSync(permissionsPath, 'utf8');
        const permissions = JSON.parse(permissionsData);

        // Create AppSetting model inline
        const AppSetting = sequelize.define('AppSetting', {
            settingKey: { type: require('sequelize').DataTypes.STRING, primaryKey: true },
            settingValue: require('sequelize').DataTypes.TEXT
        }, {
            tableName: 'AppSettings',
            timestamps: true,
            createdAt: 'createdAt',
            updatedAt: 'updatedAt'
        });

        // Sync the permission
        await AppSetting.upsert({
            settingKey: 'permissions',
            settingValue: JSON.stringify(permissions),
            createdAt: new Date(),
            updatedAt: new Date()
        });

        console.log('✓ Permissions synced successfully!');
        console.log(`  - Found ${Object.keys(permissions.groups || {}).length} role groups:`);
        Object.keys(permissions.groups || {}).forEach(key => {
            console.log(`    • ${permissions.groups[key].name} (${key})`);
        });
        
        await sequelize.close();
        process.exit(0);
    } catch (error) {
        if (error.code === 'ECONNREFUSED' || error.message.includes('connect')) {
            console.error('❌ Database connection failed. Make sure MySQL is running.');
            console.error('   You can manually update permissions later through the admin panel.');
        } else {
            console.error('❌ Error syncing permissions:', error.message);
        }
        process.exit(1);
    }
}

syncPermissions();
