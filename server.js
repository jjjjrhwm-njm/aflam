const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https'); // استدعاء مكتبة النبض
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

    // 6. نظام النبض (Keep-Alive) لمنع سيرفر Render المجاني من النوم
    const APP_URL = 'https://aflam-ehhy.onrender.com'; 
    
    setInterval(() => {
        https.get(APP_URL, (resp) => {
            if (resp.statusCode === 200) {
                console.log('✅ نبض السيرفر: السيرفر مستيقظ والبوت يعمل');
            }
        }).on("error", (err) => {
            console.log("❌ خطأ في النبض: " + err.message);
        });
    }, 14 * 60 * 1000); // إرسال طلب كل 14 دقيقة
});
