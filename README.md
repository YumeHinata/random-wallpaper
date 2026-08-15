# DEMO
https://rdimg.yumehinata.com
# 概述
这是一个基于 edgeone pages function 的随机图片 api 的项目。只需要下载这个仓库的文件或者发布的版本，部署到 edgeone pages 完成项目设置即可使用。
# 项目结构
- `index.html`：静态首页（Pixiv 登录页风格：全屏图片轮播 + 中部说明卡片 + 右下角作品信息卡）。本地双击即可预览风格，部署后即线上首页。
- `style.css` / `pixiv.js`：首页样式与前端逻辑（双图层交叉淡入淡出、/meta 动态注入、信息卡拉取）
- `edge-functions/random-wallpaper.js`：图片 API（随机 307/流式反代返回，URL 简洁）
- `edge-functions/meta.js`：`/meta` 接口，向首页提供动态配置（标题、概述、URL 数量）
- `edge-functions/pixiv-info.js`：`/pixiv-info?id=xxx` 接口，边缘节点代拉 Pixiv 作品信息（解决 pixiv 域名污染，客户端不直连 pixiv；信息接口独立，不影响图片 API 性能）
# 使用方式
1. 首页为纯静态页面（本地可直接打开 `index.html` 预览风格）。动态内容通过 `/meta` 接口注入，无需修改前端代码。
2. 在 edgeone pages 的项目设置中添加以下变量：
- `URL_LIST`的值应该为一个URL链接，链接到一个txt文本文件，文本文件内每行写一个图片URL链接。
- `INDEX_TITLE`的值为一个字符串，用来控制首页的title标题，在这里填入你想要的网页标题。
- `OVERVIEW_HTML`的值应该为html格式，这里填入你对这个随机图片api的概述。例如：
    <p>此API提供来自Pixiv社区的随机图片，所有图片版权归原作者所有。</p><p>API仅提供图片展示服务，请勿用于商业用途。</p>
- `TOKEN_TYPE`的值可以选择`0`、`A`、`D`。0代表无需添加token鉴权功能，A、D对应这个edgeone的token鉴权A鉴权与D鉴权。需要注意的是鉴权的设置中时间格式应该为十进制（时间戳），鉴权加密串参数名称统一为`token`，鉴权时间戳参数名称为`t`。
- `SECRET_KEY`的值请填入`主鉴权密钥`。如果你不使用token鉴权值填写`0`。
3.需要注意环境变量的变更将在下一次部署时生效。所以在修改或添加环境变量后立刻新建部署，并且删掉旧的部署。
4.如果你使用的是国际站edgeone，请在项目设置-域名管理中绑定自己的域名。
# 附加接口
- `GET /meta`：返回 `{ "title": ..., "overview": ..., "count": N }`，首页启动时自动拉取。
- `GET /pixiv-info?id=作品ID`：返回 `{ "ok": true, "id", "title", "userName", "userId" }`。优先走 Pixiv 公开 oEmbed 接口，失败自动降级 ajax 接口；服务端 10 分钟内存缓存，附带浏览器缓存头，对图片 API 零影响。
