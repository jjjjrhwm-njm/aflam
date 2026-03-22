// server.js
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

// 3. الراوتات (سيتم إضافتها في الخطوة القادمة)
// app.use('/api/auth', require('./routes/auth'));
// app.use('/api/content', require('./routes/content'));

// 4. تشغيل بوت التلغرام (سيتم إضافته لاحقاً)
// require('./services/telegramBot');

// 5. تشغيل الواجهة الرئيسية
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// تشغيل السيرفر
app.listen(env.PORT, () => {
    console.log(`🚀 [Server] Running on port ${env.PORT}`);
});
