// /functions/index.js
export async function onRequestGet(context) {
    try {
        // 获取环境变量
        const URL_LIST = context.env.URL_LIST || "";
        const OVERVIEW_HTML = context.env.OVERVIEW_HTML || 
            '<p>按自己的需求添加内容</p>';
        const INDEX_TITLE = context.env.INDEX_TITLE || "按自己需求添加标题";
        
        // 获取当前域名
        const requestUrl = new URL(context.request.url);
        const domain = requestUrl.hostname;
        const API_BASE_URL = `https://${domain}`;
        
        // 在服务端获取URL列表并计算数量
        let urlCount = 0;
        if (URL_LIST) {
            const response = await fetch(URL_LIST);
            if (response.ok) {
                const text = await response.text();
                const urls = text.split('\n').filter(url => url.trim() !== '');
                urlCount = urls.length;
            }
        }
        
        // 完整的HTML模板
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
    <div class="notification" id="notification"><i class="fas fa-info-circle"></i> <span id="notification-text"></span></div>
    
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
        
        <!-- 其余HTML结构保持不变 -->
    </div>
    
    <script>
        // 全局变量
        let currentPixivUrl = null;
        const APP_CONFIG = {
            API_BASE_URL: "${API_BASE_URL}"
        };

        // 页面加载完成后执行
        document.addEventListener('DOMContentLoaded', function () {
            createParticles();
            loadRandomImage();
            
            document.getElementById('image-container').addEventListener('click', function () {
                if (currentPixivUrl) window.open(currentPixivUrl, '_blank');
                else showNotification('正在获取图片信息，请稍后再试');
            });
            
            window.addEventListener('resize', adjustLayout);
            adjustLayout();
        });

        // 加载随机图片（保持不变）
        function loadRandomImage() {
            // ... 函数实现保持不变 ...
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