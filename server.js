const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

const token = process.env.BOT_TOKEN;
const mongoURI = process.env.MONGO_URI;
const ADMIN_ID = process.env.ADMIN_ID;

// مخزن مؤقت لحالة الحوار مع المدير
const userStates = {};

mongoose.connect(mongoURI).then(() => console.log("✅ Connected")).catch(err => console.log(err));

// جعل حقل الصورة (image) اختيارياً لتجنب أخطاء الحفظ
const movieSchema = new mongoose.Schema({
    title: String,
    link: String,
    image: { type: String, default: "https://via.placeholder.com/150" }, 
    date: { type: Date, default: Date.now }
});
const Movie = mongoose.model('Movie', movieSchema);

const bot = new TelegramBot(token, { polling: true });
const app = express();
app.use(cors());

bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text;

    if (chatId !== ADMIN_ID) return;

    // 1. بداية المسار: أمر "نجم نشر"
    if (text === 'نجم نشر') {
        userStates[chatId] = { step: 'CHOOSING_TYPE' };
        return bot.sendMessage(chatId, "مرحباً بك يا مدير.\n\nأرسل رقم (1) لإرسال رابط واحد.\nأرسل رقم (2) لإرسال مجموعة روابط.");
    }

    const state = userStates[chatId];

    if (state) {
        // 2. اختيار النوع (1 أو 2)
        if (state.step === 'CHOOSING_TYPE') {
            if (text === '1') {
                state.step = 'WAITING_SINGLE';
                return bot.sendMessage(chatId, "حسناً، أرسل البيانات بالتنسيق التالي:\nالسطر الأول: الرابط\nالسطر الثاني: الاسم");
            } else if (text === '2') {
                state.step = 'WAITING_MULTIPLE';
                return bot.sendMessage(chatId, "أرسل مجموعة الروابط، كل رابط واسم في رسالة منفصلة بنفس التنسيق:\nالسطر الأول: الرابط\nالسطر الثاني: الاسم");
            }
        }

        // 3. معالجة البيانات المرسلة (سطرين: رابط واسم)
        if (state.step === 'WAITING_SINGLE' || state.step === 'WAITING_MULTIPLE') {
            const lines = text.split('\n');
            
            if (lines.length >= 2) {
                try {
                    const newMovie = new Movie({
                        link: lines[0].trim(),
                        title: lines[1].trim()
                    });
                    await newMovie.save();
                    
                    bot.sendMessage(chatId, `✅ تم حفظ "${lines[1].trim()}" بنجاح!`);
                    
                    // إذا كان رابط واحد، ننهي الحالة. إذا كانت مجموعة، نتركها مفتوحة للمزيد.
                    if (state.step === 'WAITING_SINGLE') delete userStates[chatId];
                } catch (error) {
                    bot.sendMessage(chatId, "❌ حدث خطأ في قاعدة البيانات.");
                }
            } else {
                bot.sendMessage(chatId, "⚠️ تنسيق خاطئ! يجب أن يكون الرابط في السطر الأول والاسم في السطر الثاني.");
            }
        }
    }
});

app.get('/movies', async (req, res) => {
    const movies = await Movie.find().sort({ date: -1 });
    res.json(movies);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server live on ${PORT}`));
