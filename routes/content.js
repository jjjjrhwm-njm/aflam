// routes/content.js
const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const env = require('../config/env');

const bot = new TelegramBot(env.BOT_TOKEN);

// جلب المحتوى العام
router.get('/', async (req, res) => {
    try {
        const movies = await Content.find({ isVIP: false }).sort({ createdAt: -1 });
        res.json({ success: true, data: movies });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// جلب المحتوى VIP
router.get('/vip', async (req, res) => {
    try {
        const vipMovies = await Content.find({ isVIP: true }).sort({ createdAt: -1 });
        res.json({ success: true, data: vipMovies });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// تحويل فيلم من المخزن (تلجرام) إلى بث مباشر للتطبيق
router.get('/stream/:fileId', async (req, res) => {
    try {
        const link = await bot.getFileLink(req.params.fileId);
        res.redirect(link); // يوجه المشغل لرابط الفيديو الخام في تلجرام
    } catch (error) {
        res.status(500).send('Error streaming from storage');
    }
});

// سحب صور البوستر
router.get('/image/:fileId', async (req, res) => {
    try {
        const link = await bot.getFileLink(req.params.fileId);
        const response = await axios({ method: 'GET', url: link, responseType: 'stream' });
        res.setHeader('Content-Type', 'image/jpeg');
        response.data.pipe(res);
    } catch (error) {
        res.status(500).send('Error loading image');
    }
});

module.exports = router;
