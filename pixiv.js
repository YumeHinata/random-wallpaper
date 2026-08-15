/* ============================================================
 * Random Wallpaper API - 前端逻辑
 * 1. /meta 拉取动态配置（标题/概述/URL数量），失败保留 HTML 默认值
 * 2. 双图层背景轮播（复刻 pixiv：opacity 交叉淡入淡出）
 * 3. 右下角信息卡（X-Pixiv-Id → /pixiv-info 代理接口，失败自动隐藏）
 * ============================================================ */

(function () {
    'use strict';

    // ====== 配置 ======
    const SWITCH_INTERVAL = 12000;   // 自动切换间隔（ms）
    const FADE_MS = 1000;            // 淡入淡出时长，与 CSS transition 一致
    const INFO_TIMEOUT = 5000;       // 信息接口超时（ms），超过则隐藏卡片
    const IS_LOCAL = !(location.protocol === 'http:' || location.protocol === 'https:');

    // 图片 API 基址：线上取当前域名，本地预览用占位地址
    const API_BASE = IS_LOCAL ? '' : location.origin;
    const API_URL = API_BASE ? API_BASE + '/random-wallpaper' : 'https://example.com/random-wallpaper';

    // ====== DOM ======
    const $ = (id) => document.getElementById(id);
    const bgLayers = [$('bg-a'), $('bg-b')];
    const boot = $('boot');
    const btnRefresh = $('btn-refresh');
    const btnPrimary = $('btn-primary');
    const btnCopy = $('btn-copy');
    const copyIcon = $('copy-icon');
    const checkIcon = $('check-icon');
    const infoCard = $('info-card');
    const notification = $('notification');

    // ====== 状态 ======
    let activeLayer = 0;            // 当前显示中的背景层索引
    let currentPixivId = null;      // 当前图片的 Pixiv 作品 ID
    let isLoading = false;
    let autoTimer = null;
    let notiTimer = null;

    // ============================================================
    // 1. Meta 注入：动态标题 / 概述 / URL 数量
    // ============================================================
    async function loadMeta() {
        if (IS_LOCAL) return; // 本地预览模式，直接使用 HTML 默认值
        try {
            const res = await fetch(API_BASE + '/meta', { cache: 'no-store' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const meta = await res.json();

            if (meta.title) {
                document.title = meta.title;
                $('card-title').textContent = meta.title;
            }
            if (meta.overview) {
                $('card-overview').innerHTML = meta.overview;
            }
            if (typeof meta.count === 'number' && meta.count > 0) {
                $('url-count-num').textContent = meta.count.toLocaleString();
            }
        } catch (e) {
            // 静默：保留 index.html 中写死的默认值
        }
    }

    // ============================================================
    // 2. 图片获取与双图层轮播（复刻 pixiv 交叉淡入淡出）
    // ============================================================
    // 拉取一张随机图片：流式返回 → blob → objectURL，并读取 X-Pixiv-Id
    async function fetchWallpaper() {
        const res = await fetch(API_BASE + '/random-wallpaper?t=' + Date.now(), {
            cache: 'no-store'
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const pixivId = res.headers.get('X-Pixiv-Id') || '';
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        await waitImageDecode(objectUrl);
        return { objectUrl, pixivId };
    }

    // 确认图片解码完成（保证淡入时画面完整）
    function waitImageDecode(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => {
                URL.revokeObjectURL(src);
                reject(new Error('图片解码失败'));
            };
            img.src = src;
        });
    }

    // 执行一次切换：预加载新图 → 新层淡入 + 旧层淡出 → 释放旧层内存
    async function switchWallpaper(manual) {
        if (isLoading) return;
        isLoading = true;
        setSpinning(manual, true);

        try {
            const next = await fetchWallpaper();
            const prevLayer = bgLayers[activeLayer];
            const nextLayer = bgLayers[1 - activeLayer];
            const oldUrl = prevLayer.dataset.url; // 旧层上待释放的图

            nextLayer.style.backgroundImage = 'url("' + next.objectUrl + '")';
            nextLayer.dataset.url = next.objectUrl;
            nextLayer.classList.add('active');

            if (prevLayer.style.backgroundImage) {
                prevLayer.classList.remove('active'); // 1s 淡出
            }

            activeLayer = 1 - activeLayer;
            currentPixivId = next.pixivId;

            // 淡出结束后释放旧图内存
            if (oldUrl) {
                setTimeout(() => URL.revokeObjectURL(oldUrl), FADE_MS + 300);
            }

            boot.classList.add('hidden'); // 首屏加载遮罩移除
            updateInfoCard();
        } catch (e) {
            showNotification(IS_LOCAL ? '本地预览模式：图片需部署后加载' : '加载图片失败，请稍后重试');
        } finally {
            isLoading = false;
            setSpinning(manual, false);
        }
    }

    // 按钮旋转反馈
    function setSpinning(manual, on) {
        if (!manual) return;
        btnPrimary.classList.toggle('spinning', on);
        btnRefresh.classList.toggle('spinning', on);
    }

    // 自动轮播定时器（每次手动/自动切换后重置，避免累积）
    function restartAuto() {
        clearInterval(autoTimer);
        autoTimer = setInterval(() => switchWallpaper(false), SWITCH_INTERVAL);
    }

    function triggerSwitch() {
        switchWallpaper(true);
        restartAuto();
    }

    // ============================================================
    // 3. 右下角信息卡：X-Pixiv-Id → /pixiv-info 代理接口
    //    信息接口完全独立于图片链路，失败/超时仅隐藏卡片，不影响图片
    // ============================================================
    async function updateInfoCard() {
        if (!currentPixivId) {
            infoCard.hidden = true;
            return;
        }

        let data = null;
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), INFO_TIMEOUT);
            const res = await fetch(API_BASE + '/pixiv-info?id=' + currentPixivId, { signal: controller.signal });
            clearTimeout(timer);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            data = await res.json();
        } catch (e) {
            infoCard.hidden = true; // 静默降级
            return;
        }

        if (!data || !data.ok) {
            infoCard.hidden = true;
            return;
        }

        $('info-title').textContent = data.title || '';
        $('info-author').textContent = data.userName || '';
        $('info-id').textContent = '#' + (data.id || currentPixivId);
        infoCard.hidden = false;
    }

    function openPixivPage() {
        if (!currentPixivId) return;
        window.open('https://www.pixiv.net/artworks/' + currentPixivId, '_blank', 'noopener');
    }

    // ============================================================
    // 4. 复制 API 地址
    // ============================================================
    async function copyApiUrl() {
        const text = $('api-url').textContent.trim();
        try {
            await navigator.clipboard.writeText(text);
            showNotification('API 地址已复制');
            copyIcon.hidden = true;
            checkIcon.hidden = false;
            setTimeout(() => {
                copyIcon.hidden = false;
                checkIcon.hidden = true;
            }, 1500);
        } catch (e) {
            // 降级：选中文本手动复制
            const range = document.createRange();
            range.selectNodeContents($('api-url'));
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            showNotification('复制失败，请手动 Ctrl+C');
        }
    }

    // ============================================================
    // 5. 通知
    // ============================================================
    function showNotification(text) {
        $('notification-text').textContent = text;
        notification.classList.add('show');
        clearTimeout(notiTimer);
        notiTimer = setTimeout(() => notification.classList.remove('show'), 2600);
    }

    // ============================================================
    // 6. 初始化
    // ============================================================
    function init() {
        // API 地址注入（本地 file:// 保持示例地址）
        if (API_BASE) {
            $('api-url').textContent = API_URL;
        }

        // 事件绑定
        btnRefresh.addEventListener('click', triggerSwitch);
        btnPrimary.addEventListener('click', triggerSwitch);
        btnCopy.addEventListener('click', copyApiUrl);
        infoCard.addEventListener('click', openPixivPage);
        infoCard.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openPixivPage();
            }
        });

        // 动态配置注入（不阻塞首图加载）
        loadMeta();

        // 首图加载 + 启动轮播
        switchWallpaper(true).then(restartAuto).catch(() => {
            if (IS_LOCAL) showNotification('本地预览模式：仅展示页面风格');
        });

        // 本地预览模式提示
        if (IS_LOCAL) {
            $('footer-left').textContent = '© 本地预览模式';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
