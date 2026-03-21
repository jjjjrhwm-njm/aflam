const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const path = require('path'); // مكتبة ضرورية لتشغيل ملف الـ HTML

const token = process.env.BOT_TOKEN;
const mongoURI = process.env.MONGO_URI;
const ADMIN_ID = process.env.ADMIN_ID;

const userStates = {};

// إعداد البوت
const bot = new TelegramBot(token, { polling: { autoStart: true } });

// الاتصال بقاعدة البيانات
mongoose.connect(mongoURI)
    .then(() => console.log("✅ Connected to MongoDB"))
    .catch(err => console.error("❌ MongoDB Error:", err));

// هيكل البيانات المطور (أضفنا قسم المسلسلات والأفلام)
const contentSchema = new mongoose.Schema({
    title: String,
    link: String,
    image: { type: String, default: "https://via.placeholder.com/150" },
    category: { type: String, default: 'movie' }, // movie (فيلم) أو series (مسلسل)
    date: { type: Date, default: Date.now }
});
// ربطنا الموديل بنفس الجدول القديم (movies) عشان ما تضيع بياناتك السابقة
const Content = mongoose.model('Content', contentSchema, 'movies'); 

// إعداد السيرفر
const app = express();
app.use(cors());

// ---- القسم الجديد: استضافة واجهة "نجم فليكس" ----
app.get('/', (req, res) => {
    // هذا السطر يخبر السيرفر بفتح ملف index.html عند الدخول للرابط
    res.sendFile(path.join(__dirname, 'index.html'));
});

// واجهة جلب البيانات
app.get('/movies', async (req, res) => {
    try {
        const items = await Content.find().sort({ date: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ---- نظام حوار البوت المطور ----
bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString().trim();
    const adminId = ADMIN_ID ? ADMIN_ID.toString().trim() : "";
    const text = msg.text ? msg.text.trim() : "";

    if (chatId !== adminId) return;

    // 1. بداية المسار (اختيار القسم)
    if (text === 'نجم نشر') {
        userStates[chatId] = { step: 'CHOOSING_CATEGORY' };
        return bot.sendMessage(chatId, "مرحباً بك يا مدير 👑\n\nاختر القسم المطلوب إضافته:\n1️⃣ - مسلسلات\n2️⃣ - أفلام");
    }
    
    const state = userStates[chatId];
    
    if (state) {
        // 2. معالجة اختيار القسم
        if (state.step === 'CHOOSING_CATEGORY') {
            if (text === '1') {
                state.category = 'series'; // حفظ كمسلسل
                state.step = 'CHOOSING_TYPE';
                return bot.sendMessage(chatId, "📺 قسم المسلسلات:\n\nأرسل رقم (1) لرابط واحد.\nأرسل رقم (2) لمجموعة روابط.");
            } else if (text === '2') {
                state.category = 'movie'; // حفظ كفيلم
                state.step = 'CHOOSING_TYPE';
                return bot.sendMessage(chatId, "🎬 قسم الأفلام:\n\nأرسل رقم (1) لرابط واحد.\nأرسل رقم (2) لمجموعة روابط.");
            } else {
                return bot.sendMessage(chatId, "⚠️ الرجاء إرسال 1 للمسلسلات أو 2 للأفلام.");
            }
        }

        // 3. اختيار طريقة الإرسال (مفرد أو مجموعة)
        if (state.step === 'CHOOSING_TYPE') {
            if (text === '1') {
                state.step = 'WAITING_SINGLE';
                return bot.sendMessage(chatId, "أرسل البيانات (الرابط في سطر، والاسم في سطر)");
            } else if (text === '2') {
                state.step = 'WAITING_MULTIPLE';
                return bot.sendMessage(chatId, "أرسل مجموعة الروابط (كل محتوى في رسالة منفصلة)");
            } else {
                return bot.sendMessage(chatId, "⚠️ الرجاء إرسال 1 أو 2.");
            }
        }

        // 4. حفظ البيانات النهائية
        if (state.step === 'WAITING_SINGLE' || state.step === 'WAITING_MULTIPLE') {
            const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            
            if (lines.length >= 2) {
                try {
                    const newContent = new Content({
                        link: lines[0],
                        title: lines[1],
                        category: state.category // يتم حفظ القسم الذي اخترته هنا
                    });
                    await newContent.save();
                    
                    const typeName = state.category === 'series' ? "المسلسل" : "الفيلم";
                    bot.sendMessage(chatId, `✅ تم حفظ ${typeName} "${lines[1]}" بنجاح!`);
                    
                    if (state.step === 'WAITING_SINGLE') delete userStates[chatId];
                    
                } catch (error) {
                    bot.sendMessage(chatId, "❌ حدث خطأ في قاعدة البيانات أثناء الحفظ.");
                }
            } else {
                bot.sendMessage(chatId, "⚠️ تنسيق خاطئ! أرسل الرابط في السطر الأول، والاسم في السطر الثاني.");
            }
        }
    }
});

// الإنهاء الآمن
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
