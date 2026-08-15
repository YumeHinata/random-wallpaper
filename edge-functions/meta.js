// ====== 首页元信息接口（路由 /meta） ======
// 向静态首页提供动态配置：标题、概述 HTML、URL 收录数量
// 环境变量语义与旧版 edge-functions/index.js 完全一致，仅注入方式改为客户端拉取

// ====== URL 数量内存缓存 ======
let cachedUrlCount = 0;
let lastCountFetched = 0;
const COUNT_CACHE_TTL = 10 * 60 * 1000; // 10 分钟

export default async function onRequest(context) {
    try {
        const URL_LIST = context.env.URL_LIST || "";
        const OVERVIEW_HTML = context.env.OVERVIEW_HTML || '<p>按自己的需求添加内容</p>';
        const INDEX_TITLE = context.env.INDEX_TITLE || "按自己需求添加标题";

        const now = Date.now();
        let urlCount = cachedUrlCount;

        // 拉取 URL_LIST 统计行数（容灾：失败复用旧值）
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
                    urlCount = text.split('\n').filter(url => url.trim() !== '').length;

                    cachedUrlCount = urlCount;
                    lastCountFetched = now;
                }
            } catch (e) {
                urlCount = cachedUrlCount || 0;
            }
        }

        const payload = JSON.stringify({
            title: INDEX_TITLE,
            overview: OVERVIEW_HTML,
            count: urlCount
        });

        return new Response(payload, {
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-store'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ title: "", overview: "", count: 0 }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-store'
            }
        });
    }
}
