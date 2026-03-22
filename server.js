/**
 * 🚀 StreamFlix Pro - Netflix Style Backend
 * 🎬 Simplified Telegram Admin Panel
 */

const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const fs = require('fs');

// ==================== CONFIGURATION ====================
const CONFIG = {
    TOKEN: process.env.BOT_TOKEN,
    MONGO_URI: process.env.MONGO_URI,
    ADMIN_ID: process.env.ADMIN_ID,
    APP_URL: process.env.APP_URL || 'https://streamflix.onrender.com',
    PORT: process.env.PORT || 10000,
};

// Validation
if (!CONFIG.TOKEN || !CONFIG.MONGO_URI || !CONFIG.ADMIN_ID) {
    console.error('❌ [CRITICAL] Missing environment variables!');
    process.exit(1);
}

// ==================== INITIALIZATION ====================
const app = express();
const bot = new TelegramBot(CONFIG.TOKEN, { polling: true });
const userStates = new Map(); // To track admin steps

// ==================== DATABASE SCHEMAS ====================
const contentSchema = new mongoose.Schema({
    title: { type: String, required: true, index: true }, // English title
    titleAr: { type: String, required: true }, // Arabic title
    link: { type: String, required: true }, // Video link
    category: { type: String, enum: ['movie', 'series'], required: true }, // 'movie' or 'series'
    genre: { type: String, required: true, index: true }, // e.g., 'أكشن', 'رعب', etc.
    poster: { type: String, required: true }, // Telegram file ID of the poster
    year: { type: Number, default: new Date().getFullYear() },
    duration: { type: String, default: '' }, // e.g., '120 دقيقة'
    description: { type: String, default: '' },
    views: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
});

contentSchema.index({ title: 'text', titleAr: 'text' });
const Content = mongoose.model('Content', contentSchema, 'movies');

// User Schema for favorites
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, default: '' },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Content' }],
    lastActive: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// ==================== DATABASE CONNECTION ====================
mongoose.connect(CONFIG.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ [DATABASE] Connected to MongoDB Atlas'))
.catch(err => console.error('❌ [DATABASE] Connection failed:', err.message));

// ==================== EXPRESS MIDDLEWARE ====================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==================== API ENDPOINTS ====================

// Get all content for the main page
app.get('/api/content', async (req, res) => {
    try {
        const { genre, search } = req.query;
        let query = {};
        if (genre && genre !== 'all') query.genre = genre;
        if (search) query.$text = { $search: search };

        const data = await Content.find(query)
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
        
        res.json({ status: 'success', data });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

// Get a single content by ID
app.get('/api/content/:id', async (req, res) => {
    try {
        const content = await Content.findById(req.params.id).lean();
        if (!content) return res.status(404).json({ status: 'error', message: 'Not found' });
        await Content.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
        res.json({ status: 'success', data: content });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

// User favorites management
app.post('/api/user/:userId/favorites', async (req, res) => {
    try {
        const { userId } = req.params;
        const { contentId, action } = req.body;
        let user = await User.findOne({ userId });
        if (!user) user = new User({ userId });

        if (action === 'add') {
            if (!user.favorites.includes(contentId)) user.favorites.push(contentId);
        } else if (action === 'remove') {
            user.favorites = user.favorites.filter(id => id.toString() !== contentId);
        }
        await user.save();
        res.json({ status: 'success', favorites: user.favorites });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

app.get('/api/user/:userId/favorites', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.params.userId }).populate('favorites');
        res.json({ status: 'success', data: user?.favorites || [] });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

// Image proxy
app.get('/api/image/:fileId', async (req, res) => {
    try {
        const fileLink = await bot.getFileLink(req.params.fileId);
        const cachedPath = path.join(__dirname, 'cache', `${req.params.fileId}.jpg`);
        
        if (fs.existsSync(cachedPath)) {
            res.sendFile(cachedPath);
            return;
        }
        
        https.get(fileLink, (response) => {
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                fs.mkdirSync(path.join(__dirname, 'cache'), { recursive: true });
                fs.writeFileSync(cachedPath, buffer);
                res.setHeader('Content-Type', response.headers['content-type']);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.send(buffer);
            });
        }).on('error', () => res.status(500).end());
    } catch (error) {
        res.status(500).end();
    }
});

// ==================== TELEGRAM BOT - SIMPLIFIED ====================

// Helper to send main admin menu
async function sendAdminMenu(chatId, messageId = null) {
    const text = '🎬 **لوحة تحكم StreamFlix**\nاختر الأمر:';
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📢 نشر محتوى جديد', callback_data: 'publish_menu' }],
                [{ text: '✏️ تعديل أو حذف محتوى', callback_data: 'edit_menu' }]
            ]
        }
    };
    if (messageId) {
        await bot.editMessageText(text, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', ...keyboard });
    } else {
        await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...keyboard });
    }
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id.toString();
    if (chatId === CONFIG.ADMIN_ID) {
        await sendAdminMenu(chatId);
    } else {
        await User.findOneAndUpdate({ userId: chatId }, { username: msg.from.username || msg.from.first_name, lastActive: new Date() }, { upsert: true });
        await bot.sendMessage(chatId, `🎬 **مرحباً بك في StreamFlix!**\nأفضل منصة للمشاهدة\n${CONFIG.APP_URL}`, { parse_mode: 'Markdown' });
    }
});

// Handle all callback queries
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id.toString();
    const data = query.data;
    const messageId = query.message.message_id;

    if (chatId !== CONFIG.ADMIN_ID) {
        await bot.answerCallbackQuery(query.id, { text: 'غير مصرح' });
        return;
    }

    try {
        // Main publish flow
        if (data === 'publish_menu') {
            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🎬 أفلام', callback_data: 'publish_movie' }],
                        [{ text: '📺 مسلسلات', callback_data: 'publish_series' }],
                        [{ text: '🔙 رجوع', callback_data: 'main_menu' }]
                    ]
                }
            };
            await bot.editMessageText('اختر نوع المحتوى:', { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', ...keyboard });
        }
        else if (data === 'publish_movie' || data === 'publish_series') {
            const category = data === 'publish_movie' ? 'movie' : 'series';
            // Genre selection keyboard
            const genres = ['أكشن', 'رعب', 'كوميدي', 'دراما', 'فانتازيا', 'خيال علمي', 'أنمي', 'إثارة'];
            const genreButtons = genres.map(g => [{ text: g, callback_data: `select_genre_${category}_${g}` }]);
            // Split into rows of 2
            const rows = [];
            for (let i = 0; i < genreButtons.length; i += 2) rows.push(genreButtons.slice(i, i + 2));
            rows.push([{ text: '🔙 رجوع', callback_data: 'publish_menu' }]);
            
            await bot.editMessageText('اختر التصنيف:', { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: { inline_keyboard: rows } });
        }
        else if (data.startsWith('select_genre_')) {
            const parts = data.split('_'); // select_genre_movie_أكشن
            const category = parts[2];
            const genre = parts[3];
            
            userStates.set(chatId, { step: 'waiting_poster', category, genre });
            await bot.editMessageText(`✅ تم اختيار: ${genre}\n📸 الآن أرسل صورة البوستر:`, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' });
        }
        
        // Edit flow
        else if (data === 'edit_menu') {
            await bot.editMessageText('🔍 أرسل **الاسم** أو **رابط الفيديو** للمحتوى الذي تريد تعديله:', { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' });
            userStates.set(chatId, { step: 'waiting_content_for_edit' });
        }
        else if (data === 'main_menu') {
            await sendAdminMenu(chatId, messageId);
        }
        // Edit actions
        else if (data.startsWith('edit_action_')) {
            const action = data.replace('edit_action_', ''); // 'link', 'name', 'image', 'delete'
            const contentId = userStates.get(chatId)?.contentId;
            if (!contentId) throw new Error('No content selected');
            
            if (action === 'delete') {
                await Content.findByIdAndDelete(contentId);
                await bot.editMessageText(`✅ تم حذف المحتوى بنجاح!`, { chat_id: chatId, message_id: messageId });
                userStates.delete(chatId);
                setTimeout(() => sendAdminMenu(chatId), 2000);
            } else {
                userStates.set(chatId, { step: `editing_${action}`, contentId });
                let prompt = '';
                if (action === 'link') prompt = '📎 أرسل الرابط الجديد:';
                if (action === 'name') prompt = '📝 أرسل الاسم الجديد (بالعربية):';
                if (action === 'image') prompt = '🖼️ أرسل الصورة الجديدة:';
                await bot.editMessageText(prompt, { chat_id: chatId, message_id: messageId });
            }
        }
    } catch (error) {
        console.error('Callback error:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ.');
    }
    await bot.answerCallbackQuery(query.id);
});

// Handle messages for publishing and editing
bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    if (chatId !== CONFIG.ADMIN_ID) return;
    
    const state = userStates.get(chatId);
    if (!state) return;

    // Publishing: Waiting for poster image
    if (state.step === 'waiting_poster' && msg.photo) {
        const posterFileId = msg.photo[msg.photo.length - 1].file_id;
        state.poster = posterFileId;
        state.step = 'waiting_link';
        userStates.set(chatId, state);
        await bot.sendMessage(chatId, '✅ تم استلام الصورة.\n📎 الآن أرسل رابط الفيديو:');
    }
    // Publishing: Waiting for video link
    else if (state.step === 'waiting_link' && msg.text) {
        state.link = msg.text;
        state.step = 'waiting_title';
        userStates.set(chatId, state);
        await bot.sendMessage(chatId, '✅ تم استلام الرابط.\n📝 الآن أرسل اسم المحتوى (بالعربية):');
    }
    // Publishing: Waiting for title
    else if (state.step === 'waiting_title' && msg.text) {
        const titleAr = msg.text;
        try {
            const newContent = new Content({
                title: titleAr, // Use Arabic as main for simplicity
                titleAr: titleAr,
                link: state.link,
                category: state.category,
                genre: state.genre,
                poster: state.poster,
                year: new Date().getFullYear(),
                duration: '',
                description: ''
            });
            await newContent.save();
            await bot.sendMessage(chatId, `✅ **تم النشر بنجاح!**\n📺 ${titleAr}\n📂 التصنيف: ${state.genre}\n🔗 الرابط: ${state.link}`, { parse_mode: 'Markdown' });
            userStates.delete(chatId);
            await sendAdminMenu(chatId);
        } catch (error) {
            console.error(error);
            await bot.sendMessage(chatId, '❌ فشل الحفظ. تأكد من البيانات.');
        }
    }
    
    // Editing: Searching for content
    else if (state.step === 'waiting_content_for_edit' && msg.text) {
        const searchTerm = msg.text;
        let content = await Content.findOne({ link: searchTerm });
        if (!content) content = await Content.findOne({ titleAr: searchTerm });
        if (!content) content = await Content.findOne({ title: searchTerm });
        
        if (!content) {
            await bot.sendMessage(chatId, '❌ لم يتم العثور على محتوى بهذا الاسم أو الرابط.');
            userStates.delete(chatId);
            setTimeout(() => sendAdminMenu(chatId), 2000);
            return;
        }
        
        state.contentId = content._id;
        userStates.set(chatId, state);
        
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔗 تعديل الرابط', callback_data: 'edit_action_link' }],
                    [{ text: '📝 تعديل الاسم', callback_data: 'edit_action_name' }],
                    [{ text: '🖼️ تعديل الصورة', callback_data: 'edit_action_image' }],
                    [{ text: '🗑️ حذف المحتوى', callback_data: 'edit_action_delete' }],
                    [{ text: '🔙 إلغاء', callback_data: 'main_menu' }]
                ]
            }
        };
        await bot.sendMessage(chatId, `✏️ **تعديل المحتوى:**\n${content.titleAr}\n\nاختر الإجراء:`, { parse_mode: 'Markdown', ...keyboard });
    }
    // Editing: Updating link
    else if (state.step === 'editing_link' && msg.text) {
        await Content.findByIdAndUpdate(state.contentId, { link: msg.text });
        await bot.sendMessage(chatId, '✅ تم تحديث الرابط بنجاح!');
        userStates.delete(chatId);
        setTimeout(() => sendAdminMenu(chatId), 2000);
    }
    // Editing: Updating name
    else if (state.step === 'editing_name' && msg.text) {
        await Content.findByIdAndUpdate(state.contentId, { titleAr: msg.text, title: msg.text });
        await bot.sendMessage(chatId, '✅ تم تحديث الاسم بنجاح!');
        userStates.delete(chatId);
        setTimeout(() => sendAdminMenu(chatId), 2000);
    }
    // Editing: Updating image
    else if (state.step === 'editing_image' && msg.photo) {
        const newPoster = msg.photo[msg.photo.length - 1].file_id;
        await Content.findByIdAndUpdate(state.contentId, { poster: newPoster });
        await bot.sendMessage(chatId, '✅ تم تحديث الصورة بنجاح!');
        userStates.delete(chatId);
        setTimeout(() => sendAdminMenu(chatId), 2000);
    }
});

// Keep server alive
setInterval(async () => {
    try {
        await https.get(CONFIG.APP_URL);
    } catch (e) {}
}, 300000);

app.listen(CONFIG.PORT, () => {
    console.log(`🚀 [SERVER] StreamFlix Pro running on port ${CONFIG.PORT}`);
    console.log(`🤖 [BOT] Telegram bot is active`);
});

module.exports = { app, bot, Content };
