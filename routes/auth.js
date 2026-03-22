const express = require('express');
const router = express.Router();
const User = require('../models/User');

// التحقق من حالة المستخدم (VIP أو عادي) باستخدام معرف التلغرام الخاص به
router.post('/check', async (req, res) => {
    const { telegramId } = req.body;
    try {
        const user = await User.findOne({ telegramId: String(telegramId) });
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
        
        // التحقق من انتهاء الاشتراك التلقائي
        const now = new Date();
        let isActuallyVIP = user.isVIP;
        
        if (user.isVIP && user.vipUntil && user.vipUntil < now) {
            user.isVIP = false;
            await user.save();
            isActuallyVIP = false; // انتهى الاشتراك
        }

        res.json({ success: true, isVIP: isActuallyVIP, user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
