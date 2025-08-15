// 全局变量
let currentPixivUrl = null;
let urlCount = 0;

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function () {
    createParticles();

    // 获取URL数量
    fetchURLCount();

    // 加载第一张图片
    loadRandomImage();

    // 添加图片点击事件
    document.getElementById('image-container').addEventListener('click', function () {
        if (currentPixivUrl) {
            window.open(currentPixivUrl, '_blank');
        } else {
            showNotification('正在获取图片信息，请稍后再试');
        }
    });

    // 窗口大小变化时调整布局
    window.addEventListener('resize', adjustLayout);
    adjustLayout();
});

// 获取URL数量
async function fetchURLCount() {
    try {
        const response = await fetch(context.env.URL_LIST);

        if (!response.ok) {
            throw new Error('无法获取URL列表');
        }

        const text = await response.text();
        // 计算行数（每行一个URL）
        const lines = text.split('\n');
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

    // 显示加载动画
    loading.style.display = 'flex';
    loading.style.opacity = '1';

    // 重置当前Pixiv链接
    currentPixivUrl = null;

    // 添加时间戳避免缓存
    const timestamp = Date.now();
    const apiUrl = `https://rdimg.yumehinata.com/random-wallpaper?t=${timestamp}`;

    // 使用XMLHttpRequest获取重定向URL
    const xhr = new XMLHttpRequest();
    xhr.open('GET', apiUrl, true);

    // 设置响应类型为arraybuffer以避免CORS问题
    xhr.responseType = 'arraybuffer';

    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
            // 获取最终URL（重定向后的URL）
            const finalUrl = xhr.responseURL;
            debugInfo.textContent = `图片URL: ${finalUrl}`;

            // 设置图片源
            wallpaper.src = finalUrl;

            // 从URL中提取图片ID
            const pixivId = extractPixivId(finalUrl);
            if (pixivId) {
                // 构建Pixiv链接
                currentPixivUrl = `https://www.pixiv.net/artworks/${pixivId}`;
                debugInfo.textContent += ` | 图片ID: ${pixivId}`;
                showNotification('点击图片可跳转到Pixiv原图页面');
            } else {
                debugInfo.textContent += ' | 无法提取图片ID';
                showNotification('无法提取图片ID');
            }

            // 添加旋转动画到按钮
            const btn = document.querySelector('.btn-primary');
            btn.style.transform = 'rotate(360deg)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 500);
        } else {
            handleImageError('请求失败，状态码: ' + xhr.status);
        }
    };

    xhr.onerror = function () {
        handleImageError('网络请求失败');
    };

    xhr.send();
}

// 处理图片加载错误
function handleImageError(error) {
    console.error('加载图片失败:', error);
    const debugInfo = document.getElementById('debug-info');
    debugInfo.textContent = `错误: ${error}`;
    showNotification('加载图片失败，请重试');

    const loading = document.getElementById('loading');
    loading.innerHTML =
        '<p>无法加载图片，请稍后再试</p>' +
        '<button class="btn btn-primary" style="margin-top: 15px;" onclick="loadRandomImage()">重新加载</button>';
}

// 从重定向URL中提取图片ID
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

// 图片加载完成
document.getElementById('wallpaper').onload = function () {
    hideLoader();
};

// 图片加载失败
document.getElementById('wallpaper').onerror = function () {
    handleImageError('图片加载失败');
};

// 调整布局以确保内容在视口内
function adjustLayout() {
    const container = document.querySelector('.container');
    const windowHeight = window.innerHeight;

    // 如果窗口高度较小，减少上下的padding
    if (windowHeight < 700) {
        container.style.maxHeight = '95vh';
        container.style.padding = '10px';
    } else {
        container.style.maxHeight = '90vh';
        container.style.padding = '20px';
    }
}

// 创建背景粒子效果
function createParticles() {
    const container = document.getElementById('particles');
    const particleCount = 15;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');

        // 随机大小
        const size = Math.random() * 6 + 2;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;

        // 随机位置
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;

        // 随机动画延迟
        particle.style.animationDelay = `${Math.random() * 15}s`;

        // 随机颜色
        const colors = ['rgba(255, 126, 95, 0.7)', 'rgba(254, 180, 123, 0.7)', 'rgba(255, 179, 71, 0.7)'];
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];

        container.appendChild(particle);
    }
}

// 隐藏加载动画
function hideLoader() {
    const loading = document.getElementById('loading');
    loading.style.opacity = '0';
    setTimeout(() => {
        loading.style.display = 'none';
    }, 300);
}

// 显示通知
function showNotification(text) {
    const notification = document.getElementById('notification');
    const textElement = document.getElementById('notification-text');

    textElement.textContent = text;
    notification.classList.add('show');

    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}