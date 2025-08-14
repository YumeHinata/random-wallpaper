// /functions/random-wallpaper.js
export async function onRequestGet(context) {
    try {
        // 1. 可配置的远程URL列表文件（支持自由调整）
        const URL_LIST = context.env.URL_LIST;
        
        // 2. 获取URL列表
        const response = await fetch(URL_LIST);
        if (!response.ok) throw new Error(`获取URL列表失败: ${response.status}`);
        
        const text = await response.text();
        const urls = text.split('\n').filter(url => url.trim() !== '');
        if (urls.length === 0) throw new Error("URL列表为空");
        
        // 3. 随机选择一个URL
        const randomIndex = Math.floor(Math.random() * urls.length);
        const originalUrl = urls[randomIndex].trim();
        
        // 4. 生成签名URL
        const signedUrl = await generateSignedUrl(originalUrl);
        
        // 5. 返回307重定向
        return Response.redirect(signedUrl, 307);
        
    } catch (error) {
        return new Response(`错误: ${error.message}`, { status: 500 });
    }
}

// 生成签名URL的函数
async function generateSignedUrl(originalUrl) {
    // 解析URL获取路径部分
    const urlObj = new URL(originalUrl);
    const resourcePath = urlObj.pathname + urlObj.search;
    
    // 生成时间戳
    const timestamp = Math.floor(Date.now() / 1000).toString();

    // 获取密钥
    const secretKey = context.env.SECRET_KEY;
    
    // 生成签名
    const signStr = secretKey + resourcePath + timestamp;
    const token = await generateMD5(signStr);
    
    // 添加签名参数
    urlObj.searchParams.append("token", token);
    urlObj.searchParams.append("t", timestamp);
    
    return urlObj.toString();
}

// MD5生成函数
async function generateMD5(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("MD5", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}