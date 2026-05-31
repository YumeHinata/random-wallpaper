// ====== 首页计数内存缓存 ======
let cachedUrlCount = 0;
let lastCountFetched = 0;
const COUNT_CACHE_TTL = 10 * 60 * 1000;

// 核心修正：同样换成官方要求的 export default function onRequest 格式
export default async function onRequest(context) {
    try {
        const URL_LIST = context.env.URL_LIST || "";
        const OVERVIEW_HTML = context.env.OVERVIEW_HTML || '<p>按自己的需求添加内容</p>';
        const INDEX_TITLE = context.env.INDEX_TITLE || "按自己需求添加标题";
        
        // 从 context.request 获取当前域名
        const requestUrl = new URL(context.request.url);
        const domain = requestUrl.hostname;
        const API_BASE_URL = `https://${domain}`;
        
        const now = Date.now();
        let urlCount = cachedUrlCount;
        
        if (URL_LIST && (!urlCount || (now - lastCountFetched > COUNT_CACHE_TTL))) {
            try {
                const cacheBuster = URL_LIST.includes('?') ? `&_t=${now}` : `?_t=${now}`;
                const response = await fetch(URL_LIST + cacheBuster, {
                    method: "GET",
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
                    }
                });
                
                if (response.ok) {
                    const text = await response.text();
                    const urls = text.split('\n').filter(url => url.trim() !== '');
                    urlCount = urls.length;
                    
                    cachedUrlCount = urlCount;
                    lastCountFetched = now;
                }
            } catch (e) {
                urlCount = cachedUrlCount || 0;
            }
        }
        
        // 完整的HTML模板（保持不变）
        const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${INDEX_TITLE}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="icon" href="/g1logo4.png">
    <link rel="stylesheet" href="../style.css">
</head>
<body>
    <div class="particles" id="particles"></div>
    <div class="notification" id="notification">
        <i class="fas fa-info-circle"></i> <span id="notification-text"></span>
    </div>
    
    <div class="container">
        <div class="header">
            <h1><i class="fas fa-random"></i> 随机图片API</h1>
            ${OVERVIEW_HTML}
            <div class="url-count">
                <i class="fas fa-database"></i> 目前系统已收录<span id="urlCount">${urlCount.toLocaleString()}</span>条URL，持续更新中
            </div>
        </div>

        <div class="api-info">
            <h3><i class="fas fa-code"></i> API接口地址</h3>
            <div class="code-block">${API_BASE_URL}/random-wallpaper</div>
            <p>直接在img标签中使用此URL获取随机图片</p>
        </div>
        
        <div class="image-container" id="image-container">
            <div class="loading" id="loading">
                <div class="spinner"></div>
                <p>正在获取随机图片...</p>
            </div>
            <img id="wallpaper" alt="随机图片">
        </div>
        
        <div class="control-panel">
            <button class="btn btn-primary" onclick="loadRandomImage()">
                <i class="fas fa-sync-alt"></i> 获取新图片
            </button>
        </div>
    </div>
    
    <script>
        const APP_CONFIG = { API_BASE_URL: "${API_BASE_URL}" };

        document.addEventListener('DOMContentLoaded', function () {
            createParticles();
            loadRandomImage();
            window.addEventListener('resize', adjustLayout);
            adjustLayout();
        });

        function loadRandomImage() {
            const loading = document.getElementById('loading');
            const wallpaper = document.getElementById('wallpaper');
            loading.style.display = 'flex';
            loading.style.opacity = '1';
            const timestamp = Date.now();
            const apiUrl = \`\${APP_CONFIG.API_BASE_URL}/random-wallpaper?t=\${timestamp}\`;
            
            const xhr = new XMLHttpRequest();
            xhr.open('GET', apiUrl, true);
            xhr.responseType = 'arraybuffer';
            
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const finalUrl = xhr.responseURL;
                    wallpaper.src = finalUrl;
                    const btn = document.querySelector('.btn-primary');
                    btn.style.transform = 'rotate(360deg)';
                    setTimeout(() => { btn.style.transform = ''; }, 500);
                } else {
                    handleImageError('请求失败，状态码: ' + xhr.status);
                }
            };
            xhr.onerror = function () { handleImageError('网络请求失败'); };
            xhr.send();
        }
        
        function handleImageError(error) {
            console.error('加载图片失败:', error);
            showNotification('加载图片失败，请重试');
            const loading = document.getElementById('loading');
            loading.innerHTML = '<p>无法加载图片，请稍后再试</p><button class="btn btn-primary" style="margin-top: 15px;" onclick="loadRandomImage()">重新加载</button>';
        }
        
        function adjustLayout() {
            const container = document.querySelector('.container');
            const windowHeight = window.innerHeight;
            if (windowHeight < 700) {
                container.style.maxHeight = '95vh'; container.style.padding = '10px';
            } else {
                container.style.maxHeight = '90vh'; container.style.padding = '20px';
            }
        }
        
        function createParticles() {
            const container = document.getElementById('particles');
            const particleCount = 15;
            for (let i = 0; i < particleCount; i++) {
                const particle = document.createElement('div');
                particle.classList.add('particle');
                const size = Math.random() * 6 + 2;
                particle.style.width = \`\${size}px\`; particle.style.height = \`\${size}px\`;
                particle.style.left = \`\${Math.random() * 100}%\`; particle.style.top = \`\${Math.random() * 100}%\`;
                particle.style.animationDelay = \`\${Math.random() * 15}s\`;
                const colors = ['rgba(255, 126, 95, 0.7)', 'rgba(254, 180, 123, 0.7)', 'rgba(255, 179, 71, 0.7)'];
                particle.style.background = colors[Math.floor(Math.random() * colors.length)];
                container.appendChild(particle);
            }
        }
        
        function hideLoader() {
            const loading = document.getElementById('loading');
            loading.style.opacity = '0';
            setTimeout(() => { loading.style.display = 'none'; }, 300);
        }
        
        function showNotification(text) {
            const notification = document.getElementById('notification');
            const textElement = document.getElementById('notification-text');
            textElement.textContent = text; notification.classList.add('show');
            setTimeout(() => { notification.classList.remove('show'); }, 3000);
        }
        
        document.getElementById('wallpaper').onload = hideLoader;
        document.getElementById('wallpaper').onerror = function () { handleImageError('图片加载失败'); };
    </script>
    <script src="../pixiv.js"></script>
</body>
</html>`;

        return new Response(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
        
    } catch (error) {
        return new Response(`页面生成失败: ${error.message}`, { status: 500 });
    }
}