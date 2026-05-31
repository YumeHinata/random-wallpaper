// ====== 全局变量（常驻边缘节点内存） ======
let cachedUrls = null;
let lastFetched = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10分钟列表缓存

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

        // ====== 生成鉴权 URL ======
        const signedUrl = await generateSignedUrl(originalUrl, TOKEN_TYPE, SECRET_KEY);

        // ====== 返回 307 重定向 ======
        return new Response(null, {
            status: 307,
            headers: {
                "Location": signedUrl,
                ...NO_CACHE_HEADERS
            }
        });

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