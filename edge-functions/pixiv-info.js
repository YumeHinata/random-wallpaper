// ====== Pixiv 作品信息代理接口（路由 /pixiv-info?id=xxx） ======
// 独立于图片反代链路：前端拿到 X-Pixiv-Id 后异步调用本接口获取作品信息
// 回源走 pximg.yumehinata.com 的 /pxajax/ 反代（EdgeOne 规则引擎 → www.pixiv.net/ajax/）
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

// 反代基址与 Referer（必须在 yumehinata.com 白名单内，否则 EdgeOne 返回 403）
const PROXY_BASE = "https://pximg.yumehinata.com/pxajax";
const PROXY_REFERER = "https://yumehinata.com/";
// 头像图片反代域名（接口返回的 i.pximg.net 链接替换为该域名，浏览器才能直连）
const IMG_PROXY_HOST = "https://pximg.yumehinata.com";

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

        // 回源 pixiv：ajax 详情接口（oEmbed 已失效，废弃）
        const data = await fetchFromAjax(id);

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

// -------- ajax 详情接口（经 /pxajax/ 反代，字段为扁平化结构） --------
async function fetchFromAjax(id) {
    try {
        const upstream = await fetch(`${PROXY_BASE}/illust/${id}?_lang=zh`, {
            headers: {
                "User-Agent": BROWSER_UA,
                "Referer": PROXY_REFERER,
                "Accept": "application/json"
            }
        });
        if (!upstream.ok) return null;

        const raw = await upstream.json();
        const body = raw && raw.body;
        if (!body) return null;

        const userId = String(body.userId || "");
        const data = {
            ok: true,
            id: String(body.id || id),
            title: String(body.title || ""),
            userName: String(body.userName || ""),
            userId,
            createDate: String(body.createDate || ""),
            avatarUrl: ""
        };

        // 头像 URL 需经 /ajax/user/ 接口获取（无法从 userId 推导），失败不影响主信息
        if (userId) {
            data.avatarUrl = await fetchAvatar(userId);
        }
        return data;
    } catch (e) {
        return null;
    }
}

// -------- 头像接口：/ajax/user/{id}?full=1 → body.imageBig --------
async function fetchAvatar(userId) {
    try {
        const upstream = await fetch(`${PROXY_BASE}/user/${userId}?full=1`, {
            headers: {
                "User-Agent": BROWSER_UA,
                "Referer": PROXY_REFERER,
                "Accept": "application/json"
            }
        });
        if (!upstream.ok) return "";

        const raw = await upstream.json();
        const imageBig = raw && raw.body && raw.body.imageBig;
        if (!imageBig) return "";

        // i.pximg.net → pximg.yumehinata.com（浏览器直连会被 DNS 污染阻断）
        return imageBig.replace("https://i.pximg.net", IMG_PROXY_HOST);
    } catch (e) {
        return "";
    }
}
