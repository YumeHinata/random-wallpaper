#!/bin/bash

# ====== 1. CONFIG AREA ======
REMOTE_TXT_URL="https://rdimg.yumehinata.com/urls.txt" # ✨ Fetch latest URLs from your server
FAILED_LOG_PATH="./failed_urls.txt"                    # ✨ Where to save stubborn failures
REFERER="https://yumehinata.com/"
USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
MAX_THREADS=5                                         # Concurrency limit (5-10 is recommended)
MAX_ROUNDS=5                                          # Max retry rounds before giving up

# ANSI Colors for terminal output
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
RESET='\033[0m'

# ====== 2. FETCH REMOTE URL LIST ======
echo -e "${CYAN}-> Fetching latest URL list from: $REMOTE_TXT_URL ...${RESET}"

# 使用 curl 获取远程内容 (Debian 现代版的 curl 默认强制并首选 TLS 1.2/1.3)
content=$(curl -sSL --connect-timeout 15 -A "$USER_AGENT" "$REMOTE_TXT_URL")
if [ $? -ne 0 ] || [ -z "$content" ]; then
    echo -e "${RED}-> [CRITICAL ERROR] Failed to download URL list.${RESET}"
    exit 1
fi

# 切分行、去除 CR 换行符、修剪前后空格、过滤空行并去重（保留原始顺序）
mapfile -t pending_urls < <(echo "$content" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' | grep -v '^$' | awk '!seen[$0]++')
total_count=${#pending_urls[@]}

if [ $total_count -eq 0 ]; then
    echo -e "${YELLOW}The remote URL file is empty! Nothing to warm up.${RESET}"
    exit 0
fi

echo -e "${GREEN}-> [SUCCESS] Loaded $total_count unique URLs from remote server.${RESET}"
echo "--------------------------------------------------------"

round=1

# ====== 4. LOOP MULTI-ROUND ENGINE ======
while [ ${#pending_urls[@]} -gt 0 ] && [ $round -le $MAX_ROUNDS ]; do
    echo -e "${YELLOW}==> [Round $round] Remaining URLs to process: ${#pending_urls[@]}${RESET}"
    
    # 初始化线程池需要的命名管道 (Token Bucket 信号量机制)
    FIFO=$(mktemp -u)
    mkfifo "$FIFO"
    exec 3<>"$FIFO"
    rm -f "$FIFO" # 内存中保留句柄，隐式释放文件指针避免残留
    
    # 注入并发令牌数量
    for ((i=0; i<MAX_THREADS; i++)); do echo; done >&3

    # 用于按原始提交顺序记录结果和收集失败的临时变量
    declare -a round_res_files
    round_failed_file=$(mktemp)

    # Distribute Tasks (分发任务)
    for url in "${pending_urls[@]}"; do
        read -u3 # 消耗一个令牌，若无令牌则在此阻塞（控并发）
        
        res_file=$(mktemp)
        round_res_files+=("$res_file")
        
        # ====== 3. CORE BLOCK FOR THREADS (后台子进程) ======
        (
            # 发送请求，-L 跟随重定向，-w 获取最终状态码，-m 10 秒超时
            http_status=$(curl -sL -o /dev/null -w "%{http_code}" -m 10 -H "Referer: $REFERER" -A "$USER_AGENT" "$url")
            curl_res=$?
            
            # 判断成功与失败 (Invoke-WebRequest 默认 2xx-3xx 为成功，4xx/5xx 或网络异常会抛错)
            if [ $curl_res -eq 0 ] && [ "$http_status" -ge 200 ] && [ "$http_status" -lt 400 ]; then
                echo "true|Status: $http_status|$url" > "$res_file"
            else
                if [ $curl_res -eq 28 ] || [ "$http_status" -eq 0 ]; then
                    echo "false|Timeout/Disconnect|$url" > "$res_file"
                else
                    echo "false|Status: $http_status|$url" > "$res_file"
                fi
            fi
            
            echo >&3 # 归还令牌
        ) &
    done

    # 等待当前轮次所有后台任务结束
    wait
    exec 3>&- # 关闭管道句柄

    # Collect and Analyze Results (严格按照原始顺序输出和解析)
    for res_file in "${round_res_files[@]}"; do
        if [ -s "$res_file" ]; then
            IFS='|' read -r success msg url < "$res_file"
            if [ "$success" = "true" ]; then
                echo -e "   ${GREEN}[SUCCESS] $msg | $url${RESET}"
            else
                echo -e "   ${RED}[FAILED]  $msg | $url (Will retry next round)${RESET}"
                echo "$url" >> "$round_failed_file"
            fi
        fi
        rm -f "$res_file" # 释放单个临时文件
    done

    # Pass the baton to the next round
    mapfile -t pending_urls < "$round_failed_file"
    rm -f "$round_failed_file"
    
    round=$((round + 1))
    echo "--------------------------------------------------------"
done

# ====== 5. FINAL EXPORT & REPORT ======
if [ ${#pending_urls[@]} -eq 0 ]; then
    echo -e "${GREEN}-> [ALL SUCCESS] Magnificent! All images are 100% cached into CDN.${RESET}"
    if [ -f "$FAILED_LOG_PATH" ]; then rm -f "$FAILED_LOG_PATH"; fi
else
    echo -e "${YELLOW}-> [WARNING] Reached max retry rounds. ${#pending_urls[@]} URLs still failed.${RESET}"
    
    # ✨ Export remaining bad URLs to local txt file
    printf "%s\n" "${pending_urls[@]}" > "$FAILED_LOG_PATH" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo -e "${CYAN}-> [LOGGED] Stubborn failures successfully written to: $FAILED_LOG_PATH${RESET}"
        echo -e "${CYAN}-> Please check this file manually to filter deleted or blocked assets.${RESET}"
    else
        echo -e "${RED}-> Failed to write log file.${RESET}"
    fi
fi