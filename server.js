const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const config = require('./config');

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

// ربط قواعد البيانات
mongoose.connect(config.MONGO_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB error:', err.message));

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/user', userRoutes);

// تشغيل بوت التلغرام (إذا كانت التوكن موجودة)
if (config.BOT_TOKEN && config.ADMIN_ID) {
    require('./telegram/bot');
    console.log('🤖 Telegram bot started');
} else {
    console.log('⚠️ Telegram bot disabled: missing BOT_TOKEN or ADMIN_ID');
}

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

// تشغيل الخادم
const PORT = config.PORT;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
