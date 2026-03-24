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

// 3. إنشاء مسار خفيف جداً مخصص للنبض الصامت (تعديل: نجم الإبداع)
app.get('/ping', (req, res) => {
    res.sendStatus(200); 
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

// 7. تشغيل السيرفر ودالة النبض المستمر (معدل ليعمل على ريبلت)
app.listen(env.PORT, () => {
    console.log(`🚀 [Server] Running on port ${env.PORT}`);

    // الرابط الصحيح الخاص بك في ريبلت لضمان عدم النوم
    const APP_URL = 'https://f49b206b-6baf-4619-8fcc-e9376222ad4e-00-1mauw39nh2hwz.pike.replit.dev/ping'; 
    
    setInterval(() => {
        https.get(APP_URL, (resp) => {
            // نبض داخلي صامت لضمان الاستمرارية
        }).on("error", (err) => {
            // لا نكتب شيئاً إلا في حال وجود خطأ حقيقي
        });
    }, 5 * 60 * 1000); // كل 5 دقائق
});
