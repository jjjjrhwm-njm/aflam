const TelegramBot = require('node-telegram-bot-api');
const User = require('../models/User');
const Content = require('../models/Content');
const env = require('../config/env');

const bot = new TelegramBot(env.BOT_TOKEN, { polling: true });
const userStates = new Map(); // لتتبع مسارات الإدخال (State Machine)

// دالة التحقق من الأدمن
const isAdmin = (chatId) => String(chatId).trim() === String(env.ADMIN_ID).trim();

// 1. مسار البداية /start
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
        bot.sendMessage(chatId, '🎬 **لوحة تحكم StreamFlix Pro**\nمرحباً بك يا مدير، ماذا تريد أن تفعل؟', { parse_mode: 'Markdown', ...opts });
    } else {
        // تسجيل المستخدم العادي أو جلبه
        let user = await User.findOne({ telegramId: String(chatId) });
        if (!user) {
            user = new User({ telegramId: String(chatId), username: username });
            await user.save();
        }

        const opts = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⭐️ اشتراك VIP (100 نجمة)', callback_data: 'subscribe_vip' }],
                    [{ text: '📱 فتح التطبيق', web_app: { url: 'https://your-render-url.onrender.com' } }] // استبدل الرابط لاحقاً
                ]
            }
        };
        
        let msgText = `مرحباً ${username} في StreamFlix! 🎬\n\n`;
        if (user.isVIP && user.vipUntil > new Date()) {
            msgText += `✅ اشتراكك VIP فعال حتى: ${user.vipUntil.toLocaleDateString()}`;
        } else {
            msgText += `❌ لا يوجد لديك اشتراك VIP نشط. اشترك الآن للاستمتاع بأفضل الأفلام.`;
        }

        bot.sendMessage(chatId, msgText, opts);
    }
});

// 2. معالجة الاستدعاءات (Callback Queries)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    // استجابة فورية لمنع تعليق الزر
    await bot.answerCallbackQuery(query.id);

    // --- مسارات المستخدم العادي (الاشتراك بالنجوم) ---
    if (data === 'subscribe_vip') {
        const title = 'اشتراك StreamFlix VIP 👑';
        const description = 'اشتراك لمدة 30 يوماً يتيح لك الوصول إلى جميع الأفلام والمسلسلات الحصرية.';
        const payload = `vip_1_month_${chatId}`; // تتبع من قام بالدفع
        const providerToken = ''; // يجب أن يكون فارغاً للنجوم (XTR)
        const currency = 'XTR';
        const prices = [{ label: 'اشتراك شهر', amount: 100 }]; // 100 نجمة

        await bot.sendInvoice(chatId, title, description, payload, providerToken, currency, prices);
        return;
    }

    // --- مسارات الأدمن ---
    if (!isAdmin(chatId)) return;

    if (data === 'pub_public' || data === 'pub_vip') {
        const isVIP = data === 'pub_vip';
        userStates.set(chatId, { step: 'waiting_poster', isVIP });
        bot.sendMessage(chatId, '📸 أرسل صورة الغلاف (البوستر) الآن:');
    } else if (data === 'cancel') {
        userStates.delete(chatId);
        bot.sendMessage(chatId, '✅ تم إلغاء جميع العمليات.');
    }
});

// 3. تأكيد الدفع المسبق (Pre-checkout)
bot.on('pre_checkout_query', async (query) => {
    // يجب الموافقة على العملية لتكتمل عملية الدفع بالنجوم
    await bot.answerPreCheckoutQuery(query.id, true);
});

// 4. استلام الدفع بنجاح (Successful Payment)
bot.on('successful_payment', async (msg) => {
    const chatId = msg.chat.id;
    const payload = msg.successful_payment.invoice_payload;

    if (payload.startsWith('vip_1_month')) {
        // حساب تاريخ الانتهاء (بعد 30 يوم من الآن)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        await User.findOneAndUpdate(
            { telegramId: String(chatId) },
            { isVIP: true, vipUntil: expiryDate }
        );

        bot.sendMessage(chatId, '🎉 **مبروك!** تم تفعيل اشتراكك VIP لمدة 30 يوماً بنجاح.\nيمكنك الآن فتح التطبيق والاستمتاع بالمحتوى.', { parse_mode: 'Markdown' });
    }
});

// 5. استلام مدخلات الأدمن (الصور والنصوص)
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    const state = userStates.get(chatId);
    if (!state) return;

    if (state.step === 'waiting_poster' && msg.photo) {
        state.poster = msg.photo[msg.photo.length - 1].file_id;
        state.step = 'waiting_link';
        userStates.set(chatId, state);
        bot.sendMessage(chatId, '🔗 ممتاز، أرسل الآن رابط الفيديو:');
    } 
    else if (state.step === 'waiting_link' && msg.text) {
        state.link = msg.text;
        state.step = 'waiting_title';
        userStates.set(chatId, state);
        bot.sendMessage(chatId, '📝 أرسل اسم الفيلم/المسلسل:');
    }
    else if (state.step === 'waiting_title' && msg.text) {
        try {
            const newContent = new Content({
                title: msg.text,
                link: state.link,
                poster: state.poster,
                isVIP: state.isVIP
            });
            await newContent.save();
            userStates.delete(chatId);
            bot.sendMessage(chatId, `✅ **تم النشر بنجاح!**\nالاسم: ${msg.text}\nالنوع: ${state.isVIP ? '👑 VIP' : '📢 عام'}`, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error(error);
            bot.sendMessage(chatId, '❌ حدث خطأ أثناء الحفظ في قاعدة البيانات.');
        }
    }
});

module.exports = bot;
