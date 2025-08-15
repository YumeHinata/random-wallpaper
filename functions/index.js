// /functions/index.js
export async function onRequestGet(context) {
    try {
        // 获取环境变量
        const URL_LIST = context.env.URL_LIST || "";
        
        // 获取当前域名
        const requestUrl = new URL(context.request.url);
        const domain = requestUrl.hostname;
        const API_BASE_URL = `https://${domain}`;
        
        // 完整的HTML模板（只进行最小必要替换）
        const html = `<!DOCTYPE html>
<html lang="zh-CN">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pixiv随机图片API</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="icon" href="/g1logo4.png">
    <link rel="stylesheet" href="../style.css">
</head>

<body>
    <div class="particles" id="particles"></div>
    <div class="notification" id="notification"><i class="fas fa-info-circle"></i> <span id="notification-text"></span></div>
    
    <div class="container">
        <div class="header">
            <h1><i class="fas fa-random"></i> 随机图片API</h1>
            <p>此API提供来自Pixiv社区的随机图片，所有图片版权归原作者所有。</p>
            <p>API仅提供图片展示服务，请勿用于商业用途。</p>
            <div class="url-count"><i class="fas fa-database"></i> 目前系统已收录<span id="urlCount">加载中...</span>条URL，持续更新中</div>
        </div>

        <div class="api-info">
            <h3><i class="fas fa-code"></i> API接口地址</h3>
            <div class="code-block">${API_BASE_URL}/random-wallpaper</div>
            <p>直接在img标签中使用此URL获取随机图片</p>
        </div>
        
        <div class="image-container" id="image-container">
            <div class="loading" id="loading"><div class="spinner"></div><p>正在获取随机图片...</p></div>
            <img id="wallpaper" alt="Pixiv随机图片">
            <div class="image-info">
                <span><i class="fas fa-image"></i> 点击图片前往Pixiv</span>
                <span><i class="fas fa-mouse-pointer"></i> 点击按钮获取新图片</span>
            </div>
            <div class="debug-info" id="debug-info"></div>
        </div>
        
        <div class="control-panel">
            <button class="btn btn-primary" onclick="loadRandomImage()"><i class="fas fa-sync-alt"></i> 获取新图片</button>
        </div>
    </div>
    
    <script>
        // 全局变量
        let currentPixivUrl = null;
        let urlCount = 0;
        const APP_CONFIG = {
            URL_LIST: "${URL_LIST}",
            API_BASE_URL: "${API_BASE_URL}"
        };

        // 页面加载完成后执行
        document.addEventListener('DOMContentLoaded', function () {
            createParticles();
            fetchURLCount();
            loadRandomImage();
            
            document.getElementById('image-container').addEventListener('click', function () {
                if (currentPixivUrl) window.open(currentPixivUrl, '_blank');
                else showNotification('正在获取图片信息，请稍后再试');
            });
            
            window.addEventListener('resize', adjustLayout);
            adjustLayout();
        });

        // 获取URL数量
        async function fetchURLCount() {
            try {
                const response = await fetch(APP_CONFIG.URL_LIST);
                if (!response.ok) throw new Error('无法获取URL列表');
                
                const text = await response.text();
                const lines = text.split('\\n');
                urlCount = lines.filter(line => line.trim() !== '').length;
                document.getElementById('urlCount').textContent = urlCount.toLocaleString();
            } catch (error) {
                console.error('获取URL数量失败:', error);
                document.getElementById('urlCount').textContent = '未知';
                showNotification('获取URL数量失败');
            }
        }

        // 加载随机图片
        function loadRandomImage() {
            const loading = document.getElementById('loading');
            const wallpaper = document.getElementById('wallpaper');
            const debugInfo = document.getElementById('debug-info');
            
            loading.style.display = 'flex';
            loading.style.opacity = '1';
            currentPixivUrl = null;
            
            const timestamp = Date.now();
            const apiUrl = \`\${APP_CONFIG.API_BASE_URL}/random-wallpaper?t=\${timestamp}\`;
            
            const xhr = new XMLHttpRequest();
            xhr.open('GET', apiUrl, true);
            xhr.responseType = 'arraybuffer';
            
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const finalUrl = xhr.responseURL;
                    debugInfo.textContent = \`图片URL: \${finalUrl}\`;
                    wallpaper.src = finalUrl;
                    
                    const pixivId = extractPixivId(finalUrl);
                    if (pixivId) {
                        currentPixivUrl = \`https://www.pixiv.net/artworks/\${pixivId}\`;
                        debugInfo.textContent += \` | 图片ID: \${pixivId}\`;
                        showNotification('点击图片可跳转到Pixiv原图页面');
                    } else {
                        debugInfo.textContent += ' | 无法提取图片ID';
                        showNotification('无法提取图片ID');
                    }
                    
                    const btn = document.querySelector('.btn-primary');
                    btn.style.transform = 'rotate(360deg)';
                    setTimeout(() => { btn.style.transform = ''; }, 500);
                } else handleImageError('请求失败，状态码: ' + xhr.status);
            };
            
            xhr.onerror = function () { handleImageError('网络请求失败'); };
            xhr.send();
        }
        
        // 其他函数保持不变
        function handleImageError(error) { /* ... */ }
        function extractPixivId(url) { /* ... */ }
        function adjustLayout() { /* ... */ }
        function createParticles() { /* ... */ }
        function hideLoader() { /* ... */ }
        function showNotification(text) { /* ... */ }
        
        // 图片加载事件
        document.getElementById('wallpaper').onload = hideLoader;
        document.getElementById('wallpaper').onerror = function () {
            handleImageError('图片加载失败');
        };
    </script>
</body>
</html>`;

        // 返回生成的HTML响应
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