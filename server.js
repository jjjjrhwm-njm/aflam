const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

const token = process.env.BOT_TOKEN;
const mongoURI = process.env.MONGO_URI;
const ADMIN_ID = process.env.ADMIN_ID;

const userStates = {};

// إعداد البوت مع خيار معالجة الأخطاء بشكل أفضل
const bot = new TelegramBot(token, { polling: { autoStart: true } });

mongoose.connect(mongoURI)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => console.error("❌ MongoDB Error:", err));

const movieSchema = new mongoose.Schema({
    title: String,
    link: String,
    image: { type: String, default: "https://via.placeholder.com/150" },
    date: { type: Date, default: Date.now }
});
const Movie = mongoose.model('Movie', movieSchema);

const app = express();
app.use(cors());

bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString().trim();
    const adminId = ADMIN_ID ? ADMIN_ID.toString().trim() : "";
    const text = msg.text ? msg.text.trim() : "";

    if (chatId !== adminId) return;

    if (text === 'نجم نشر') {
        userStates[chatId] = { step: 'CHOOSING_TYPE' };
        return bot.sendMessage(chatId, "مرحباً بك يا مدير.\n\nأرسل رقم (1) لرابط واحد.\nأرسل رقم (2) لمجموعة روابط.");
    }
    
    // ... باقي منطق الـ state كما هو في الكود السابق ...
    const state = userStates[chatId];
    if (state && state.step === 'CHOOSING_TYPE') {
        if (text === '1') {
            state.step = 'WAITING_SINGLE';
            return bot.sendMessage(chatId, "أرسل البيانات (الرابط في سطر، والاسم في سطر)");
        } else if (text === '2') {
            state.step = 'WAITING_MULTIPLE';
            return bot.sendMessage(chatId, "أرسل مجموعة الروابط (رابط ثم اسم لكل فيلم)");
        }
    }
});

app.get('/movies', async (req, res) => {
    const movies = await Movie.find().sort({ date: -1 });
    res.json(movies);
});

// --- الجزء الأهم: إنهاء العمليات الشبحية ---
const gracefulShutdown = () => {
    console.log("⚠️ Stopping bot polling and closing server...");
    bot.stopPolling();
    mongoose.connection.close();
    process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
