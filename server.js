/**
 * 🛠️ PROJECT: njmflix - Professional Backend V5.0 (Categorized & Poster Supported)
 * 🛡️ DEVELOPER: Najm Al-Ibdaa (نجم الإبداع)
 */

const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');

const CONFIG = {
    TOKEN: process.env.BOT_TOKEN,
    MONGO_URI: process.env.MONGO_URI,
    ADMIN_ID: process.env.ADMIN_ID,
    APP_URL: 'https://aflam-ehhy.onrender.com',
    PORT: process.env.PORT || 10000
};

if (!CONFIG.TOKEN || !CONFIG.MONGO_URI || !CONFIG.ADMIN_ID) {
    console.error('❌ [CRITICAL] المتغيرات مفقودة في لوحة تحكم ريندر!');
    process.exit(1);
}

const app = express();
const bot = new TelegramBot(CONFIG.TOKEN, { polling: true });
const userStates = new Map();

mongoose.connect(CONFIG.MONGO_URI)
    .then(() => console.log('✅ [DATABASE] Connected successfully.'))
    .catch(err => console.error('❌ [DATABASE] Failed:', err.message));

// 1. تحديث قاعدة البيانات لدعم الصور والتصنيفات الفرعية
const contentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    link: { type: String, required: true },
    category: { type: String, enum: ['movie', 'series'], required: true },
    genre: { type: String, default: 'عام' }, // أكشن، دراما، إلخ
    poster: { type: String }, // مُعرف الصورة في تليجرام
    createdAt: { type: Date, default: Date.now }
});
const Content = mongoose.model('Content', contentSchema, 'movies');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

setInterval(() => {
    https.get(CONFIG.APP_URL).on('error', () => {});
}, 600000);

// 2. نقطة نهاية (API) جديدة لجلب الأفلام
app.get('/api/content', async (req, res) => {
    try {
        const data = await Content.find().sort({ createdAt: -1 }).lean();
        res.status(200).json({ status: 'success', data });
    } catch (error) {
        res.status(500).json({ status: 'error' });
    }
});

// 3. نقطة نهاية (Proxy) خارقة لجلب الصور من تليجرام بأمان وبدون كشف التوكن
app.get('/api/image/:fileId', async (req, res) => {
    try {
        const link = await bot.getFileLink(req.params.fileId);
        https.get(link, (response) => {
            res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
            res.setHeader('Cache-Control', 'public, max-age=86400'); // تخزين مؤقت لتسريع التطبيق
            response.pipe(res);
        }).on('error', () => res.status(500).end());
    } catch (error) {
        res.status(500).end();
    }
});

// 4. هندسة البوت المتطورة (مسارات متسلسلة)
bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    if (chatId !== CONFIG.ADMIN_ID) return;

    if (msg.text === 'نجم نشر' || msg.text === '/start') {
        userStates.delete(chatId);
        return bot.sendMessage(chatId, "🛠️ **لوحة التحكم المطور**\n\nيرجى اختيار القسم الرئيسي:", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🍿 أفلام', callback_data: 'main_movie' }],
                    [{ text: '📺 مسلسلات', callback_data: 'main_series' }]
                ]
            }
        });
    }

    const state = userStates.get(chatId);
    
    // استقبال الصورة ووصفها
    if (state?.step === 'WAIT_DATA' && msg.photo) {
        const caption = msg.caption?.trim();
        if (!caption) return bot.sendMessage(chatId, "⚠️ خطأ! نسيت كتابة الوصف (الرابط والاسم) تحت الصورة.");

        const lines = caption.split('\n').map(l => l.trim());
        if (lines.length < 2) return bot.sendMessage(chatId, "⚠️ خطأ! اكتب الرابط في سطر، والاسم في السطر الذي تحته.");

        const fileId = msg.photo[msg.photo.length - 1].file_id; // أعلى جودة للصورة

        try {
            await new Content({
                link: lines[0],
                title: lines[1],
                category: state.category,
                genre: state.genre,
                poster: fileId
            }).save();
            bot.sendMessage(chatId, `✅ **تم الحقن بنجاح!**\n🎬 الاسم: ${lines[1]}\n📂 القسم: ${state.category === 'movie' ? 'أفلام' : 'مسلسلات'} - ${state.genre}`);
            userStates.delete(chatId);
        } catch (e) {
            bot.sendMessage(chatId, "❌ فشل الحفظ في قاعدة البيانات.");
        }
    } else if (state?.step === 'WAIT_DATA' && !msg.photo) {
        bot.sendMessage(chatId, "⚠️ الرجاء إرسال **صورة البوستر**، وكتابة الرابط والاسم في خانة الوصف (Caption).");
    }
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id.toString();
    const data = query.data;

    if (data.startsWith('main_')) {
        const category = data.split('_')[1];
        userStates.set(chatId, { step: 'WAIT_GENRE', category: category });
        
        bot.editMessageText(`اختر تصنيف ${category === 'movie' ? 'الأفلام' : 'المسلسلات'}:`, {
            chat_id: chatId, message_id: query.message.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔥 أكشن', callback_data: 'genre_أكشن' }, { text: '🎭 دراما', callback_data: 'genre_دراما' }],
                    [{ text: '🛸 خيال علمي', callback_data: 'genre_خيال علمي' }, { text: '🥷 أنمي', callback_data: 'genre_أنمي' }],
                    [{ text: '🤣 كوميديا', callback_data: 'genre_كوميديا' }, { text: '🧟 رعب', callback_data: 'genre_رعب' }],
                    [{ text: '🌍 مغامرات', callback_data: 'genre_مغامرات' }, { text: '✨ فنتازيا', callback_data: 'genre_فنتازيا' }]
                ]
            }
        });
    } else if (data.startsWith('genre_')) {
        const genre = data.split('_')[1];
        const state = userStates.get(chatId);
        if(state) {
           state.step = 'WAIT_DATA';
           state.genre = genre;
           userStates.set(chatId, state);
           bot.editMessageText(`🚀 ممتاز! اخترت قسم (${genre}).\n\nأرسل الآن **صورة بوستر الفيلم**، واكتب في مساحة الوصف (Caption) للصورة:\nالرابط\nاسم الفيلم`, {
               chat_id: chatId, message_id: query.message.message_id
           });
        }
    }
    bot.answerCallbackQuery(query.id);
});

app.listen(CONFIG.PORT, () => console.log(`🔥 [SERVER] Ready on port ${CONFIG.PORT}`));
