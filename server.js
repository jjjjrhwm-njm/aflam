const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

// استدعاء القيم من متغيرات البيئة (Render)
const token = process.env.BOT_TOKEN;
const mongoURI = process.env.MONGO_URI;
const ADMIN_ID = process.env.ADMIN_ID;

// الاتصال بـ MongoDB
mongoose.connect(mongoURI)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

const movieSchema = new mongoose.Schema({
    title: String,
    image: String,
    link: String,
    date: { type: Date, default: Date.now }
});
const Movie = mongoose.model('Movie', movieSchema);

const bot = new TelegramBot(token, { polling: true });
const app = express();
app.use(cors());

// استقبال البيانات من تيليجرام
bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text;

    // تتبع المسار: هل المرسل هو المدير؟
    if (chatId !== ADMIN_ID) {
        console.log(`⚠️ Unauthorized access attempt from ID: ${chatId}`);
        return;
    }

    const parts = text.split('|');
    if (parts.length === 3) {
        try {
            const newMovie = new Movie({
                title: parts[0].trim(),
                link: parts[1].trim(),
                image: parts[2].trim()
            });
            await newMovie.save();
            bot.sendMessage(chatId, "✅ تم إضافة المحتوى بنجاح إلى قاعدة البيانات!");
        } catch (error) {
            bot.sendMessage(chatId, "❌ حدث خطأ أثناء الحفظ.");
        }
    } else if (text === '/start') {
        bot.sendMessage(chatId, "أهلاً بك يا مدير. أرسل البيانات كالتالي:\nالاسم | الرابط | رابط الصورة");
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
