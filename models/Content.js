const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    link: { type: String, required: true },
    category: { type: String, enum: ['movie', 'series'], required: true },
    genre: { type: String, required: true },
    poster: { type: String, required: true },
    year: { type: Number, default: 2024 },
    views: { type: Number, default: 0 },
    isVIP: { type: Boolean, default: false }, // ✅ المحتوى الحصري VIP
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Content', contentSchema);
