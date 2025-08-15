# DEMO
https://rdimg.yumehinata.com
# 概述
这是一个基于edgeone pages function的随机图片api的项目。只需要下载这个仓库的文件或者发布的版本，部署到edgeone pages完成项目设置即可使用。
# 使用方式
1. 由于项目原版为个人pixiv随机图片专用，所以不可避免存在一部分你可能用不上的代码（比如`pixiv.js`），你可以直接删掉这个js文件或者删除`/functions/index.js`第215行`<script src="../pixiv.js"></script>`即可移除这些对你无用的功能。
2. 在edgeone pages的项目设置中添加以下变量：
- `URL_LIST`的值应该为一个URL链接，链接到一个txt文本文件，文本文件内每行写一个图片URL链接。
- `INDEX_TITLE`的值为一个字符串，用来控制首页的title标题，在这里填入你想要的网页标题。
- `OVERVIEW_HTML`的值应该为html格式，这里填入你对这个随机图片api的概述。例如：
    <p>此API提供来自Pixiv社区的随机图片，所有图片版权归原作者所有。</p><p>API仅提供图片展示服务，请勿用于商业用途。</p>
- `TOKEN_TYPE`的值可以选择`0`、`A`、`D`。0代表无需添加token鉴权功能，A、D对应这个edgeone的token鉴权A鉴权与D鉴权。需要注意的是鉴权的设置中时间格式应该为十进制（时间戳），鉴权加密串参数名称统一为`token`，鉴权时间戳参数名称为`t`。
- `SECRET_KEY`的值请填入`主鉴权密钥`。如果你不使用token鉴权值填写`0`。
3.需要注意环境变量的变更将在下一次部署时生效。所以在修改或添加环境变量后立刻新建部署，并且删掉旧的部署。
4.如果你使用的是国际站edgeone，请在项目设置-域名管理中绑定自己的域名。