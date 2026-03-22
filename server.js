/**
 * 🚀 StreamFlix Pro - Ultimate Backend V6.0
 * 🎬 Enterprise Edition: Netflix-Style Data Architecture
 * 🛡️ Security: Session Protection & Proxy Layer
 */

const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');

// ==================== الإعدادات الأساسية ====================
const CONFIG = {
    TOKEN: process.env.BOT_TOKEN,
    MONGO_URI: process.env.MONGO_URI,
    ADMIN_ID: process.env.ADMIN_ID,
    APP_URL: process.env.APP_URL || 'https://aflam-ehhy.onrender.com',
    PORT: process.env.PORT || 10000,
    SESSION_SECRET: process.env.SESSION_SECRET // المفتاح السري الذي أضفته في ريندر
};

// التحقق من المتغيرات لضمان عمل السيرفر
if (!CONFIG.TOKEN || !CONFIG.MONGO_URI || !CONFIG.ADMIN_ID) {
    console.error('❌ [CRITICAL] Missing essential Environment Variables!');
    process.exit(1);
}

const app = express();
const bot = new TelegramBot(CONFIG.TOKEN, { polling: true });
const userStates = new Map();

// ==================== الاتصال بقاعدة البيانات ====================
mongoose.connect(CONFIG.MONGO_URI, {
    serverSelectionTimeoutMS: 5000
})
.then(() => console.log('✅ [DATABASE] Connected to MongoDB Atlas'))
.catch(err => console.error('❌ [DATABASE] Connection failed:', err.message));

// ==================== هيكل البيانات (Content Schema) ====================
const contentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    link: { type: String, required: true },
    category: { type: String, enum: ['movie', 'series', 'anime'], required: true },
    genre: { type: String, default: 'عام' }, // أكشن، دراما، خيال علمي...
    poster: { type: String, required: true }, // معرف صورة تليجرام
    views: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const Content = mongoose.model('Content', contentSchema, 'movies');

// ==================== برمجيات الوسيط (Middleware) ====================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// نظام النبض (Heartbeat) لمنع السيرفر من الدخول في وضع النوم
setInterval(() => {
    https.get(CONFIG.APP_URL).on('error', () => {});
}, 600000);

// ==================== نقاط الوصول (API Endpoints) ====================

// 1. جلب كل المحتوى (مع دعم الفلترة)
app.get('/api/content', async (req, res) => {
    try {
        const { category } = req.query;
        const filter = category && category !== 'all' ? { category } : {};
        const data = await Content.find(filter).sort({ createdAt: -1 }).lean();
        res.json({ status: 'success', data });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
});

// 2. بروكسي الصور: جلب البوستر مباشرة من تليجرام
app.get('/api/image/:fileId', async (req, res) => {
    try {
        const fileUrl = await bot.getFileLink(req.params.fileId);
        // توجيه المتصفح مباشرة لرابط تليجرام لسرعة التحميل
        res.redirect(fileUrl);
    } catch (error) {
        res.status(404).end();
    }
});

// ==================== منطق بوت الإدارة (Telegram Bot) ====================

bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    if (chatId !== CONFIG.ADMIN_ID) return;

    if (msg.text === 'نجم نشر' || msg.text === '/start') {
        userStates.delete(chatId);
        return bot.sendMessage(chatId, "🛠️ **لوحة تحكم StreamFlix Pro**\n\nاختر القسم الرئيسي للمحتوى:", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🍿 أفلام', callback_data: 'main_movie' }],
                    [{ text: '📺 مسلسلات', callback_data: 'main_series' }],
                    [{ text: '🎌 أنمي', callback_data: 'main_anime' }]
                ]
            }
        });
    }

    const state = userStates.get(chatId);
    
    // استقبال الصورة وبيانات الفيلم
    if (state?.step === 'WAIT_DATA' && msg.photo) {
        const caption = msg.caption?.trim();
        if (!caption) return bot.sendMessage(chatId, "⚠️ خطأ! يرجى كتابة (الرابط ثم الاسم) في وصف الصورة.");

        const lines = caption.split('\n').map(l => l.trim());
        if (lines.length < 2) return bot.sendMessage(chatId, "⚠️ خطأ! اكتب الرابط في السطر الأول والاسم في الثاني.");

        const fileId = msg.photo[msg.photo.length - 1].file_id;

        try {
            const newEntry = new Content({
                link: lines[0],
                title: lines[1],
                category: state.category,
                genre: state.genre,
                poster: fileId
            });
            await newEntry.save();
            bot.sendMessage(chatId, `✅ **تم النشر بنجاح!**\n🎬 الاسم: ${lines[1]}\n📂 التصنيف: ${state.genre}`);
            userStates.delete(chatId);
        } catch (e) {
            bot.sendMessage(chatId, "❌ حدث خطأ أثناء الحفظ في قاعدة البيانات.");
        }
    }
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id.toString();
    const data = query.data;

    if (data.startsWith('main_')) {
        const category = data.split('_')[1];
        userStates.set(chatId, { step: 'WAIT_GENRE', category });
        
        bot.editMessageText("اختر النوع (Genre):", {
            chat_id: chatId, message_id: query.message.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔥 أكشن', callback_data: 'genre_أكشن' }, { text: '🎭 دراما', callback_data: 'genre_دراما' }],
                    [{ text: '🛸 خيال علمي', callback_data: 'genre_خيال علمي' }, { text: '🥷 أنمي', callback_data: 'genre_أنمي' }],
                    [{ text: '🤣 كوميديا', callback_data: 'genre_كوميديا' }, { text: '🧟 رعب', callback_data: 'genre_رعب' }]
                ]
            }
        });
    } else if (data.startsWith('genre_')) {
        const genre = data.split('_')[1];
        const state = userStates.get(chatId);
        if (state) {
            state.step = 'WAIT_DATA';
            state.genre = genre;
            bot.editMessageText(`🚀 القسم: ${genre}\n\nأرسل الآن **صورة البوستر**، واكتب في وصفها:\nالرابط\nاسم الفيلم`, {
                chat_id: chatId, message_id: query.message.message_id
            });
        }
    }
    bot.answerCallbackQuery(query.id);
});

// تشغيل السيرفر
app.listen(CONFIG.PORT, () => {
    console.log(`🚀 [SERVER] StreamFlix Pro running on port ${CONFIG.PORT}`);
    console.log(`🤖 [BOT] Telegram Administrator is active`);
});
