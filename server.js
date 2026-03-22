const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const env = require('./config/env');

const app = express();

// 1. الاتصال بقاعدة البيانات
connectDB();

// 2. إعدادات السيرفر (Middleware)
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 3. الراوتات (APIs)
app.use('/api/content', require('./routes/content'));
app.use('/api/auth', require('./routes/auth'));

// 4. تشغيل بوت التلغرام
if (env.BOT_TOKEN && env.ADMIN_ID) {
    require('./services/telegramBot');
    console.log('🤖 [Telegram Bot] is running...');
}

// 5. تشغيل الواجهة الرئيسية (سيرفر الواجهة الأمامية)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// تشغيل السيرفر
app.listen(env.PORT, () => {
    console.log(`🚀 [Server] Running on port ${env.PORT}`);
});
