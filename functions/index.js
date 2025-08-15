// /functions/index.js
export async function onRequestGet(context) {
    try {
        // 只获取需要的环境变量
        const URL_LIST = context.env.URL_LIST || "";
        
        // 动态获取当前请求的主域名
        const requestUrl = new URL(context.request.url);
        const domain = requestUrl.hostname;
        const API_BASE_URL = `https://${domain}`;
        
        // 读取并修改原始HTML
        const response = await fetch(context.env.ASSETS);
        let html = await response.text();
        
        // 最小化修改：只替换必要的部分
        html = html
            // 替换API地址为当前域名
            .replace(
                'https://rdimg.yumehinata.com/random-wallpaper', 
                `${API_BASE_URL}/random-wallpaper`
            )
            // 注入URL_LIST环境变量
            .replace(
                'urlTXT = context.env.URL_LIST',
                `urlTXT = "${URL_LIST}"`
            )
            // 移除其他不需要的环境变量访问
            .replace(/context\.env\.[A-Z_]+/g, '""');
        
        // 返回修改后的HTML
        return new Response(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
    } catch (error) {
        return new Response(`生成页面时出错: ${error.message}`, { status: 500 });
    }
}