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

        // 4. 生成签名URL - 将环境变量传递给签名函数
        const TOKEN_TYPE = context.env.TOKEN_TYPE || "0";
        const SECRET_KEY = context.env.SECRET_KEY || "";
        const signedUrl = await generateSignedUrl(originalUrl, TOKEN_TYPE, SECRET_KEY);

        // 5. 返回307重定向
        return Response.redirect(signedUrl, 307);

    } catch (error) {
        return new Response(`错误: ${error.message}`, { status: 500 });
    }
}

// 生成签名URL的函数 - 添加tokenType和secretKey参数
async function generateSignedUrl(originalUrl, tokenType, secretKey) {
    // 解析URL获取路径部分
    var urlObj;
    try {
        urlObj = new URL(originalUrl);
    } catch (e) {
        throw new Error(`URL解析失败: ${originalUrl}`);
    }
    
    var resourcePath = urlObj.pathname + urlObj.search;
    // 生成时间戳
    var timestamp = Math.floor(Date.now() / 1000).toString();
    //生成0-100位随机字符串
    var randomString = Math.random().toString(36).substring(2, 102);
    //判断是否需要鉴权
    if (tokenType != "0") {
        switch (tokenType) {
            case "D":
                // 处理D类型的鉴权
                // 生成签名
                var signStr = secretKey + resourcePath + timestamp;
                var token = await generateMD5(signStr);
                urlObj.searchParams.append("token", token);
                urlObj.searchParams.append("t", timestamp);
                return urlObj.toString();
            case "A":
                // 处理A类型的鉴权
                // 生成签名
                // signStr = secretKey + resourcePath + timestamp + randomString;
                var signStr = resourcePath + "-" + randomString + "-" + "0" + "-" + secretKey;
                var MD5Token = await generateMD5(signStr);
                token = timestamp + "-" + randomString + "-" + "0" + "-" + MD5Token;
                urlObj.searchParams.append("token", token);
                return urlObj.toString();
        }   
    }else{
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