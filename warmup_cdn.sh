#!/bin/bash
# 随机图 API CDN 预热脚本
# 用法: ./warmup_cdn.sh [URL_LIST_URL] [BASE_URL]
#
# 示例:
#   ./warmup_cdn.sh
#   ./warmup_cdn.sh https://rdimg.yumehinata.com/urls.txt https://rdimg.yumehinata.com

# 配置
URL_LIST_URL="${1:-https://rdimg.yumehinata.com/urls.txt}"
BASE_URL="${2:-https://rdimg.yumehinata.com}"
CONCURRENT=5  # 并发数

echo "=========================================="
echo "随机图 API CDN 预热脚本"
echo "=========================================="
echo "URL 列表: $URL_LIST_URL"
echo "目标域名: $BASE_URL"
echo "并发数: $CONCURRENT"
echo ""

# 下载 URL 列表
echo "[1/3] 下载 URL 列表..."
TEMP_FILE=$(mktemp)
curl -s "$URL_LIST_URL" -o "$TEMP_FILE"

if [ ! -s "$TEMP_FILE" ]; then
    echo "错误: 无法下载 URL 列表"
    exit 1
fi

TOTAL=$(wc -l < "$TEMP_FILE" | tr -d ' ')
echo "共 $TOTAL 个图片 URL"
echo ""

# 提取 Pixiv ID 并预热
echo "[2/3] 开始预热 CDN 缓存..."
echo ""

# 创建临时目录用于并发控制
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

count=0
success=0
fail=0

while IFS= read -r url; do
    # 跳过空行
    [ -z "$url" ] && continue
    
    # 提取 Pixiv ID
    pixiv_id=$(echo "$url" | grep -oP '/\K\d+(?=_p\d+_)')
    
    if [ -z "$pixiv_id" ]; then
        echo "  [跳过] 无法提取 ID: $url"
        ((fail++))
        continue
    fi
    
    # 并发控制
    while [ $(ls -1 "$TEMP_DIR" 2>/dev/null | wc -l) -ge $CONCURRENT ]; do
        sleep 0.1
    done
    
    # 后台请求
    (
        if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/img/$pixiv_id.jpg" | grep -q "200"; then
            echo "  [✓] $pixiv_id.jpg"
            touch "$TEMP_DIR/$pixiv_id.success"
        else
            echo "  [✗] $pixiv_id.jpg"
            touch "$TEMP_DIR/$pixiv_id.fail"
        fi
    ) &
    
    ((count++))
    
    # 进度显示
    if [ $((count % 100)) -eq 0 ]; then
        echo "--- 进度: $count / $TOTAL ---"
    fi
    
done < "$TEMP_FILE"

# 等待所有后台任务完成
wait

echo ""
echo "[3/3] 统计结果..."
success=$(ls -1 "$TEMP_DIR"/*.success 2>/dev/null | wc -l | tr -d ' ')
fail=$(ls -1 "$TEMP_DIR"/*.fail 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "=========================================="
echo "预热完成！"
echo "=========================================="
echo "总计: $count"
echo "成功: $success"
echo "失败: $fail"
echo "=========================================="

# 清理临时文件
rm -f "$TEMP_FILE"
