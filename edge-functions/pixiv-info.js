// ====== Pixiv 作品信息代理接口（路由 /pixiv-info?id=xxx） ======
// 独立于图片反代链路：前端拿到 X-Pixiv-Id 后异步调用本接口获取作品信息
// 解决 pixiv 域名被污染问题：客户端无需直连 pixiv，全部由边缘节点代拉
// 即使本接口失败/超时，也只影响信息展示，不影响图片 API 的任何性能

// ====== 作品信息内存缓存 ======
const infoCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 分钟（作品信息基本不变）

const BASE_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Content-Type": "application/json; charset=utf-8"
};

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export default async function onRequest(context) {
    try {
        const url = new URL(context.request.url);
        const id = (url.searchParams.get("id") || "").trim();

        // 参数校验：仅允许纯数字作品 ID
        if (!/^\d{1,12}$/.test(id)) {
            return new Response(JSON.stringify({ ok: false, error: "invalid id" }), {
                status: 400,
                headers: BASE_HEADERS
            });
        }

        // 缓存命中
        const cached = infoCache.get(id);
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
            return jsonResponse(cached.data, 200, "public, max-age=600");
        }

        // 回源 pixiv：优先公开 oEmbed 接口（无需登录，最稳定），失败降级 ajax 接口
        const data = await fetchFromOEmbed(id) || await fetchFromAjax(id);

        if (!data) {
            return jsonResponse({ ok: false, error: "upstream unavailable" }, 502, "public, max-age=60");
        }

        infoCache.set(id, { data, ts: Date.now() });
        return jsonResponse(data, 200, "public, max-age=600");
    } catch (e) {
        return jsonResponse({ ok: false, error: "proxy error" }, 502, "no-store");
    }
}

function jsonResponse(data, status, cacheControl) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...BASE_HEADERS,
            "Cache-Control": cacheControl
        }
    });
}

// -------- 方案一：公开 oEmbed 接口（无需登录，pixiv 官方对外暴露） --------
async function fetchFromOEmbed(id) {
    try {
        const upstream = await fetch(
            `https://www.pixiv.net/oembed?url=https%3A%2F%2Fwww.pixiv.net%2Fartworks%2F${id}`,
            {
                headers: {
                    "User-Agent": BROWSER_UA,
                    "Referer": "https://www.pixiv.net/",
                    "Accept": "application/json"
                }
            }
        );
        if (!upstream.ok) return null;

        const raw = await upstream.json();
        if (!raw || !raw.title) return null;

        // author_url 形如 https://www.pixiv.net/users/123456
        let userId = "";
        const userMatch = (raw.author_url || "").match(/\/users\/(\d+)/);
        if (userMatch) userId = userMatch[1];

        return {
            ok: true,
            id: String(id),
            title: String(raw.title || ""),
            userName: String(raw.author_name || ""),
            userId: String(userId || ""),
            createDate: ""
        };
    } catch (e) {
        return null;
    }
}

// -------- 方案二：ajax 详情接口（信息更全，部分情况需登录态） --------
async function fetchFromAjax(id) {
    try {
        const upstream = await fetch(`https://www.pixiv.net/ajax/illust/${id}?_lang=zh`, {
            headers: {
                "User-Agent": BROWSER_UA,
                "Referer": "https://www.pixiv.net/",
                "Accept": "application/json"
            }
        });
        if (!upstream.ok) return null;

        const raw = await upstream.json();
        const body = raw && raw.body;
        if (!body) return null;

        return {
            ok: true,
            id: String(body.id || id),
            title: String(body.title || ""),
            userName: String((body.user && body.user.name) || ""),
            userId: String((body.user && body.user.id) || ""),
            createDate: String(body.createDate || "")
        };
    } catch (e) {
        return null;
    }
}
