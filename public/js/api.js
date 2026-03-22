const API = {
    // التحقق من حالة اشتراك المستخدم عبر التلغرام
    async checkUserStatus(telegramId) {
        try {
            const res = await fetch('/api/auth/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telegramId })
            });
            const data = await res.json();
            return data.success ? data : { isVIP: false };
        } catch (error) {
            console.error("API Error (Auth):", error);
            return { isVIP: false };
        }
    },

    // جلب الأفلام العامة
    async getPublicMovies() {
        try {
            const res = await fetch('/api/content');
            const data = await res.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error("API Error (Public Content):", error);
            return [];
        }
    },

    // جلب أفلام الـ VIP
    async getVIPMovies() {
        try {
            const res = await fetch('/api/content/vip');
            const data = await res.json();
            return data.success ? data.data : [];
        } catch (error) {
            console.error("API Error (VIP Content):", error);
            return [];
        }
    }
};
