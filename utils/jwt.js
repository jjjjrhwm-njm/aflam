const jwt = require('jsonwebtoken');
const config = require('../config');

exports.generateToken = (user) => {
    return jwt.sign(
        { id: user._id, username: user.username, isVIP: user.isVIP },
        config.JWT_SECRET,
        { expiresIn: '7d' }
    );
};
