// services/telegramBot.js
const TelegramBot = require('node-telegram-bot-api');
const User = require('../models/User');
const Content = require('../models/Content');
const env = require('../config/env');

const bot = new TelegramBot(env.BOT_TOKEN, { polling: true });
const userStates = new Map();

const isAdmin = (chatId) => String(chatId).trim() === String(env.ADMIN_ID).trim();

// 1. مسار الأوامر /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || 'مستخدم';

    if (isAdmin(chatId)) {
        const opts = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📢 نشر محتوى عام', callback_data: 'pub_public' }],
                    [{ text: '👑 نشر محتوى VIP', callback_data: 'pub_vip' }],
                    [{ text: '❌ إلغاء العملية', callback_data: 'cancel' }]
                ]
            }
        };
        bot.sendMessage(chatId, '🎬 **لوحة تحكم الأدمن**\nجاهز لسحب الأفلام ورفعها للمخزن؟', { parse_mode: 'Markdown', ...opts });
    } else {
        let user = await User.findOne({ telegramId: String(chatId) });
        if (!user) {
            user = new User({ telegramId: String(chatId), username: username });
            await user.save();
        }
        const opts = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⭐️ اشتراك VIP (100 نجمة)', callback_data: 'subscribe_vip' }],
                    [{ text: '📱 فتح التطبيق', web_app: { url: 'https://aflam-ehhy.onrender.com' } }]
                ]
            }
        };
        bot.sendMessage(chatId, `مرحباً ${username} في StreamFlix! 🎬`, opts);
    }
});

// 2. معالجة الأزرار
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    await bot.answerCallbackQuery(query.id);

    if (data === 'subscribe_vip') {
        await bot.sendInvoice(chatId, 'اشتراك VIP 👑', 'وصول حصري للأفلام', `vip_${chatId}`, '', 'XTR', [{ label: 'شهر', amount: 100 }]);
        return;
    }

    if (!isAdmin(chatId)) return;
    if (data === 'pub_public' || data === 'pub_vip') {
        userStates.set(chatId, { step: 'waiting_poster', isVIP: data === 'pub_vip' });
        bot.sendMessage(chatId, '📸 أرسل صورة الغلاف (البوستر):');
    } else if (data === 'cancel') {
        userStates.delete(chatId);
        bot.sendMessage(chatId, '✅ تم الإلغاء.');
    }
});

// 3. معالجة الرسائل وشفط الأفلام
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId) || msg.text === '/start') return;

    const state = userStates.get(chatId);
    if (!state) return;

    // الخطوة 1: استلام البوستر
    if (state.step === 'waiting_poster' && msg.photo) {
        state.poster = msg.photo[msg.photo.length - 1].file_id;
        state.step = 'waiting_link';
        userStates.set(chatId, state);
        bot.sendMessage(chatId, '🔗 أرسل رابط الفيلم المباشر (MP4):\n(سأقوم بشفطه ورفعه للمخزن تلقائياً)');
    } 
    // الخطوة 2: استلام الرابط وشفطه للمخزن
    else if (state.step === 'waiting_link' && msg.text) {
        const loadingMsg = await bot.sendMessage(chatId, '⏳ جاري شفط الفيلم ورفعه لقناتك @nejm_njm... انتظر قليلاً.');
        try {
            // تلجرام سيسحب الفيديو من الرابط ويرفعه لقناتك مباشرة
            const storageMsg = await bot.sendVideo(env.STORAGE_CHANNEL, msg.text, {
                caption: `🎬 فيلم جديد مضاف للتطبيق\nالمصدر: سحب تلقائي`
            });

            state.link = storageMsg.video.file_id; // حفظ الـ File ID كمرجع للفيلم
            state.step = 'waiting_title';
            userStates.set(chatId, state);
            bot.editMessageText('✅ تم الرفع للمخزن بنجاح! الآن أرسل اسم الفيلم:', { chat_id: chatId, message_id: loadingMsg.message_id });
        } catch (e) {
            bot.sendMessage(chatId, '❌ فشل السحب. تأكد أن الرابط مباشر وينتهي بـ .mp4');
        }
    }
    // الخطوة 3: استلام الاسم والحفظ النهائي
    else if (state.step === 'waiting_title' && msg.text) {
        const newContent = new Content({
            title: msg.text,
            link: state.link, // هذا هو File ID الفيلم في قناتك
            poster: state.poster,
            isVIP: state.isVIP
        });
        await newContent.save();
        userStates.delete(chatId);
        bot.sendMessage(chatId, `✅ تم الحفظ بنجاح!\nالفيلم الآن متاح في التطبيق ومخزن في قناتك.`);
    }
});

module.exports = bot;
