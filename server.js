/**
 * 🚀 StreamFlix Pro - Advanced Streaming Platform
 * 🎬 Ultimate Backend with Telegram Admin Panel
 * 👑 Developer: Professional Edition v6.0
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
    SESSION_SECRET: process.env.SESSION_SECRET || 'streamflix_super_secret_2024'
};

// Validation des variables critiques
if (!CONFIG.TOKEN || !CONFIG.MONGO_URI || !CONFIG.ADMIN_ID) {
    console.error('❌ [CRITICAL] Missing environment variables!');
    process.exit(1);
}

// ==================== INITIALIZATION ====================
const app = express();
const bot = new TelegramBot(CONFIG.TOKEN, { polling: true });

// Session management for admin panel
const adminSessions = new Map();
const userStates = new Map();
const pendingApprovals = new Map();

// ==================== DATABASE SCHEMAS ====================
// Enhanced Content Schema with rich metadata
const contentSchema = new mongoose.Schema({
    title: { type: String, required: true, index: true },
    titleAr: { type: String, required: true },
    link: { type: String, required: true },
    category: { type: String, enum: ['movie', 'series', 'anime', 'documentary'], required: true },
    genre: { type: String, required: true, index: true },
    subGenre: { type: String, default: '' },
    poster: { type: String, required: true },
    backdrop: { type: String, default: '' },
    year: { type: Number, default: new Date().getFullYear() },
    rating: { type: Number, default: 0, min: 0, max: 10 },
    duration: { type: String, default: '' },
    quality: { type: String, enum: ['HD', 'Full HD', '4K', '8K'], default: 'HD' },
    description: { type: String, default: '' },
    director: { type: String, default: '' },
    cast: [{ type: String }],
    imdbId: { type: String, default: '' },
    views: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    trending: { type: Boolean, default: false },
    releaseDate: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

contentSchema.index({ title: 'text', titleAr: 'text', description: 'text' });
const Content = mongoose.model('Content', contentSchema, 'movies');

// User Schema for favorites and history
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String, default: '' },
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Content' }],
    watchHistory: [{
        contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content' },
        watchedAt: { type: Date, default: Date.now },
        progress: { type: Number, default: 0 }
    }],
    preferences: {
        language: { type: String, default: 'ar' },
        quality: { type: String, default: 'HD' },
        notifications: { type: Boolean, default: true }
    },
    createdAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Announcement Schema
const announcementSchema = new mongoose.Schema({
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['info', 'warning', 'success', 'danger'], default: 'info' },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
});

const Announcement = mongoose.model('Announcement', announcementSchema);

// ==================== DATABASE CONNECTION ====================
mongoose.connect(CONFIG.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
})
.then(() => console.log('✅ [DATABASE] Connected to MongoDB Atlas'))
.catch(err => console.error('❌ [DATABASE] Connection failed:', err.message));

// ==================== EXPRESS MIDDLEWARE ====================
app.use(cors({
    origin: ['http://localhost:3000', CONFIG.APP_URL],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware for admin panel
app.use((req, res, next) => {
    const token = req.headers['x-admin-token'];
    if (token && adminSessions.has(token)) {
        req.admin = adminSessions.get(token);
    }
    next();
});

// ==================== API ENDPOINTS ====================

// Get all content with filtering and pagination
app.get('/api/content', async (req, res) => {
    try {
        const { category, genre, page = 1, limit = 50, search, featured, trending } = req.query;
        const query = {};
        
        if (category) query.category = category;
        if (genre) query.genre = genre;
        if (featured === 'true') query.featured = true;
        if (trending === 'true') query.trending = true;
        if (search) {
            query.$text = { $search: search };
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const data = await Content.find(query)
            .sort({ featured: -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();
        
        const total = await Content.countDocuments(query);
        
        res.json({
            status: 'success',
            data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

// Get single content by ID
app.get('/api/content/:id', async (req, res) => {
    try {
        const content = await Content.findById(req.params.id).lean();
        if (!content) {
            return res.status(404).json({ status: 'error', message: 'Content not found' });
        }
        
        // Increment views
        await Content.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
        
        res.json({ status: 'success', data: content });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

// Get genres by category
app.get('/api/genres/:category', async (req, res) => {
    try {
        const genres = await Content.distinct('genre', { category: req.params.category });
        res.json({ status: 'success', data: genres });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

// Get statistics for admin
app.get('/api/stats', async (req, res) => {
    try {
        const [totalMovies, totalSeries, totalUsers, totalViews, featuredCount] = await Promise.all([
            Content.countDocuments({ category: 'movie' }),
            Content.countDocuments({ category: 'series' }),
            User.countDocuments(),
            Content.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
            Content.countDocuments({ featured: true })
        ]);
        
        res.json({
            status: 'success',
            data: {
                totalMovies,
                totalSeries,
                totalUsers,
                totalViews: totalViews[0]?.total || 0,
                featuredCount
            }
        });
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
        if (!user) {
            user = new User({ userId });
            await user.save();
        }
        
        if (action === 'add') {
            if (!user.favorites.includes(contentId)) {
                user.favorites.push(contentId);
            }
        } else if (action === 'remove') {
            user.favorites = user.favorites.filter(id => id.toString() !== contentId);
        }
        
        await user.save();
        res.json({ status: 'success', favorites: user.favorites });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

// Get user favorites
app.get('/api/user/:userId/favorites', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.params.userId }).populate('favorites');
        res.json({ status: 'success', data: user?.favorites || [] });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

// Get announcements
app.get('/api/announcements', async (req, res) => {
    try {
        const announcements = await Announcement.find({ active: true })
            .where('expiresAt').gt(new Date())
            .sort({ createdAt: -1 })
            .limit(5);
        res.json({ status: 'success', data: announcements });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Server error' });
    }
});

// Image proxy with caching
app.get('/api/image/:fileId', async (req, res) => {
    try {
        const fileLink = await bot.getFileLink(req.params.fileId);
        const cachedPath = path.join(__dirname, 'cache', `${req.params.fileId}.jpg`);
        
        // Check cache
        if (fs.existsSync(cachedPath)) {
            res.sendFile(cachedPath);
            return;
        }
        
        // Download and cache
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

// ==================== TELEGRAM BOT - ADVANCED ADMIN PANEL ====================

// Main menu keyboard
const mainMenuKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '📊 لوحة الإحصائيات', callback_data: 'admin_stats' }],
            [{ text: '🎬 إدارة المحتوى', callback_data: 'admin_content' }],
            [{ text: '👥 إدارة المستخدمين', callback_data: 'admin_users' }],
            [{ text: '📢 إعلان عام', callback_data: 'admin_announce' }],
            [{ text: '⚙️ الإعدادات', callback_data: 'admin_settings' }]
        ]
    }
};

// Content management keyboard
const contentMenuKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: '➕ إضافة فيلم جديد', callback_data: 'content_add_movie' }],
            [{ text: '📺 إضافة مسلسل جديد', callback_data: 'content_add_series' }],
            [{ text: '🎌 إضافة أنمي', callback_data: 'content_add_anime' }],
            [{ text: '✏️ تعديل محتوى', callback_data: 'content_edit' }],
            [{ text: '🗑️ حذف محتوى', callback_data: 'content_delete' }],
            [{ text: '⭐ مميزات الصفحة الرئيسية', callback_data: 'content_featured' }],
            [{ text: '🔙 العودة للقائمة الرئيسية', callback_data: 'back_to_main' }]
        ]
    }
};

// Genre selection keyboard
const genreKeyboard = (category) => {
    const genres = {
        movie: ['أكشن', 'دراما', 'كوميديا', 'رعب', 'خيال علمي', 'مغامرات', 'فنتازيا', 'جريمة', 'رومانسي', 'وثائقي'],
        series: ['دراما', 'كوميديا', 'أكشن', 'جريمة', 'خيال علمي', 'رعب', 'تاريخي', 'عائلي'],
        anime: ['Shonen', 'Shojo', 'Seinen', 'Isekai', 'Slice of Life', 'Mecha', 'Sports', 'Romance']
    };
    
    const buttons = genres[category].map(g => [{ text: g, callback_data: `genre_${g}` }]);
    // Split into rows of 2
    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) {
        rows.push(buttons.slice(i, i + 2));
    }
    rows.push([{ text: '🔙 رجوع', callback_data: 'back_to_content' }]);
    
    return { reply_markup: { inline_keyboard: rows } };
};

// Quality selection keyboard
const qualityKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: 'HD', callback_data: 'quality_HD' }, { text: 'Full HD', callback_data: 'quality_Full HD' }],
            [{ text: '4K', callback_data: 'quality_4K' }, { text: '8K', callback_data: 'quality_8K' }]
        ]
    }
};

// Handle /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id.toString();
    
    if (chatId === CONFIG.ADMIN_ID) {
        await bot.sendMessage(chatId, 
            '🌟 **مرحباً بك في لوحة تحكم StreamFlix Pro** 🌟\n\n' +
            '🎬 أنت الآن مدير المنصة\n' +
            '📊 يمكنك إدارة كل شيء من هنا\n\n' +
            'اختر الإجراء المناسب:',
            { ...mainMenuKeyboard, parse_mode: 'Markdown' }
        );
    } else {
        // Regular user greeting
        await User.findOneAndUpdate(
            { userId: chatId },
            { 
                username: msg.from.username || msg.from.first_name,
                lastActive: new Date()
            },
            { upsert: true }
        );
        
        await bot.sendMessage(chatId,
            '🎬 **مرحباً بك في StreamFlix!** 🎬\n\n' +
            'أفضل منصة لمشاهدة الأفلام والمسلسلات\n' +
            '📱 قم بزيارة الموقع لمشاهدة المحتوى:\n' +
            `${CONFIG.APP_URL}\n\n` +
            '✨ استمتع بتجربة مشاهدة فريدة ✨',
            { parse_mode: 'Markdown' }
        );
    }
});

// Handle callback queries
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id.toString();
    const data = query.data;
    
    if (chatId !== CONFIG.ADMIN_ID) {
        await bot.answerCallbackQuery(query.id, { text: 'غير مصرح لك بهذا الإجراء' });
        return;
    }
    
    try {
        switch(data) {
            case 'admin_stats':
                const stats = await getAdminStats();
                await bot.editMessageText(stats, {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    parse_mode: 'Markdown',
                    ...mainMenuKeyboard
                });
                break;
                
            case 'admin_content':
                await bot.editMessageText('📋 **إدارة المحتوى**\n\nاختر الإجراء المطلوب:', {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    parse_mode: 'Markdown',
                    ...contentMenuKeyboard
                });
                break;
                
            case 'content_add_movie':
                userStates.set(chatId, { step: 'WAIT_MOVIE_POSTER', type: 'movie' });
                await bot.editMessageText('🎬 **إضافة فيلم جديد**\n\n' +
                    'الرجاء إرسال:\n' +
                    '1️⃣ صورة البوستر (مع الوصف)\n' +
                    '2️⃣ رابط الفيلم\n' +
                    '3️⃣ اسم الفيلم\n' +
                    '4️⃣ السنة\n' +
                    '5️⃣ المدة\n\n' +
                    '📝 مثال للوصف:\n' +
                    'رابط الفيلم\n' +
                    'اسم الفيلم\n' +
                    '2024\n' +
                    '120 دقيقة\n' +
                    'وصف الفيلم...', {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    parse_mode: 'Markdown'
                });
                break;
                
            case 'back_to_main':
                await bot.editMessageText('🌟 **القائمة الرئيسية** 🌟\n\nاختر الإجراء:', {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    parse_mode: 'Markdown',
                    ...mainMenuKeyboard
                });
                break;
                
            case 'back_to_content':
                await bot.editMessageText('📋 **إدارة المحتوى**\n\nاختر الإجراء:', {
                    chat_id: chatId,
                    message_id: query.message.message_id,
                    parse_mode: 'Markdown',
                    ...contentMenuKeyboard
                });
                break;
                
            default:
                if (data.startsWith('genre_')) {
                    const genre = data.replace('genre_', '');
                    const state = userStates.get(chatId);
                    if (state && state.step === 'WAIT_GENRE') {
                        state.genre = genre;
                        state.step = 'WAIT_QUALITY';
                        userStates.set(chatId, state);
                        await bot.editMessageText(`✅ تم اختيار التصنيف: ${genre}\n\nالآن اختر جودة الفيديو:`, {
                            chat_id: chatId,
                            message_id: query.message.message_id,
                            ...qualityKeyboard
                        });
                    }
                } else if (data.startsWith('quality_')) {
                    const quality = data.replace('quality_', '');
                    const state = userStates.get(chatId);
                    if (state) {
                        state.quality = quality;
                        state.step = 'WAIT_CONTENT_DATA';
                        userStates.set(chatId, state);
                        await bot.editMessageText(`✅ تم اختيار الجودة: ${quality}\n\nالآن أرسل:\n📸 صورة البوستر (مع الوصف الكامل)\n\n📝 الوصف يجب أن يحتوي:\nالرابط\nالاسم بالعربي\nالاسم الأصلي\nالسنة\nالمدة\nالوصف\nالمخرج\nالممثلين (مفصولين بفاصلة)`, {
                            chat_id: chatId,
                            message_id: query.message.message_id
                        });
                    }
                }
                break;
        }
    } catch (error) {
        console.error('Callback error:', error);
        await bot.sendMessage(chatId, '❌ حدث خطأ، حاول مرة أخرى');
    }
    
    await bot.answerCallbackQuery(query.id);
});

// Handle media messages with caption
bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    if (chatId !== CONFIG.ADMIN_ID) return;
    
    const state = userStates.get(chatId);
    if (!state) return;
    
    // Handle poster image with caption
    if (state.step === 'WAIT_CONTENT_DATA' && msg.photo) {
        const caption = msg.caption?.split('\n').map(l => l.trim()) || [];
        
        if (caption.length < 8) {
            await bot.sendMessage(chatId, '⚠️ الوصف غير مكتمل! يجب أن يحتوي:\n' +
                'الرابط\nالاسم بالعربي\nالاسم الأصلي\nالسنة\nالمدة\nالوصف\nالمخرج\nالممثلين');
            return;
        }
        
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        
        try {
            const newContent = new Content({
                link: caption[0],
                titleAr: caption[1],
                title: caption[2],
                year: parseInt(caption[3]) || 2024,
                duration: caption[4],
                description: caption[5],
                director: caption[6],
                cast: caption[7]?.split(',').map(c => c.trim()) || [],
                category: state.type,
                genre: state.genre,
                quality: state.quality,
                poster: fileId,
                rating: 0,
                views: 0
            });
            
            await newContent.save();
            
            await bot.sendMessage(chatId,
                `✅ **تمت الإضافة بنجاح!**\n\n` +
                `🎬 الاسم: ${newContent.titleAr}\n` +
                `📂 التصنيف: ${state.type} - ${state.genre}\n` +
                `📀 الجودة: ${state.quality}\n` +
                `📅 السنة: ${newContent.year}\n` +
                `⏱️ المدة: ${newContent.duration}\n\n` +
                `🌟 تمت الإضافة إلى قاعدة البيانات`,
                { parse_mode: 'Markdown', ...contentMenuKeyboard }
            );
            
            userStates.delete(chatId);
        } catch (error) {
            console.error('Save error:', error);
            await bot.sendMessage(chatId, '❌ فشل حفظ البيانات، تأكد من صحة الإدخالات');
        }
    }
});

// Helper function to get admin statistics
async function getAdminStats() {
    const [totalMovies, totalSeries, totalAnime, totalUsers, totalViews, featuredCount] = await Promise.all([
        Content.countDocuments({ category: 'movie' }),
        Content.countDocuments({ category: 'series' }),
        Content.countDocuments({ category: 'anime' }),
        User.countDocuments(),
        Content.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
        Content.countDocuments({ featured: true })
    ]);
    
    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5);
    const topMovies = await Content.find().sort({ views: -1 }).limit(5);
    
    return `📊 **إحصائيات StreamFlix Pro** 📊\n\n` +
        `🎬 **المحتوى:**\n` +
        `├ 🍿 أفلام: ${totalMovies}\n` +
        `├ 📺 مسلسلات: ${totalSeries}\n` +
        `├ 🎌 أنمي: ${totalAnime}\n` +
        `└ ⭐ مميز: ${featuredCount}\n\n` +
        `👥 **المستخدمين:**\n` +
        `├ إجمالي: ${totalUsers}\n` +
        `├ آخر 5 مسجلين:\n` +
        recentUsers.map(u => `│  └ ${u.username || u.userId}`).join('\n') + `\n\n` +
        `📈 **المشاهدات:**\n` +
        `├ إجمالي: ${totalViews[0]?.total || 0}\n` +
        `├ الأعلى مشاهدة:\n` +
        topMovies.map(m => `│  └ ${m.titleAr} (${m.views} 👁️)`).join('\n') + `\n\n` +
        `🔄 **آخر تحديث:** ${new Date().toLocaleString('ar')}`;
}

// Keep server alive
setInterval(async () => {
    try {
        await https.get(CONFIG.APP_URL);
    } catch (e) {}
}, 300000);

// Start server
app.listen(CONFIG.PORT, () => {
    console.log(`🚀 [SERVER] StreamFlix Pro running on port ${CONFIG.PORT}`);
    console.log(`🤖 [BOT] Telegram bot is active`);
    console.log(`📱 [URL] ${CONFIG.APP_URL}`);
});

module.exports = { app, bot, Content, User };
