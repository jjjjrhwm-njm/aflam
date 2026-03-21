let allContent = []; // متغير لتخزين كل البيانات محلياً للبحث والفلترة

// السيرفر والواجهة الآن في نفس المكان، نستخدم المسار النسبي!
const API_URL = '/api/content'; 

const container = document.getElementById('movies-container');
const loadingDiv = document.getElementById('loading');
const modal = document.getElementById('videoModal');
const videoPlayer = document.getElementById('videoPlayer');

// استخراج كود يوتيوب
function getYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// تشغيل الفيديو
function playMovie(ytId) {
    const embedUrl = `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&modestbranding=1&rel=0&showinfo=0&fs=1`;
    videoPlayer.src = embedUrl;
    modal.style.display = 'flex';
}

// إغلاق المشغل وإيقاف الصوت
function closePlayer() {
    modal.style.display = 'none';
    videoPlayer.src = ''; 
}

// دالة بناء الكروت
function renderCards(data) {
    container.innerHTML = ''; 

    if(data.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#888;">لا توجد نتائج مطابقة.</p>';
        return;
    }

    data.forEach(item => {
        const ytId = getYouTubeId(item.link);
        if (!ytId) return;

        const imageUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.onclick = () => playMovie(ytId);
        
        // تحديد نوع التاج واللون بناءً على القسم من قاعدة البيانات
        const tagText = item.category === 'series' ? 'مسلسل' : 'فيلم';
        const tagColor = item.category === 'series' ? '#0071eb' : '#E50914';

        card.innerHTML = `
            <div class="tag" style="background-color: ${tagColor}">${tagText}</div>
            <img src="${imageUrl}" alt="${item.title}">
            <div class="play-icon"></div>
            <h3 class="movie-title">${item.title}</h3>
        `;
        container.appendChild(card);
    });
}

// جلب البيانات من السيرفر عند فتح التطبيق
async function fetchContent() {
    try {
        const response = await fetch(API_URL);
        allContent = await response.json(); 
        loadingDiv.style.display = 'none';
        renderCards(allContent); 
    } catch (error) {
        loadingDiv.innerHTML = '❌ عذراً، فشل الاتصال بقاعدة البيانات.';
    }
}

// الفلترة بالقسم (مسلسلات / أفلام)
function filterContent(category, btnElement) {
    // تفعيل الزر المضغوط وتغيير لونه
    document.querySelectorAll('.categories button').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');

    if (category === 'all') {
        renderCards(allContent);
    } else {
        const filtered = allContent.filter(item => item.category === category);
        renderCards(filtered);
    }
}

// البحث
function searchContent() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const searched = allContent.filter(item => item.title.toLowerCase().includes(query));
    
    document.querySelectorAll('.categories button').forEach(btn => btn.classList.remove('active'));
    renderCards(searched);
}

// بدء التشغيل
fetchContent();
