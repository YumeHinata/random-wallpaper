# 随机图 API - CDN 缓存优化

## 架构说明

### 新架构（带 CDN 缓存）

```
用户请求: /random-wallpaper
  ↓
边缘函数: 随机选择 Pixiv ID
  ↓
302 重定向: /img/{id}.jpg
  ↓
用户浏览器: 请求 /img/{id}.jpg
  ↓
CDN 检查:
  ├─ 缓存命中 → 直接返回 (~50ms) ✅
  └─ 缓存未命中 → 边缘函数回源 Pixiv → 缓存并返回 (~3s)
```

### 关键特性

1. **真随机性**: 每次 `/random-wallpaper` 都随机选择不同的图片
2. **CDN 缓存**: 具体图片 URL (`/img/{id}.jpg`) 可被 CDN 缓存 7 天
3. **不暴露源站**: 用户只能看到 `rdimg.yumehinata.com`，不会看到 `pximg` URL
4. **预热支持**: 通过脚本预访问所有图片，提前填充 CDN 缓存

## 缓存配置

- **缓存时长**: 7 天 (604800 秒)
- **缓存头**: 
  ```
  Cache-Control: public, max-age=604800
  CDN-Cache-Control: public, max-age=604800
  ```

## 预热脚本

### 使用方法

```bash
# 默认配置
./warmup_cdn.sh

# 自定义配置
./warmup_cdn.sh https://rdimg.yumehinata.com/urls.txt https://rdimg.yumehinata.com
```

### 建议频率

- **每周一次**: 确保所有图片都在 CDN 缓存中
- **预热时间**: 建议在凌晨低峰期执行
- **并发数**: 默认 5，可根据带宽调整

### 预热效果

- 预热后，80%+ 的请求会命中 CDN 缓存
- 响应时间从 ~3s 降低到 ~50ms
- 显著减少源站压力和超时风险

## 性能对比

| 场景 | 旧方案 (no-store) | 新方案 (CDN 缓存) |
|------|------------------|-------------------|
| 首次访问 | ~3s | ~3s |
| 再次访问（同图） | ~3s | ~50ms ✅ |
| 预热后随机访问 | ~3s | ~50ms ✅ |
| 边缘函数调用 | 1 次 | 1-2 次 |
| 源站压力 | 高 | 低（缓存命中时不回源） |

## 监控缓存命中率

通过响应头判断：

```bash
curl -I https://rdimg.yumehinata.com/img/12345678.jpg
```

查看 `X-Cache` 或 `Cache` 头：
- `HIT`: 缓存命中 ✅
- `MISS`: 缓存未命中（会回源）

## 注意事项

1. **CDN 缓存容量**: EdgeOne 免费计划的缓存容量有限，大图片列表可能无法全部缓存
2. **缓存淘汰**: 不常访问的图片可能被淘汰，需要定期预热
3. **边缘函数调用数**: 新方案可能增加调用次数（重定向 + 图片获取），需监控配额
4. **预热脚本并发**: 过高并发可能触发限流，建议 5-10 并发

## 回滚方案

如需回滚到旧方案（无 CDN 缓存），使用 Git 恢复到之前的版本：

```bash
git log --oneline  # 找到之前的 commit
git checkout <commit-hash> -- edge-functions/random-wallpaper.js
git commit -m "Revert: 回滚到无缓存版本"
git push
```
