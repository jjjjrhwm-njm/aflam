const TelegramBot = require('node-telegram-bot-api');
const Content = require('../models/Content');
const User = require('../models/User');
const config = require('../config');

const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });
const userStates = new Map();

const GENRES = ['أكشن', 'رعب', 'كوميدي', 'دراما', 'فانتازيا', 'خيال علمي', 'أنمي', 'إثارة'];

// دالة مساعدة لتوحيد مقارنة الـ ID
const isAdmin = (id) => id.toString() === config.ADMIN_ID.toString();

async function sendMainMenu(chatId, messageId = null) {
    const text = '🎬 **لوحة تحكم StreamFlix Pro**\nأهلاً بك يا مطور، اختر الأمر:';
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📢 نشر محتوى جديد', callback_data: 'publish_main' }],
                [{ text: '✏️ تعديل أو حذف محتوى', callback_data: 'edit_main' }],
                [{ text: '👑 إدارة اشتراكات VIP', callback_data: 'vip_main' }]
            ]
        }
    };

    try {
        if (messageId) {
            await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', ...keyboard });
        } else {
            await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...keyboard });
        }
    } catch (err) {
        console.error("Error sending menu:", err.message);
    }
}

// معالجة رسالة /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    if (isAdmin(chatId)) {
        await sendMainMenu(chatId);
    } else {
        await bot.sendMessage(chatId, `🎬 **مرحباً بك في StreamFlix!**\nتطبيق المشاهدة الأفضل.\n\n🔗 رابط المنصة: ${config.APP_URL}`, { parse_mode: 'Markdown' });
    }
});

// المحرك الرئيسي للأزرار (Callback Query)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;
    const data = query.data;

    // 1. فك تعليق الزر فوراً (Critical Fix)
    await bot.answerCallbackQuery(query.id).catch(() => {});

    // 2. التحقق من الصلاحية
    if (!isAdmin(chatId)) {
        return bot.sendMessage(chatId, "⚠️ عذراً، هذه اللوحة مخصصة للمطور فقط.");
    }

    try {
        // --- قسم النشر ---
        if (data === 'publish_main') {
            await bot.editMessageText('اختر نوع المحتوى الذي تريد نشره:', {
                chat_id: chatId,
                message_id: msgId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🎬 فيلم عادي', callback_data: 'pub_movie' }, { text: '📺 مسلسل عادي', callback_data: 'pub_series' }],
                        [{ text: '👑 محتوى VIP (فيلم)', callback_data: 'pub_vip' }],
                        [{ text: '🔙 رجوع', callback_data: 'back_to_main' }]
                    ]
                }
            });
        }
        
        else if (data.startsWith('pub_')) {
            const type = data.split('_')[1];
            const isVIP = type === 'vip';
            const category = type === 'series' ? 'series' : 'movie';
            
            userStates.set(chatId, { step: 'waiting_genre', category, isVIP });
            
            const rows = [];
            for (let i = 0; i < GENRES.length; i += 2) {
                rows.push(GENRES.slice(i, i + 2).map(g => ({ text: g, callback_data: `set_genre_${g}` })));
            }
            rows.push([{ text: '🔙 إلغاء', callback_data: 'back_to_main' }]);
            
            await bot.editMessageText(`لقد اخترت نشر ${category === 'series' ? 'مسلسل' : 'فيلم'}${isVIP ? ' VIP' : ''}.\nالآن اختر التصنيف:`, {
                chat_id: chatId,
                message_id: msgId,
                reply_markup: { inline_keyboard: rows }
            });
        }

        else if (data.startsWith('set_genre_')) {
            const genre = data.replace('set_genre_', '');
            const state = userStates.get(chatId);
            if (!state) return sendMainMenu(chatId);

            state.genre = genre;
            state.step = 'waiting_poster';
            userStates.set(chatId, state);

            await bot.editMessageText(`✅ تم اختيار: ${genre}\n📸 **الآن أرسل صورة البوستر (Image):**`, {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: 'Markdown'
            });
        }

        // --- قسم التعديل ---
        else if (data === 'edit_main') {
            userStates.set(chatId, { step: 'waiting_search_query' });
            await bot.editMessageText('🔍 أرسل **اسم المحتوى** أو **الرابط** الذي تريد البحث عنه لتعديله:', {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: [[{ text: '🔙 إلغاء', callback_data: 'back_to_main' }]] }
            });
        }

        // --- قسم VIP ---
        else if (data === 'vip_main') {
            await bot.editMessageText('👑 **إدارة اشتراكات VIP**\nاختر الإجراء المطلوب للمستخدمين:', {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '➕ منح صلاحية VIP', callback_data: 'vip_grant' }],
                        [{ text: '➖ سحب صلاحية VIP', callback_data: 'vip_revoke' }],
                        [{ text: '🔙 رجوع', callback_data: 'back_to_main' }]
                    ]
                }
            });
        }

        else if (data === 'vip_grant' || data === 'vip_revoke') {
            userStates.set(chatId, { step: 'waiting_user_id', action: data === 'vip_grant' ? 'grant' : 'revoke' });
            await bot.editMessageText(`أرسل الآن **اسم المستخدم** (Username) أو **البريد الإلكتروني** للشخص المراد ${data === 'vip_grant' ? 'ترقيته' : 'سحب اشتراكه'}:`, {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: 'Markdown'
            });
        }

        else if (data === 'back_to_main') {
            userStates.delete(chatId);
            await sendMainMenu(chatId, msgId);
        }

    } catch (err) {
        console.error("Callback Error:", err);
        bot.sendMessage(chatId, "❌ حدث خطأ داخلي في المعالجة.");
    }
});

// معالجة الرسائل النصية والصور (Input Handling)
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId) || msg.text?.startsWith('/')) return;

    const state = userStates.get(chatId);
    if (!state) return;

    try {
        // خطوة البوستر
        if (state.step === 'waiting_poster' && msg.photo) {
            state.poster = msg.photo[msg.photo.length - 1].file_id;
            state.step = 'waiting_link';
            userStates.set(chatId, state);
            await bot.sendMessage(chatId, '✅ تم حفظ البوستر.\n📎 الآن أرسل **رابط الفيديو** (Direct Link or YouTube):', { parse_mode: 'Markdown' });
        }
        
        // خطوة الرابط
        else if (state.step === 'waiting_link' && msg.text) {
            state.link = msg.text;
            state.step = 'waiting_title';
            userStates.set(chatId, state);
            await bot.sendMessage(chatId, '✅ تم حفظ الرابط.\n📝 أرسل الآن **عنوان الفيلم/المسلسل**:');
        }

        // خطوة العنوان النهائي والحفظ
        else if (state.step === 'waiting_title' && msg.text) {
            const newContent = new Content({
                title: msg.text,
                link: state.link,
                category: state.category,
                genre: state.genre,
                poster: state.poster,
                isVIP: state.isVIP
            });
            await newContent.save();
            userStates.delete(chatId);
            await bot.sendMessage(chatId, `🚀 **تم النشر بنجاح!**\nالعنوان: ${msg.text}\nالتصنيف: ${state.genre}\nالنوع: ${state.isVIP ? '💎 VIP' : '🆓 مجاني'}`, { parse_mode: 'Markdown' });
            await sendMainMenu(chatId);
        }

        // معالجة البحث للتعديل
        else if (state.step === 'waiting_search_query' && msg.text) {
            const content = await Content.findOne({ $or: [{ title: new RegExp(msg.text, 'i') }, { link: msg.text }] });
            if (!content) return bot.sendMessage(chatId, '❌ لم يتم العثور على هذا المحتوى، جرب اسماً آخر.');
            
            userStates.set(chatId, { step: 'editing', contentId: content._id });
            await bot.sendMessage(chatId, `🔍 وجدنا: **${content.title}**\nماذا تريد أن تفعل؟`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🗑️ حذف المحتوى نهائياً', callback_data: 'confirm_delete' }],
                        [{ text: '🔙 إلغاء', callback_data: 'back_to_main' }]
                    ]
                }
            });
        }

        // معالجة ترقية VIP
        else if (state.step === 'waiting_user_id' && msg.text) {
            const user = await User.findOne({ $or: [{ username: msg.text }, { email: msg.text }] });
            if (!user) return bot.sendMessage(chatId, '❌ لم يتم العثور على مستخدم بهذا الاسم.');

            user.isVIP = state.action === 'grant';
            await user.save();
            userStates.delete(chatId);
            await bot.sendMessage(chatId, `✅ تم تحديث حالة المستخدم **${user.username}** بنجاح.`);
            await sendMainMenu(chatId);
        }

    } catch (err) {
        console.error("Message Processing Error:", err);
        bot.sendMessage(chatId, "❌ خطأ أثناء معالجة البيانات.");
    }
});

module.exports = bot;
