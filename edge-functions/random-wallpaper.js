// ====== 全局变量（常驻边缘节点内存） ======
let cachedUrls = null;
let lastFetched = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10分钟列表缓存

function extractPixivId(url) {
    const match = url.match(/\/(\d+)_p\d+_/);
    return match ? match[1] : "";
}

// 核心修正：必须使用官方指定的 export default function onRequest 格式
export default async function onRequest(context) {
    const NO_CACHE_HEADERS = {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    };

    try {
        // 从官方规范的 context.env 中读取环境变量
        const URL_LIST = context.env.URL_LIST;
        const TOKEN_TYPE = context.env.TOKEN_TYPE || "0";
        const SECRET_KEY = context.env.SECRET_KEY || "";

        if (!URL_LIST) throw new Error("环境配置中缺少 URL_LIST");

        const now = Date.now();
        let urls = cachedUrls;

        // ====== 容灾降级列表获取 ======
        if (!urls || (now - lastFetched > CACHE_TTL)) {
            const cacheBuster = URL_LIST.includes('?') ? `&_t=${now}` : `?_t=${now}`;

            try {
                const response = await fetch(URL_LIST + cacheBuster, {
                    method: "GET",
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
                    }
                });

                if (!response.ok) throw new Error(`jsDelivr 返回错误码: ${response.status}`);

                const text = await response.text();
                const freshUrls = text.split('\n').filter(url => url.trim() !== '');

                if (freshUrls.length === 0) throw new Error("抓取到的 URL 列表为空");

                urls = freshUrls;
                cachedUrls = freshUrls;
                lastFetched = now;

            } catch (fetchError) {
                // 容灾：有旧数据就直接复用
                if (cachedUrls && cachedUrls.length > 0) {
                    urls = cachedUrls;
                    lastFetched = now - CACHE_TTL + (1 * 60 * 1000);
                } else {
                    throw fetchError;
                }
            }
        }

        // ====== 随机抽取 ======
        const randomIndex = Math.floor(Math.random() * urls.length);
        const originalUrl = urls[randomIndex].trim();

        const pixivId = extractPixivId(originalUrl);

        const signedUrl = await generateSignedUrl(
            originalUrl,
            TOKEN_TYPE,
            SECRET_KEY
        );

        return await handleStreamProxy(
            signedUrl,
            context.request,
            NO_CACHE_HEADERS,
            pixivId
        );
    } catch (error) {
        return new Response(`[边缘函数错误]: ${error.message}`, {
            status: 500,
            headers: NO_CACHE_HEADERS
        });
    }
}

// 鉴权与 MD5 算法
async function generateSignedUrl(originalUrl, tokenType, secretKey) {
    let urlObj;
    try { urlObj = new URL(originalUrl); } catch (e) { throw new Error(`URL解析失败: ${originalUrl}`); }

    const resourcePath = urlObj.pathname + urlObj.search;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const randomString = Math.random().toString(36).substring(2, 102);

    if (tokenType !== "0") {
        switch (tokenType) {
            case "D":
                const signStrD = secretKey + resourcePath + timestamp;
                const tokenD = await generateMD5(signStrD);
                urlObj.searchParams.append("token", tokenD);
                urlObj.searchParams.append("t", timestamp);
                return urlObj.toString();
            case "A":
                const signStrA = resourcePath + "-" + randomString + "-" + "0" + "-" + secretKey;
                const MD5Token = await generateMD5(signStrA);
                const tokenA = timestamp + "-" + randomString + "-" + "0" + "-" + MD5Token;
                urlObj.searchParams.append("token", tokenA);
                return urlObj.toString();
        }
    }
    return urlObj.toString();
}

async function generateMD5(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("MD5", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 完美的流式反代封装函数
 * @param {string} signedUrl - 带鉴权的源站图片URL
 * @param {Request} request - 原始请求对象，用于提取UA等信息
 * @param {Object} noCacheHeaders - 统一的防缓存响应头
 * @param {string} pixivId - Pixiv图片ID
 */
async function handleStreamProxy(signedUrl, request, noCacheHeaders, pixivId) {
    try {
        // 边缘节点代为发起请求
        const imageResponse = await fetch(signedUrl, {
            method: "GET",
            headers: {
                "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0",
                "Accept": request.headers.get("Accept") || "image/*",
                "Accept-Encoding": request.headers.get("Accept-Encoding") || ""
            }
        });

        // 如果源站挂了，直接报错
        if (!imageResponse.ok) {
            return new Response(`[源站错误] 状态码: ${imageResponse.status}`, {
                status: 500,
                headers: noCacheHeaders
            });
        }

        // 组装响应头
        const responseHeaders = new Headers();

        // 继承源站必带的媒体属性
        const keepHeaders = ['content-type', 'content-length', 'accept-ranges', 'etag'];
        for (const headerName of keepHeaders) {
            if (imageResponse.headers.has(headerName)) {
                responseHeaders.set(headerName, imageResponse.headers.get(headerName));
            }
        }

        // 注入防缓存头
        for (const [key, value] of Object.entries(noCacheHeaders)) {
            responseHeaders.set(key, value);
        }
        responseHeaders.set("Access-Control-Allow-Origin", "*"); // 补个跨域

        // 返回流式二进制数据
        return new Response(imageResponse.body, {
            status: 200,
            headers: responseHeaders
        });

        responseHeaders.set("X-Pixiv-Id", pixivId);

        // 允许浏览器读取
        responseHeaders.set(
            "Access-Control-Expose-Headers",
            "X-Pixiv-Id"
        );
    } catch (e) {
        return new Response(`[反代传输异常]: ${e.message}`, {
            status: 500,
            headers: noCacheHeaders
        });
    }
}
