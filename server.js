const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

const token = process.env.BOT_TOKEN;
const mongoURI = process.env.MONGO_URI;
const ADMIN_ID = process.env.ADMIN_ID;

const userStates = {};

// إعداد البوت مع التشغيل التلقائي
const bot = new TelegramBot(token, { polling: { autoStart: true } });

// الاتصال بقاعدة البيانات
mongoose.connect(mongoURI)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => console.error("❌ MongoDB Error:", err));

// هيكل البيانات (الصورة اختيارية لمنع الأخطاء)
const movieSchema = new mongoose.Schema({
    title: String,
    link: String,
    image: { type: String, default: "https://via.placeholder.com/150" },
    date: { type: Date, default: Date.now }
});
const Movie = mongoose.model('Movie', movieSchema);

// إعداد السيرفر
const app = express();
app.use(cors());

// معالجة رسائل البوت
bot.on('message', async (msg) => {
    // تأمين المعرفات والنصوص
    const chatId = msg.chat.id.toString().trim();
    const adminId = ADMIN_ID ? ADMIN_ID.toString().trim() : "";
    const text = msg.text ? msg.text.trim() : "";

    // حماية: لا يستجيب إلا لك
    if (chatId !== adminId) return;

    // 1. بداية المسار: أمر "نجم نشر"
    if (text === 'نجم نشر') {
        userStates[chatId] = { step: 'CHOOSING_TYPE' };
        return bot.sendMessage(chatId, "مرحباً بك يا مدير.\n\nأرسل رقم (1) لرابط واحد.\nأرسل رقم (2) لمجموعة روابط.");
    }
    
    const state = userStates[chatId];
    
    if (state) {
        // 2. اختيار النوع
        if (state.step === 'CHOOSING_TYPE') {
            if (text === '1') {
                state.step = 'WAITING_SINGLE';
                return bot.sendMessage(chatId, "أرسل البيانات (الرابط في سطر، والاسم في سطر)");
            } else if (text === '2') {
                state.step = 'WAITING_MULTIPLE';
                return bot.sendMessage(chatId, "أرسل مجموعة الروابط (رابط ثم اسم لكل فيلم في رسالة منفصلة)");
            }
        }

        // 3. معالجة الإدخال
        if (state.step === 'WAITING_SINGLE' || state.step === 'WAITING_MULTIPLE') {
            // الفلترة الذكية: تقسيم النص وحذف أي مسافات أو سطور فارغة زائدة لتجنب مشاكل النسخ واللصق
            const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            if (lines.length >= 2) {
                try {
                    const newMovie = new Movie({
                        link: lines[0], // السطر الأول دائماً سيكون الرابط
                        title: lines[1] // السطر الثاني دائماً سيكون الاسم
                    });
                    await newMovie.save();
                    
                    bot.sendMessage(chatId, `✅ تم حفظ "${lines[1]}" بنجاح!`);
                    
                    // إنهاء الحالة إذا كان رابط واحد فقط
                    if (state.step === 'WAITING_SINGLE') delete userStates[chatId];
                    
                } catch (error) {
                    console.error("Database Save Error:", error);
                    bot.sendMessage(chatId, "❌ حدث خطأ في قاعدة البيانات أثناء الحفظ.");
                }
            } else {
                bot.sendMessage(chatId, "⚠️ لم أتمكن من قراءة البيانات. تأكد من إرسال الرابط في السطر الأول، والاسم في السطر الثاني دون مسافات كثيرة.");
            }
        }
    }
});

// واجهة الـ API لجلب الأفلام للتطبيق
app.get('/movies', async (req, res) => {
    try {
        const movies = await Movie.find().sort({ date: -1 });
        res.json(movies);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// نظام الإنهاء الآمن (Graceful Shutdown) لمنع التعليق في Render
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
