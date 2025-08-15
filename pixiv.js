// /public/pixiv.js
document.addEventListener('DOMContentLoaded', function() {
    const imageContainer = document.getElementById('image-container');
    const wallpaper = document.getElementById('wallpaper');
    
    // 创建信息容器
    const infoContainer = document.createElement('div');
    infoContainer.className = 'image-info';
    infoContainer.innerHTML = `
        <span><i class="fas fa-image"></i> 点击图片前往Pixiv</span>
        <span><i class="fas fa-mouse-pointer"></i> 点击按钮获取新图片</span>
    `;
    imageContainer.appendChild(infoContainer);
    
    // 创建调试信息容器
    const debugInfo = document.createElement('div');
    debugInfo.className = 'debug-info';
    debugInfo.id = 'debug-info';
    imageContainer.appendChild(debugInfo);
    
    // 当前Pixiv链接
    let currentPixivUrl = null;
    
    // 点击图片跳转Pixiv
    imageContainer.addEventListener('click', function() {
        if (currentPixivUrl) {
            window.open(currentPixivUrl, '_blank');
        } else {
            showNotification('正在获取图片信息，请稍后再试');
        }
    });
    
    // 监听图片加载完成事件
    wallpaper.addEventListener('load', function() {
        const imageUrl = wallpaper.src;
        const pixivId = extractPixivId(imageUrl);
        
        if (pixivId) {
            currentPixivUrl = `https://www.pixiv.net/artworks/${pixivId}`;
            debugInfo.textContent = `图片ID: ${pixivId}`;
        }
    });
    
    // 从URL中提取图片ID
    function extractPixivId(url) {
        // URL结构示例: 
        // https://pximg.yumehinata.com/img-master/img/2019/03/11/00/13/58/73619430_p0_master1200.jpg?token=...

        // 使用正则表达式提取图片ID
        const match = url.match(/\/(\d+)_p\d+_/);
        if (match && match[1]) {
            return match[1];
        }

        // 备选方案：从路径中提取数字ID
        const parts = url.split('/');
        for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i];
            if (/^\d+_p\d+_/.test(part)) {
                return part.split('_')[0];
            }
        }

        // 尝试从文件名中提取
        const filenameMatch = url.match(/\/(\d+)\.[a-zA-Z]+(\?|$)/);
        if (filenameMatch && filenameMatch[1]) {
            return filenameMatch[1];
        }

        return null;
    }
    
    // 显示通知（如果主页面有定义则使用）
    function showNotification(text) {
        if (window.showNotification && typeof window.showNotification === 'function') {
            window.showNotification(text);
        } else {
            console.log(text);
        }
    }
});