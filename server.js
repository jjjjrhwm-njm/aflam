const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const connectDB = require('./config/db');
const env = require('./config/env');

const app = express();

// 1. الاتصال بقاعدة البيانات
connectDB();

// 2. إعدادات السيرفر (Middleware)
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 3. إنشاء مسار خفيف جداً مخصص للنبض فقط لتجنب استهلاك الذاكرة
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// 4. الراوتات (APIs)
app.use('/api/content', require('./routes/content'));
app.use('/api/auth', require('./routes/auth'));

// 5. تشغيل بوت التلغرام
if (env.BOT_TOKEN && env.ADMIN_ID) {
    require('./services/telegramBot');
    console.log('🤖 [Telegram Bot] is running...');
}

// 6. تشغيل الواجهة الرئيسية (سيرفر الواجهة الأمامية)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 7. تشغيل السيرفر ودالة النبض المستمر
app.listen(env.PORT, () => {
    console.log(`🚀 [Server] Running on port ${env.PORT}`);

    // نظام النبض الاحترافي: يضرب مسار /ping كل 5 دقائق
    const APP_URL = 'https://aflam-ehhy.onrender.com/ping'; 
    
    setInterval(() => {
        https.get(APP_URL, (resp) => {
            if (resp.statusCode === 200) {
                console.log('✅ نبض السيرفر: تم تنشيط المسار بنجاح (السيرفر مستيقظ)');
            }
        }).on("error", (err) => {
            console.error("❌ خطأ في النبض: " + err.message);
        });
    }, 5 * 60 * 1000); // 5 دقائق لضمان قطع الطريق على نظام السبات في رندر
});
