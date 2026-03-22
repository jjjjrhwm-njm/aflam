const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const https = require('https');
require('dotenv').config();

// ==================== CONFIG ====================
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const APP_URL = process.env.APP_URL || `https://your-app.onrender.com`;

// Check required
if (!MONGO_URI) {
    console.error('❌ MONGO_URI is required');
    process.exit(1);
}

console.log('✅ Server starting...');
console.log(`📦 PORT: ${PORT}`);
console.log(`🔗 MONGO_URI: ${MONGO_URI ? '✓ Set' : '✗ Missing'}`);
console.log(`🤖 BOT_TOKEN: ${BOT_TOKEN ? '✓ Set' : '✗ Missing'}`);
console.log(`👑 ADMIN_ID: ${ADMIN_ID ? '✓ Set' : '✗ Missing'}`);

// ==================== INIT ====================
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== DATABASE ====================
const contentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    link: { type: String, required: true },
    category: { type: String, enum: ['movie', 'series'], required: true },
    genre: { type: String, required: true },
    poster: { type: String, required: true },
    year: { type: Number, default: 2024 },
    views: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const Content = mongoose.model('Content', contentSchema);

const userSchema = new mongoose.Schema({
    userId: { type: String, unique: true },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Content' }]
});
const User = mongoose.model('User', userSchema);

// Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Error:', err.message));

// ==================== API ROUTES ====================

// Get all content
app.get('/api/content', async (req, res) => {
    try {
        const { category, genre } = req.query;
        let filter = {};
        if (category && category !== 'all') filter.category = category;
        if (genre && genre !== 'all') filter.genre = genre;
        
        const data = await Content.find(filter).sort({ createdAt: -1 }).limit(100);
        res.json({ success: true, data });
    } catch (err) {
        console.error('API Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get single content
app.get('/api/content/:id', async (req, res) => {
    try {
        const content = await Content.findById(req.params.id);
        if (!content) return res.status(404).json({ success: false });
        await Content.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
        res.json({ success: true, data: content });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Get user favorites
app.get('/api/user/:userId/favorites', async (req, res) => {
    try {
        let user = await User.findOne({ userId: req.params.userId }).populate('favorites');
        if (!user) user = { favorites: [] };
        res.json({ success: true, data: user.favorites });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Toggle favorite
app.post('/api/user/:userId/favorites', async (req, res) => {
    try {
        const { contentId, action } = req.body;
        let user = await User.findOne({ userId: req.params.userId });
        if (!user) user = new User({ userId: req.params.userId });
        
        if (action === 'add') {
            if (!user.favorites.includes(contentId)) user.favorites.push(contentId);
        } else {
            user.favorites = user.favorites.filter(id => id.toString() !== contentId);
        }
        await user.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Image proxy
app.get('/api/image/:fileId', async (req, res) => {
    try {
        if (!BOT_TOKEN) return res.status(404).end();
        const bot = new TelegramBot(BOT_TOKEN);
        const fileLink = await bot.getFileLink(req.params.fileId);
        https.get(fileLink, (response) => {
            res.setHeader('Content-Type', response.headers['content-type']);
            response.pipe(res);
        }).on('error', () => res.status(404).end());
    } catch (err) {
        res.status(404).end();
    }
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== TELEGRAM BOT ====================
if (BOT_TOKEN && ADMIN_ID) {
    const bot = new TelegramBot(BOT_TOKEN, { polling: true });
    const adminStates = new Map();

    // Start command
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id.toString();
        if (chatId === ADMIN_ID) {
            await bot.sendMessage(chatId, '🎬 **مرحباً مدير StreamFlix**', {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📢 نشر محتوى جديد', callback_data: 'publish' }],
                        [{ text: '✏️ تعديل أو حذف', callback_data: 'edit' }]
                    ]
                }
            });
        } else {
            await bot.sendMessage(chatId, `🎬 **StreamFlix**\nمنصة المشاهدة\n${APP_URL}`, { parse_mode: 'Markdown' });
        }
    });

    // Handle callbacks
    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id.toString();
        if (chatId !== ADMIN_ID) return;
        const data = query.data;
        const msgId = query.message.message_id;

        // PUBLISH FLOW
        if (data === 'publish') {
            await bot.editMessageText('اختر نوع المحتوى:', {
                chat_id: chatId,
                message_id: msgId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🎬 فيلم', callback_data: 'publish_movie' }],
                        [{ text: '📺 مسلسل', callback_data: 'publish_series' }],
                        [{ text: '🔙 رجوع', callback_data: 'menu' }]
                    ]
                }
            });
        }
        else if (data === 'publish_movie' || data === 'publish_series') {
            const category = data === 'publish_movie' ? 'movie' : 'series';
            const genres = ['أكشن', 'رعب', 'كوميدي', 'دراما', 'فانتازيا', 'خيال علمي', 'أنمي', 'إثارة'];
            const buttons = genres.map(g => [{ text: g, callback_data: `genre_${category}_${g}` }]);
            const rows = [];
            for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
            rows.push([{ text: '🔙 رجوع', callback_data: 'publish' }]);
            
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
            adminStates.set(chatId, { step: 'waiting_poster', category, genre });
            await bot.editMessageText(`✅ التصنيف: ${genre}\n📸 أرسل صورة البوستر الآن:`, {
                chat_id: chatId,
                message_id: msgId
            });
        }

        // EDIT FLOW
        else if (data === 'edit') {
            await bot.editMessageText('🔍 أرسل **اسم** المحتوى أو **رابطه**:', {
                chat_id: chatId,
                message_id: msgId,
                parse_mode: 'Markdown'
            });
            adminStates.set(chatId, { step: 'waiting_content' });
        }
        else if (data.startsWith('edit_')) {
            const action = data.replace('edit_', '');
            const state = adminStates.get(chatId);
            if (!state || !state.contentId) return;
            
            if (action === 'delete') {
                await Content.findByIdAndDelete(state.contentId);
                await bot.editMessageText('✅ تم الحذف بنجاح!', {
                    chat_id: chatId,
                    message_id: msgId
                });
                adminStates.delete(chatId);
                setTimeout(() => {
                    bot.sendMessage(chatId, '🎬 القائمة الرئيسية', {
                        reply_markup: {
                            inline_keyboard: [[{ text: '📢 نشر', callback_data: 'publish' }, { text: '✏️ تعديل', callback_data: 'edit' }]]
                        }
                    });
                }, 2000);
            } else {
                adminStates.set(chatId, { ...state, step: `editing_${action}` });
                let prompt = '';
                if (action === 'link') prompt = '📎 أرسل الرابط الجديد:';
                if (action === 'name') prompt = '📝 أرسل الاسم الجديد:';
                if (action === 'image') prompt = '🖼️ أرسل الصورة الجديدة:';
                await bot.editMessageText(prompt, { chat_id: chatId, message_id: msgId });
            }
        }
        else if (data === 'menu') {
            await bot.editMessageText('🎬 القائمة الرئيسية', {
                chat_id: chatId,
                message_id: msgId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📢 نشر محتوى جديد', callback_data: 'publish' }],
                        [{ text: '✏️ تعديل أو حذف', callback_data: 'edit' }]
                    ]
                }
            });
        }

        await bot.answerCallbackQuery(query.id);
    });

    // Handle messages
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id.toString();
        if (chatId !== ADMIN_ID) return;
        const state = adminStates.get(chatId);
        if (!state) return;

        // PUBLISH: Waiting for poster
        if (state.step === 'waiting_poster' && msg.photo) {
            state.poster = msg.photo[msg.photo.length - 1].file_id;
            state.step = 'waiting_link';
            adminStates.set(chatId, state);
            await bot.sendMessage(chatId, '✅ تم استلام الصورة\n📎 الآن أرسل رابط الفيديو:');
        }
        // PUBLISH: Waiting for link
        else if (state.step === 'waiting_link' && msg.text) {
            state.link = msg.text;
            state.step = 'waiting_title';
            adminStates.set(chatId, state);
            await bot.sendMessage(chatId, '✅ تم استلام الرابط\n📝 الآن أرسل اسم المحتوى:');
        }
        // PUBLISH: Waiting for title
        else if (state.step === 'waiting_title' && msg.text) {
            try {
                const newContent = new Content({
                    title: msg.text,
                    link: state.link,
                    category: state.category,
                    genre: state.genre,
                    poster: state.poster,
                    year: new Date().getFullYear()
                });
                await newContent.save();
                await bot.sendMessage(chatId, `✅ **تم النشر بنجاح!**\n📺 ${msg.text}\n📂 ${state.genre}`, { parse_mode: 'Markdown' });
                adminStates.delete(chatId);
                await bot.sendMessage(chatId, '🎬 القائمة الرئيسية', {
                    reply_markup: {
                        inline_keyboard: [[{ text: '📢 نشر', callback_data: 'publish' }, { text: '✏️ تعديل', callback_data: 'edit' }]]
                    }
                });
            } catch (err) {
                await bot.sendMessage(chatId, '❌ حدث خطأ أثناء الحفظ');
            }
        }
        
        // EDIT: Search for content
        else if (state.step === 'waiting_content' && msg.text) {
            const search = msg.text;
            let content = await Content.findOne({ link: search });
            if (!content) content = await Content.findOne({ title: search });
            
            if (!content) {
                await bot.sendMessage(chatId, '❌ لم يتم العثور على محتوى');
                adminStates.delete(chatId);
                return;
            }
            
            adminStates.set(chatId, { step: 'edit_menu', contentId: content._id });
            await bot.sendMessage(chatId, `✏️ **${content.title}**\nاختر الإجراء:`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔗 تعديل الرابط', callback_data: 'edit_link' }],
                        [{ text: '📝 تعديل الاسم', callback_data: 'edit_name' }],
                        [{ text: '🖼️ تعديل الصورة', callback_data: 'edit_image' }],
                        [{ text: '🗑️ حذف المحتوى', callback_data: 'edit_delete' }],
                        [{ text: '🔙 إلغاء', callback_data: 'menu' }]
                    ]
                }
            });
        }
        
        // EDIT: Update link
        else if (state.step === 'editing_link' && msg.text) {
            await Content.findByIdAndUpdate(state.contentId, { link: msg.text });
            await bot.sendMessage(chatId, '✅ تم تحديث الرابط');
            adminStates.delete(chatId);
        }
        // EDIT: Update name
        else if (state.step === 'editing_name' && msg.text) {
            await Content.findByIdAndUpdate(state.contentId, { title: msg.text });
            await bot.sendMessage(chatId, '✅ تم تحديث الاسم');
            adminStates.delete(chatId);
        }
        // EDIT: Update image
        else if (state.step === 'editing_image' && msg.photo) {
            const newPoster = msg.photo[msg.photo.length - 1].file_id;
            await Content.findByIdAndUpdate(state.contentId, { poster: newPoster });
            await bot.sendMessage(chatId, '✅ تم تحديث الصورة');
            adminStates.delete(chatId);
        }
    });

    console.log('🤖 Telegram Bot Active');
}

// ==================== START SERVER ====================
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
