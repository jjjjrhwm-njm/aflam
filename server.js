/**
 * 🛠️ PROJECT: njmflix - Professional Backend Architecture
 * 🛡️ DEVELOPER: Najm Al-Ibdaa (نجم الإبداع)
 * 🔬 VERSION: 4.0.0 (Production Ready)
 * 🏗️ LOGIC: Deep Tracking, State Persistence, Resilience & Heartbeat
 */

require('dotenv').config(); // تأكد من استدعاء متغيرات البيئة أولاً
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');

// --- إعدادات ثابتة (Constants) ---
const CONFIG = {
    TOKEN: process.env.BOT_TOKEN,
    MONGO_URI: process.env.MONGO_URI,
    ADMIN_ID: process.env.ADMIN_ID,
    APP_URL: 'https://aflam-ehhy.onrender.com', // رابط سيرفرك على ريندر
    HEARTBEAT_INTERVAL: 10 * 60 * 1000, // نبض كل 10 دقائق
    PORT: process.env.PORT || 10000
};

// --- التحقق الأولي من المتغيرات (Sanity Check) ---
if (!CONFIG.TOKEN || !CONFIG.MONGO_URI || !CONFIG.ADMIN_ID) {
    console.error('❌ [CRITICAL] Missing required environment variables. Process terminated.');
    process.exit(1);
}

const app = express();
const bot = new TelegramBot(CONFIG.TOKEN, { polling: true });
const userStates = new Map(); // تتبع دقيق للحالات (State Management)

// --- إعدادات قاعدة البيانات المتقدمة ---
const connectionOptions = {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
};

mongoose.connect(CONFIG.MONGO_URI, connectionOptions)
    .then(() => console.info('✅ [DATABASE] Connection established successfully.'))
    .catch(err => {
        console.error('❌ [DATABASE] Connection failed:', err.message);
        process.exit(1); // إيقاف التشغيل إذا فشل الاتصال بالقاعدة
    });

// مراقبة حالة الاتصال باستمرار
mongoose.connection.on('error', err => console.error('⚠️ [DATABASE] Runtime error:', err));
mongoose.connection.on('disconnected', () => console.warn('⚠️ [DATABASE] Disconnected. Re-connecting...'));

const contentSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    link: { type: String, required: true, trim: true },
    category: { type: String, enum: ['movie', 'series'], required: true },
    metadata: {
        addedBy: String,
        views: { type: Number, default: 0 }
    },
    createdAt: { type: Date, default: Date.now }
});

const Content = mongoose.model('Content', contentSchema, 'movies');

// --- Middleware & Security ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- نظام النبض الاحترافي (Advanced Heartbeat) ---
// يعمل بنظام المناداة الذاتية لضمان عدم دخول السيرفر في وضع النوم (Idle)
const stayAwake = () => {
    console.info('💓 [SYSTEM] Heartbeat initiated: Keeping server alive...');
    const options = {
        headers: { 'User-Agent': 'njmflix-keep-awake-bot' },
        timeout: 10000
    };

    https.get(CONFIG.APP_URL, options, (res) => {
        console.info(`✅ [SYSTEM] Heartbeat response: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error('⚠️ [SYSTEM] Heartbeat failed:', err.message);
    });
};
setInterval(stayAwake, CONFIG.HEARTBEAT_INTERVAL);

// --- API Endpoints ---

// جلب المحتوى مع إمكانية الفلترة
app.get('/api/content', async (req, res) => {
    try {
        const { category } = req.query;
        let query = {};
        if (category && ['movie', 'series'].includes(category)) {
            query.category = category;
        }

        const data = await Content.find(query).sort({ createdAt: -1 }).lean();
        res.status(200).json({
            status: 'success',
            count: data.length,
            data: data
        });
    } catch (error) {
        console.error('❌ [API] Fetch error:', error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
});

// تتبع المشاهدات (Endpoint إضافي)
app.post('/api/content/view/:id', async (req, res) => {
    try {
        await Content.findByIdAndUpdate(req.params.id, { $inc: { 'metadata.views': 1 } });
        res.sendStatus(200);
    } catch (err) { res.sendStatus(500); }
});

// --- منطق البوت (Advanced Admin Logic) ---

bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text?.trim();

    // التحقق من صلاحية الأدمن
    if (chatId !== CONFIG.ADMIN_ID) {
        if (text === '/start') bot.sendMessage(chatId, "🚫 عذراً، هذا البوت مخصص لإدارة تطبيق njmflix فقط.");
        return;
    }

    if (!text) return;

    // الأوامر الأساسية
    if (text === '/start' || text === 'رجوع' || text === 'إلغاء') {
        userStates.delete(chatId);
        return bot.sendMessage(chatId, "👋 أهلاً بك في لوحة تحكم njmflix المتطورة.\n\nاستخدم الأمر: **نجم نشر** للبدء.", {
            reply_markup: { keyboard: [['نجم نشر']], resize_keyboard: true }
        });
    }

    if (text === 'نجم نشر') {
        userStates.set(chatId, { step: 'WAIT_FOR_CATEGORY' });
        return bot.sendMessage(chatId, "🎬 **إضافة محتوى جديد**\n\nيرجى تحديد التصنيف البرمجي:", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🍿 فيلم جديد', callback_data: 'cat_movie' }],
                    [{ text: '📺 مسلسل جديد', callback_data: 'cat_series' }]
                ]
            }
        });
    }

    // تتبع خطوات الإدخال
    const currentState = userStates.get(chatId);
    if (currentState?.step === 'WAIT_FOR_DATA') {
        const lines = text.split('\n').map(l => l.trim());
        
        if (lines.length < 2) {
            return bot.sendMessage(chatId, "⚠️ **خطأ في التنسيق!**\n\nيجب إرسال الرابط في السطر الأول، والاسم في السطر الثاني.");
        }

        const [link, ...titleParts] = lines;
        const title = titleParts.join(' ');

        // تحقق بسيط من الرابط
        if (!link.includes('http')) {
            return bot.sendMessage(chatId, "⚠️ الرابط الذي أرسلته يبدو غير صالح.");
        }

        try {
            const newContent = new Content({
                title: title,
                link: link,
                category: currentState.category,
                metadata: { addedBy: msg.from.username || 'Admin' }
            });

            await newContent.save();
            bot.sendMessage(chatId, `✅ **تم الحقن بنجاح!**\n\nالعنصر: ${title}\nالقسم: ${currentState.category}\n\nالتغييرات ستظهر في التطبيق فوراً.`, {
                reply_markup: { keyboard: [['نجم نشر']], resize_keyboard: true }
            });
            userStates.delete(chatId);
        } catch (error) {
            console.error('❌ [BOT] Save error:', error);
            bot.sendMessage(chatId, "❌ حدث خطأ برمي أثناء محاولة حفظ البيانات في المجلد.");
        }
    }
});

// معالجة الضغط على أزرار Inline
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id.toString();
    const data = query.data;

    if (data.startsWith('cat_')) {
        const category = data.split('_')[1];
        userStates.set(chatId, { step: 'WAIT_FOR_DATA', category: category });

        bot.editMessageText(`🚀 اخترت قسم: ${category === 'movie' ? 'الأفلام' : 'المسلسلات'}\n\nالآن أرسل البيانات بهذا الشكل:\nرابط الفيديو\nاسم الفيلم أو المسلسل`, {
            chat_id: chatId,
            message_id: query.message.message_id
        });
    }
});

// --- بدء التشغيل (Server Startup) ---
app.listen(CONFIG.PORT, () => {
    console.info(`
    *******************************************
    🚀 SERVER STARTUP SUCCESSFUL
    🌐 URL: ${CONFIG.APP_URL}
    📡 PORT: ${CONFIG.PORT}
    🛡️ ADMIN: ${CONFIG.ADMIN_ID}
    *******************************************
    `);
});
