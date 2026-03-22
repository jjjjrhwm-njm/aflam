const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const config = require('./config');
const TelegramBot = require('node-telegram-bot-api');

// استيراد الموديلات
require('./models/User');
require('./models/Content');

// استيراد الراوتات
const authRoutes = require('./routes/auth');
const contentRoutes = require('./routes/content');
const userRoutes = require('./routes/user');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // في الإنتاج استخدم true مع HTTPS
}));

// ربط قاعدة البيانات
mongoose.connect(config.MONGO_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB error:', err.message));

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/user', userRoutes);

// ⭐ راوت جلب الصور من تلغرام باستخدام file_id
app.get('/api/image/:fileId', async (req, res) => {
    const fileId = req.params.fileId;
    if (!fileId) {
        return res.status(400).send('Missing fileId');
    }
    try {
        // إنشاء كائن البوت (نفس المستخدم في bot.js)
        const bot = new TelegramBot(config.BOT_TOKEN);
        const link = await bot.getFileLink(fileId);
        // إعادة توجيه المستخدم إلى رابط الصورة الحقيقي
        res.redirect(link.href);
    } catch (error) {
        console.error('Image fetch error:', error);
        // إرسال صورة افتراضية في حال الفشل
        res.redirect('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=500&auto=format&fit=crop');
    }
});

// تقديم الصفحات الأمامية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/vip', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'vip.html'));
});

// تشغيل بوت التلغرام
if (config.BOT_TOKEN && config.ADMIN_ID) {
    require('./telegram/bot');
    console.log('🤖 Telegram bot started');
} else {
    console.log('⚠️ Telegram bot disabled: missing BOT_TOKEN or ADMIN_ID');
}

// تشغيل الخادم
const PORT = config.PORT;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
