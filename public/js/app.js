document.addEventListener('DOMContentLoaded', async () => {
    // 1. تهيئة تطبيق تليجرام المصغر (Telegram Web App)
    const tg = window.Telegram.WebApp;
    tg.expand(); // جعل التطبيق يملأ الشاشة
    tg.ready();

    // 2. جلب ID المستخدم من التلغرام (أو وضع ID افتراضي للتجربة على المتصفح العادي)
    let telegramId = "guest"; 
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
        telegramId = tg.initDataUnsafe.user.id;
    }

    console.log("User Telegram ID:", telegramId);

    // 3. التحقق من حالة الاشتراك
    const userStatus = await API.checkUserStatus(telegramId);
    
    // 4. إخبار ملف واجهة المستخدم بحالة הـ VIP
    UI.updateUserStatus(userStatus.isVIP);

    // 5. جلب الأفلام (العامة والـ VIP)
    const publicMovies = await API.getPublicMovies();
    const vipMovies = await API.getVIPMovies();

    // 6. رسم الواجهة
    // رسم البانر بأول فيلم (سواء كان VIP أو عام بناءً على الأحدث)
    const allMovies = [...vipMovies, ...publicMovies];
    UI.renderHero(allMovies[0]);

    // رسم سلايدر الأفلام العامة
    UI.renderMovies(publicMovies, 'publicMoviesGrid', false);

    // رسم سلايدر أفلام الـ VIP (نرسل true لتفعيل الأقفال إذا لزم الأمر)
    UI.renderMovies(vipMovies, 'vipMoviesGrid', true);
});
