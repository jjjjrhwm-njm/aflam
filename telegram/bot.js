const TelegramBot = require('node-telegram-bot-api');
const Content = require('../models/Content');
const User = require('../models/User');
const config = require('../config');

const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });
const userStates = new Map(); // لتخزين خطوات النشر

// قائمة التصنيفات
const GENRES = ['أكشن', 'رعب', 'كوميدي', 'دراما', 'فانتازيا', 'خيال علمي', 'أنمي', 'إثارة'];

// وظيفة مساعدة للتحقق من صلاحية الأدمن
function isAdmin(chatId) {
    return String(chatId).trim() === String(config.ADMIN_ID).trim();
}

// عرض القائمة الرئيسية
async function sendMainMenu(chatId, messageId = null) {
    const text = '🎬 **لوحة تحكم StreamFlix**\nاختر الأمر:';
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📢 نشر محتوى جديد', callback_data: 'publish' }],
                [{ text: '✏️ تعديل أو حذف', callback_data: 'edit' }],
                [{ text: '👑 إدارة VIP', callback_data: 'vip' }],
                [{ text: '❌ إلغاء العملية', callback_data: 'cancel' }]
            ]
        }
    };
    if (messageId) {
        await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            ...keyboard
        });
    } else {
        await bot.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            ...keyboard
        });
    }
}

// بدء التشغيل
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id.toString();
    if (isAdmin(chatId)) {
        await sendMainMenu(chatId);
    } else {
        // ربط المستخدم العادي
        let user = await User.findOne({ telegramId: chatId });
        if (!user) {
            user = new User({
                username: msg.from.username || `user_${chatId}`,
                email: `${chatId}@telegram.user`,
                password: Math.random().toString(36).slice(-8),
                telegramId: chatId
            });
            await user.save();
        }
        await bot.sendMessage(chatId, `🎬 **مرحباً بك في StreamFlix!**\n${config.APP_URL}`, { parse_mode: 'Markdown' });
    }
});

// أمر الإلغاء العام
bot.onText(/\/cancel/, async (msg) => {
    const chatId = msg.chat.id.toString();
    if (!isAdmin(chatId)) return;
    if (userStates.has(chatId)) {
        userStates.delete(chatId);
        await bot.sendMessage(chatId, '❌ تم إلغاء العملية الحالية.');
    } else {
        await bot.sendMessage(chatId, '⚠️ لا توجد عملية نشطة للإلغاء.');
    }
});

// معالجة الضغط على الأزرار (callback_query)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id.toString();
    const data = query.data;
    const msgId = query.message.message_id;

    // الرد الفوري لإزالة التحميل من الزر (يجب أن يكون أول شيء)
    await bot.answerCallbackQuery(query.id);

    // التحقق من الصلاحية
    if (!isAdmin(chatId)) {
        await bot.sendMessage(chatId, '⚠️ غير مصرح لك بهذا الأمر.');
        return;
    }

    // قائمة الأوامر
    if (data === 'publish') {
        await bot.editMessageText('اختر نوع المحتوى:', {
            chat_id: chatId,
            message_id: msgId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🎬 فيلم', callback_data: 'publish_movie' }],
                    [{ text: '📺 مسلسل', callback_data: 'publish_series' }],
                    [{ text: '👑 VIP (فيلم حصري)', callback_data: 'publish_vip' }],
                    [{ text: '🔙 رجوع', callback_data: 'cancel' }]
                ]
            }
        });
    }
    else if (data === 'edit') {
        await bot.editMessageText('🔍 أرسل **اسم** المحتوى أو **رابطه**:', {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'Markdown'
        });
        userStates.set(chatId, { step: 'waiting_content_for_edit' });
    }
    else if (data === 'vip') {
        await bot.editMessageText('اختر الإجراء:', {
            chat_id: chatId,
            message_id: msgId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: '👑 منح VIP', callback_data: 'vip_grant' }],
                    [{ text: '❌ إلغاء VIP', callback_data: 'vip_revoke' }],
                    [{ text: '🔙 رجوع', callback_data: 'cancel' }]
                ]
            }
        });
    }
    else if (data === 'publish_movie' || data === 'publish_series' || data === 'publish_vip') {
        const category = data === 'publish_movie' ? 'movie' : (data === 'publish_series' ? 'series' : 'movie');
        const isVIP = data === 'publish_vip';
        // عرض قائمة التصنيفات
        const buttons = GENRES.map(g => ({ text: g, callback_data: `genre_${category}_${g}_${isVIP}` }));
        const rows = [];
        for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
        rows.push([{ text: '🔙 إلغاء', callback_data: 'cancel' }]);
        await bot.editMessageText('اختر التصنيف:', {
            chat_id: chatId,
            message_id: msgId,
            reply_markup: { inline_keyboard: rows }
        });
    }
    else if (data.startsWith('genre_')) {
        const parts = data.split('_');
        const category = parts[1];
        const genre = parts[2];
        const isVIP = parts[3] === 'true';
        userStates.set(chatId, { step: 'waiting_poster', category, genre, isVIP });
        await bot.editMessageText(`✅ التصنيف: ${genre}\n📸 أرسل صورة البوستر الآن:`, {
            chat_id: chatId,
            message_id: msgId
        });
    }
    else if (data === 'vip_grant' || data === 'vip_revoke') {
        const action = data === 'vip_grant' ? 'grant' : 'revoke';
        userStates.set(chatId, { step: 'waiting_user_for_vip', action });
        await bot.editMessageText('أرسل اسم المستخدم أو البريد الإلكتروني:', {
            chat_id: chatId,
            message_id: msgId
        });
    }
    else if (data === 'cancel') {
        await bot.editMessageText('❌ تم الإلغاء', { chat_id: chatId, message_id: msgId });
        userStates.delete(chatId);
        setTimeout(() => sendMainMenu(chatId), 2000);
    }
    // معالجة تعديل المحتوى
    else if (data === 'edit_link' || data === 'edit_name' || data === 'edit_image' || data === 'edit_delete') {
        const action = data.replace('edit_', '');
        const state = userStates.get(chatId);
        if (!state || !state.contentId) return;
        if (action === 'delete') {
            await Content.findByIdAndDelete(state.contentId);
            await bot.editMessageText('✅ تم الحذف بنجاح!', { chat_id: chatId, message_id: msgId });
            userStates.delete(chatId);
            setTimeout(() => sendMainMenu(chatId), 2000);
        } else {
            userStates.set(chatId, { step: `editing_${action}`, contentId: state.contentId });
            let prompt = '';
            if (action === 'link') prompt = '📎 أرسل الرابط الجديد:';
            if (action === 'name') prompt = '📝 أرسل الاسم الجديد:';
            if (action === 'image') prompt = '🖼️ أرسل الصورة الجديدة:';
            await bot.editMessageText(prompt, { chat_id: chatId, message_id: msgId });
        }
    }
});

// معالجة الرسائل النصية والصور
bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    if (!isAdmin(chatId)) return;

    const state = userStates.get(chatId);
    if (!state) return;

    // نشر محتوى جديد: استلام الصورة
    if (state.step === 'waiting_poster' && msg.photo) {
        const posterFileId = msg.photo[msg.photo.length - 1].file_id;
        state.poster = posterFileId;
        state.step = 'waiting_link';
        userStates.set(chatId, state);
        await bot.sendMessage(chatId, '✅ تم استلام الصورة\n📎 الآن أرسل رابط الفيديو:');
    }
    // رابط الفيديو
    else if (state.step === 'waiting_link' && msg.text) {
        state.link = msg.text;
        state.step = 'waiting_title';
        userStates.set(chatId, state);
        await bot.sendMessage(chatId, '✅ تم استلام الرابط\n📝 الآن أرسل اسم المحتوى:');
    }
    // الاسم
    else if (state.step === 'waiting_title' && msg.text) {
        try {
            const newContent = new Content({
                title: msg.text,
                link: state.link,
                category: state.category,
                genre: state.genre,
                poster: state.poster,
                year: new Date().getFullYear(),
                isVIP: state.isVIP || false
            });
            await newContent.save();
            const vipText = state.isVIP ? ' (VIP)' : '';
            await bot.sendMessage(chatId, `✅ **تم النشر بنجاح!**\n📺 ${msg.text}\n📂 ${state.genre}${vipText}`, { parse_mode: 'Markdown' });
            userStates.delete(chatId);
            await sendMainMenu(chatId);
        } catch (err) {
            console.error(err);
            await bot.sendMessage(chatId, '❌ حدث خطأ أثناء الحفظ');
        }
    }
    // تعديل: البحث عن محتوى
    else if (state.step === 'waiting_content_for_edit' && msg.text) {
        const search = msg.text;
        let content = await Content.findOne({ link: search });
        if (!content) content = await Content.findOne({ title: search });
        if (!content) {
            await bot.sendMessage(chatId, '❌ لم يتم العثور على محتوى');
            userStates.delete(chatId);
            return;
        }
        userStates.set(chatId, { step: 'edit_menu', contentId: content._id });
        await bot.sendMessage(chatId, `✏️ **${content.title}**\nاختر الإجراء:`, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔗 تعديل الرابط', callback_data: 'edit_link' }],
                    [{ text: '📝 تعديل الاسم', callback_data: 'edit_name' }],
                    [{ text: '🖼️ تعديل الصورة', callback_data: 'edit_image' }],
                    [{ text: '🗑️ حذف المحتوى', callback_data: 'edit_delete' }],
                    [{ text: '🔙 إلغاء', callback_data: 'cancel' }]
                ]
            }
        });
    }
    // تعديل الرابط
    else if (state.step === 'editing_link' && msg.text) {
        await Content.findByIdAndUpdate(state.contentId, { link: msg.text });
        await bot.sendMessage(chatId, '✅ تم تحديث الرابط');
        userStates.delete(chatId);
        setTimeout(() => sendMainMenu(chatId), 2000);
    }
    // تعديل الاسم
    else if (state.step === 'editing_name' && msg.text) {
        await Content.findByIdAndUpdate(state.contentId, { title: msg.text });
        await bot.sendMessage(chatId, '✅ تم تحديث الاسم');
        userStates.delete(chatId);
        setTimeout(() => sendMainMenu(chatId), 2000);
    }
    // تعديل الصورة
    else if (state.step === 'editing_image' && msg.photo) {
        const newPoster = msg.photo[msg.photo.length - 1].file_id;
        await Content.findByIdAndUpdate(state.contentId, { poster: newPoster });
        await bot.sendMessage(chatId, '✅ تم تحديث الصورة');
        userStates.delete(chatId);
        setTimeout(() => sendMainMenu(chatId), 2000);
    }
    // إدارة VIP: البحث عن مستخدم
    else if (state.step === 'waiting_user_for_vip' && msg.text) {
        const identifier = msg.text;
        const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] });
        if (!user) {
            await bot.sendMessage(chatId, '❌ لم يتم العثور على مستخدم بهذا الاسم أو البريد');
            userStates.delete(chatId);
            return;
        }
        const newVIPStatus = state.action === 'grant';
        if (user.isVIP === newVIPStatus) {
            await bot.sendMessage(chatId, `ℹ️ المستخدم ${user.username} لديه بالفعل ${newVIPStatus ? 'VIP' : 'لا يوجد VIP'}`);
        } else {
            user.isVIP = newVIPStatus;
            await user.save();
            await bot.sendMessage(chatId, `✅ تم ${newVIPStatus ? 'منح' : 'إلغاء'} صلاحية VIP للمستخدم ${user.username}`);
        }
        userStates.delete(chatId);
        setTimeout(() => sendMainMenu(chatId), 2000);
    }
});

module.exports = bot;
