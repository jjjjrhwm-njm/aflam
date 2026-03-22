const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

// تسجيل مستخدم جديد
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Username or email already exists' });
        }
        const user = new User({ username, email, password });
        await user.save();
        const token = generateToken(user);
        res.json({ success: true, token, user: { id: user._id, username: user.username, isVIP: user.isVIP } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// تسجيل الدخول
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        const token = generateToken(user);
        res.json({ success: true, token, user: { id: user._id, username: user.username, isVIP: user.isVIP } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
