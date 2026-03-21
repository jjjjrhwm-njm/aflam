/**
 * 🛠️ PROJECT: njmflix - Professional Backend V4.1
 * 🛡️ DEVELOPER: Najm Al-Ibdaa (نجم الإبداع)
 * 🏗️ LOGIC: Deep Tracking & Heartbeat (No dotenv dependency)
 */

const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');

// الإعدادات - ريندر سيقرأ هذه المتغيرات من الـ Environment Variables في لوحة التحكم
const CONFIG = {
    TOKEN: process.env.BOT_TOKEN,
    MONGO_URI: process.env.MONGO_URI,
    ADMIN_ID: process.env.ADMIN_ID,
    APP_URL: 'https://aflam-ehhy.onrender.com', // رابط سيرفرك
    PORT: process.env.PORT || 10000
};

// التحقق من وجود المتغيرات لضمان عدم الانهيار
if (!CONFIG.TOKEN || !CONFIG.MONGO_URI || !CONFIG.ADMIN_ID) {
    console.error('❌ [CRITICAL] المتغيرات مفقودة في لوحة تحكم ريندر!');
    process.exit(1);
}

const app = express();
const bot = new TelegramBot(CONFIG.TOKEN, { polling: true });
const userStates = new Map(); // تتبع دقيق للحالات

// الاتصال بقاعدة البيانات
mongoose.connect(CONFIG.MONGO_URI)
    .then(() => console.log('✅ [DATABASE] Connected successfully.'))
    .catch(err => console.error('❌ [DATABASE] Failed:', err.message));

const contentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    link: { type: String, required: true },
    category: { type: String, enum: ['movie', 'series'], required: true },
    createdAt: { type: Date, default: Date.now }
});
const Content = mongoose.model('Content', contentSchema, 'movies');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- نظام النبض (Heartbeat) لمنع السيرفر من النوم ---
setInterval(() => {
    console.log('💓 [SYSTEM] Sending self-ping...');
    https.get(CONFIG.APP_URL, (res) => {
        console.log(`✅ [SYSTEM] Ping Status: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error('⚠️ [SYSTEM] Ping Failed:', err.message);
    });
}, 600000); // كل 10 دقائق

// API لجلب البيانات للواجهة
app.get('/api/content', async (req, res) => {
    try {
        const data = await Content.find().sort({ createdAt: -1 }).lean();
        res.status(200).json({ status: 'success', data });
    } catch (error) {
        res.status(500).json({ status: 'error' });
    }
});

// منطق البوت (Deep Tracking)
bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text?.trim();

    if (chatId !== CONFIG.ADMIN_ID) return;
    if (!text) return;

    if (text === 'نجم نشر' || text === '/start') {
        userStates.delete(chatId);
        return bot.sendMessage(chatId, "🛠️ **لوحة التحكم المطور**\n\nيرجى اختيار القسم:", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🍿 أفلام', callback_data: 'cat_movie' }],
                    [{ text: '📺 مسلسلات', callback_data: 'cat_series' }]
                ]
            }
        });
    }

    const state = userStates.get(chatId);
    if (state?.step === 'WAIT_DATA') {
        const lines = text.split('\n').map(l => l.trim());
        if (lines.length < 2) return bot.sendMessage(chatId, "⚠️ خطأ! أرسل الرابط ثم الاسم في سطر جديد.");

        try {
            await new Content({
                title: lines[1],
                link: lines[0],
                category: state.category
            }).save();
            bot.sendMessage(chatId, `✅ تم الحقن بنجاح: ${lines[1]}`);
            userStates.delete(chatId);
        } catch (e) {
            bot.sendMessage(chatId, "❌ فشل الحفظ في قاعدة البيانات.");
        }
    }
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id.toString();
    const category = query.data.split('_')[1];
    
    userStates.set(chatId, { step: 'WAIT_DATA', category: category });
    bot.answerCallbackQuery(query.id);
    bot.sendMessage(chatId, `🚀 أرسل الآن بيانات قسم ${category === 'movie' ? 'الأفلام' : 'المسلسلات'}\nرابط الفيديو\nاسم الفيلم`);
});

app.listen(CONFIG.PORT, () => console.log(`🔥 [SERVER] Ready on port ${CONFIG.PORT}`));
