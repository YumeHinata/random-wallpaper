let cachedUrls = null;
let lastFetched = 0;
const CACHE_TTL = 10 * 60 * 1000; // 列表本地缓存时间：10分钟（单位：毫秒）

export async function onRequestGet(context) {
    try {
        const URL_LIST = context.env.URL_LIST;
        const now = Date.now();
        
        let urls = cachedUrls;

        if (!urls || (now - lastFetched > CACHE_TTL)) {
            const response = await fetch(URL_LIST);
            if (!response.ok) throw new Error(`获取URL列表失败: ${response.status}`);

            const text = await response.text();
            urls = text.split('\n').filter(url => url.trim() !== '');
            if (urls.length === 0) throw new Error("URL列表为空");

            // 写入全局内存，供后续请求“白嫖”
            cachedUrls = urls;
            lastFetched = now;
        }

        // 3. 随机选择一个URL
        const randomIndex = Math.floor(Math.random() * urls.length);
        const originalUrl = urls[randomIndex].trim();

        // 4. 生成签名URL
        const TOKEN_TYPE = context.env.TOKEN_TYPE || "0";
        const SECRET_KEY = context.env.SECRET_KEY || "";
        const signedUrl = await generateSignedUrl(originalUrl, TOKEN_TYPE, SECRET_KEY);

        // 5. 返回307重定向
        //return Response.redirect(signedUrl, 307);
        return fetch(signedUrl);

    } catch (error) {
        return new Response(`错误: ${error.message}`, { status: 500 });
    }
}

// 生成签名URL的函数
async function generateSignedUrl(originalUrl, tokenType, secretKey) {
    var urlObj;
    try {
        urlObj = new URL(originalUrl);
    } catch (e) {
        throw new Error(`URL解析失败: ${originalUrl}`);
    }
    
    var resourcePath = urlObj.pathname + urlObj.search;
    var timestamp = Math.floor(Date.now() / 1000).toString();
    var randomString = Math.random().toString(36).substring(2, 102);

    if (tokenType != "0") {
        switch (tokenType) {
            case "D":
                var signStr = secretKey + resourcePath + timestamp;
                var token = await generateMD5(signStr);
                urlObj.searchParams.append("token", token);
                urlObj.searchParams.append("t", timestamp);
                return urlObj.toString();
            case "A":
                var signStr = resourcePath + "-" + randomString + "-" + "0" + "-" + secretKey;
                var MD5Token = await generateMD5(signStr);
                token = timestamp + "-" + randomString + "-" + "0" + "-" + MD5Token;
                urlObj.searchParams.append("token", token);
                return urlObj.toString();
        }   
    } else {
        return urlObj.toString();
    }
}

// MD5生成函数
async function generateMD5(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("MD5", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}