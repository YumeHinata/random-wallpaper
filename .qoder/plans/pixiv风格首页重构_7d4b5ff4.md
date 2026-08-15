# Pixiv 风格首页重构计划

## 摘要
- 保持 `random-wallpaper.js` 的图片反代机制不变（简洁 URL 流式返回），仅修复其 `X-Pixiv-Id` 响应头设置语句位于 `return` 之后（死代码）导致前端拿不到作品 ID 的 bug。
- 首页改为**纯静态 `index.html`**（本地双击验证 = 线上效果），动态内容（`INDEX_TITLE`、`OVERVIEW_HTML`、URL 数量）通过新增轻量接口 `/meta` 在客户端拉取注入，环境变量语义不变（部署时固化，刷新即生效）。
- 新增独立边缘函数 `/pixiv-info` 反向代理 pixiv ajax 接口获取作品标题/作者/ID（解决 pixiv 域名被污染问题），完全不进入图片请求链路，不影响 API 性能。
- 图标全部内联 SVG（取自字节 IconPark 开源库的几何扁平风格图标），零外部依赖。
- 页面布局逐项复刻 pixiv 登录页实测数据（见下）。

## 文件变更

### 1. 新建 `index.html`（项目根目录，静态首页）
pixiv 登录页结构复刻：
- `position: fixed; inset:0` 的全屏背景容器，内放**两个背景图层 div**（`background-size: cover; background-position: 50% 0`），JS 控制 `opacity` 交叉淡入淡出（`transition: opacity 1s`）
- 中部白色说明卡片：`margin: 0 auto` 水平居中 + `padding-top: 20vh` 垂直定位；桌面 392px 宽、24px 圆角、纯白底、无阴影、`padding: 0 40px 40px`；内容自上而下：标题（INDEX_TITLE）→ 概述（OVERVIEW_HTML）→ API 地址 code 块 + 一键复制按钮 → URL 收录数量徽章 → 「获取新图片」按钮
- 顶部右上角换图按钮：`rgba(0,0,0,0.32)` 半透明黑底、白字、`border-radius: 999999px`、40px 高（复刻 pixiv「注册账号」按钮）
- 右下角透明信息卡：`position: absolute; bottom:48px; right:16px; background: rgba(0,0,0,0.32); padding: 8px 16px`（复刻 pixiv 背景图作品信息悬浮卡），显示作品标题、作者、作品 ID，点击跳转 `https://www.pixiv.net/artworks/{id}`
- 底部固定页脚 32px：`background: rgba(0,0,0,0.88)`，放版权声明 + 图片来源说明
- 与 pixiv 的**一处工程差异**：由于随机图亮度不可控，背景层与内容之间加一层极淡的底部暗色渐变（`linear-gradient(transparent, rgba(0,0,0,0.45))`）保证卡片与信息卡可读性
- 内联默认值兜底：HTML 中直接写死默认标题/概述/示例 API 地址（本地 file:// 打开即可正常显示），`pixiv.js` 拉取 `/meta` 成功后替换；API 地址取 `location.origin`（file:// 协议时用内置示例地址）
- 引用 `style.css`、`pixiv.js`、`/g1logo4.png` favicon

### 2. 重写 `style.css`
- 删除旧版粒子/容器布局样式，全部重写为上述 pixiv 风格布局（背景层、卡片、pill 按钮、信息卡、页脚、加载指示器、切换动画）
- 几何主义扁平风：无阴影、大圆角（24px / 999999px pill）、纯色块、细分割线、IconPark 内联 SVG 统一 16-20px
- 响应式：`@media (max-width: 768px)` 下卡片宽度 `calc(100% - 32px)`、`padding-top: 12vh`；`max-height: 700px` 时压缩卡片垂直留白
- 保留现有 `.notification` 顶部通知条样式（提示「图片尚未加载完成」等）

### 3. 重写 `pixiv.js`（前端全部逻辑）
- **meta 注入**：`fetch('/meta')` → 注入 `document.title`、卡片标题、概述 HTML、URL 数量；失败静默保留 HTML 默认值（不阻塞页面）
- **图片加载**：`fetch(location.origin + '/random-wallpaper?t=' + Date.now(), {cache:'no-store'})` → blob → objectURL；从响应头读取 `X-Pixiv-Id`
- **双图层轮播**（复刻 pixiv）：两层背景 div，当前层显示图片；定时 12s 触发下一次切换：先预加载下一张（fetch blob → `new Image()` 解码完成确认），再旧层淡出（1s）→ 交换图层 → 更新信息卡；加载失败跳过本次切换并保留旧图
- **信息卡**：拿到 `X-Pixiv-Id` 后异步 `fetch('/pixiv-info?id=' + id)`（内置 5s AbortController 超时）→ 渲染标题/作者/ID；请求失败或解析失败 → 隐藏信息卡（不影响图片展示，符合「不拖累 API」要求）；点击卡片 → `window.open('https://www.pixiv.net/artworks/' + id)`
- **手动换图**：顶部按钮点击立即触发一次轮播切换（带按钮旋转反馈动画）
- 保留 objectURL 内存释放（`URL.revokeObjectURL`）、错误通知等既有细节
- 注意：旧版 `edge-functions/index.js` 内嵌脚本中重复声明 `pixivId`、缩进错乱等问题随重写一并消除

### 4. 新建 `edge-functions/meta.js`（路由 `/meta`）
- 读取 `INDEX_TITLE`、`OVERVIEW_HTML`、`URL_LIST` 环境变量（默认值与旧 `index.js` 一致）
- URL 计数逻辑从旧 `edge-functions/index.js` 迁移（拉取 URL_LIST 统计行数，10 分钟内存缓存 + 容灾复用旧值）
- 返回 JSON：`{ title, overview, count }`；响应头：`Content-Type: application/json`、`Access-Control-Allow-Origin: *`、`Cache-Control: no-store`
- 平铺于 `edge-functions/` 目录（与现有 index.js、random-wallpaper.js 同级，沿用已验证的路由方式，避免子目录路由不确定性）

### 5. 新建 `edge-functions/pixiv-info.js`（路由 `/pixiv-info`）
- 参数：`?id=作品ID`（校验纯数字，防止注入）
- 向 `https://www.pixiv.net/ajax/illust/{id}?_lang=zh` 发起请求，携带 `User-Agent`（浏览器 UA）与 `Referer: https://www.pixiv.net/`
- 解析响应提取基础字段：`title`、`userName`、`userId`、`createDate`；失败（非 200 / 无 body / 解析异常）返回 `{ ok:false }` 或 404
- 内存缓存 `Map<id, {data, ts}>`，TTL 10 分钟（作品信息基本不变，防频繁回源 pixiv）；响应头 `Cache-Control: public, max-age=600` + `Access-Control-Allow-Origin: *` + `Access-Control-Expose-Headers`
- 独立的 `onRequest` 处理函数，与图片反代完全隔离——即使 pixiv 被墙/超时也只影响该函数本身，图片 API 性能零影响

### 6. 修改 `edge-functions/random-wallpaper.js`
仅一处修复：将
```js
return new Response(imageResponse.body, { status: 200, headers: responseHeaders });
responseHeaders.set("X-Pixiv-Id", pixivId);
responseHeaders.set("Access-Control-Expose-Headers", "X-Pixiv-Id");
```
中位于 return 之后的两行 `set` 移到 return 之前（当前为不可达死代码，前端永远读不到 `X-Pixiv-Id`）。其余逻辑、URL 简洁方式、环境变量处理一律不动。

### 7. 删除 `edge-functions/index.js`
根路径 `/` 将自动回退到静态 `index.html`（EdgeOne Pages 静态资源托管），不再每次请求消耗边缘函数执行。

### 8. 更新 `README.md`
- 目录结构说明（新增 index.html、meta.js、pixiv-info.js）
- 环境变量说明不变（INDEX_TITLE / OVERVIEW_HTML / URL_LIST / TOKEN_TYPE / SECRET_KEY 语义完全保留）
- 新增 `/meta`、`/pixiv-info` 路由说明与本地验证方式（直接双击 index.html）

## 测试计划
1. 本地：双击 `index.html`（file:// 协议）→ 验证全屏背景、卡片布局、默认值兜底、换图按钮动画、双图层切换；确认无任何外部网络依赖报错（图标为内联 SVG）
2. 本地：`python -m http.server` 起静态服务验证 origin 自动适配
3. 部署到 EdgeOne 后依次验证：`/` 返回静态首页；`/meta` 返回 JSON 且 title/overview 与环境变量一致；`/random-wallpaper` 响应头含 `X-Pixiv-Id`；`/pixiv-info?id=某已知ID` 返回标题/作者；首页信息卡正常显示、图片 API 响应速度与改动前一致
4. 移动端视口（375px 宽）检查卡片自适应

## 假设
- `edge-functions/` 目录的路由约定（EdgeOne Makers）保持不变，新增平铺文件即可生效
- pixiv ajax 接口在 EdgeOne 边缘节点可达（图片源站 i.pximg.net 已能正常代理，同一网络路径）
- 保留现有环境变量名与语义，仅注入方式由服务端渲染改为客户端接口拉取