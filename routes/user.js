const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// جلب المفضلة
router.get('/favorites', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('favorites');
        res.json({ success: true, data: user.favorites });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// إضافة/إزالة من المفضلة
router.post('/favorites', authMiddleware, async (req, res) => {
    try {
        const { contentId, action } = req.body;
        const user = await User.findById(req.user.id);
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

module.exports = router;
