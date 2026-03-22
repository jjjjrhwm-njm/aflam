const dotenv = require('dotenv');
dotenv.config();

module.exports = {
    PORT: process.env.PORT || 3000,
    MONGO_URI: process.env.MONGO_URI,
    BOT_TOKEN: process.env.BOT_TOKEN,
    ADMIN_ID: process.env.ADMIN_ID,
    SESSION_SECRET: process.env.SESSION_SECRET,
    APP_URL: process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`,
    JWT_SECRET: process.env.JWT_SECRET || 'streamflix_jwt_secret_2026'
};
