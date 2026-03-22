const express = require('express');
const router = express.Router();
const Content = require('../models/Content');
const authMiddleware = require('../middleware/auth');

// جلب المحتوى العام (غير VIP)
router.get('/', async (req, res) => {
    try {
        const { category, genre } = req.query;
        let filter = { isVIP: false };
        if (category && category !== 'all') filter.category = category;
        if (genre && genre !== 'all') filter.genre = genre;
        const data = await Content.find(filter).sort({ createdAt: -1 }).limit(100);
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// جلب المحتوى الحصري VIP (يتطلب تسجيل دخول وصلاحية VIP)
router.get('/vip', authMiddleware, async (req, res) => {
    try {
        if (!req.user.isVIP) {
            return res.status(403).json({ success: false, message: 'VIP subscription required' });
        }
        const { category, genre } = req.query;
        let filter = { isVIP: true };
        if (category && category !== 'all') filter.category = category;
        if (genre && genre !== 'all') filter.genre = genre;
        const data = await Content.find(filter).sort({ createdAt: -1 }).limit(100);
        res.json({ success: true, data });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// جلب محتوى فردي (عام أو VIP)
router.get('/:id', async (req, res) => {
    try {
        const content = await Content.findById(req.params.id);
        if (!content) return res.status(404).json({ success: false });
        // إذا كان المحتوى VIP ولم يكن المستخدم مسجلاً أو غير VIP، نمنع الوصول
        if (content.isVIP) {
            const token = req.headers.authorization?.split(' ')[1];
            if (!token) return res.status(401).json({ success: false, message: 'VIP content requires login' });
            try {
                const decoded = require('jsonwebtoken').verify(token, require('../config').JWT_SECRET);
                if (!decoded.isVIP) return res.status(403).json({ success: false, message: 'VIP subscription required' });
            } catch (err) {
                return res.status(401).json({ success: false, message: 'Invalid token' });
            }
        }
        await Content.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
        res.json({ success: true, data: content });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

module.exports = router;
