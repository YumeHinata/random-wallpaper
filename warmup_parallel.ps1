# ====== 1. CONFIG AREA ======
# [CRITICAL] Force TLS 1.2/1.3 immediately so we can fetch the remote URL list safely
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13

$RemoteTxtUrl = "https://rdimg.yumehinata.com/urls.txt" # ✨ Fetch latest URLs from your server
$FailedLogPath = ".\failed_urls.txt"                    # ✨ Where to save stubborn failures
$Referer = "https://yumehinata.com/"
$UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
$MaxThreads = 5                                     # Concurrency limit (5-10 is recommended)
$MaxRounds = 5                                      # Max retry rounds before giving up

# ====== 2. FETCH REMOTE URL LIST ======
Write-Host "-> Fetching latest URL list from: $RemoteTxtUrl ..." -ForegroundColor Cyan
try {
    # Request the remote file
    $webResponse = Invoke-WebRequest -Uri $RemoteTxtUrl -Method Get -TimeoutSec 15 -ErrorAction Stop
    
    # Split content by line breaks, trim spaces, and remove empty/duplicate lines
    $pendingUrls = $webResponse.Content -split '\r?\n' | Where-Object { $_.Trim() -ne "" } | Select-Object -Unique
    $totalCount = $pendingUrls.Count
    
    if ($totalCount -eq 0) {
        Write-Warning "The remote URL file is empty! Nothing to warm up."
        return
    }
    Write-Host "-> [SUCCESS] Loaded $totalCount unique URLs from remote server." -ForegroundColor Green
    Write-Host "--------------------------------------------------------"
} catch {
    Write-Host "-> [CRITICAL ERROR] Failed to download URL list: $_" -ForegroundColor Red
    return
}

$round = 1

# ====== 3. CORE SCRIPT BLOCK FOR THREADS ======
$scriptBlock = {
    param($u, $ref, $ua)
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
    try {
        $res = Invoke-WebRequest -Uri $u -Headers @{"Referer"=$ref} -UserAgent $ua -Method Get -TimeoutSec 10 -ErrorAction Stop
        return [PSCustomObject]@{ Url = $u; Success = $true; Msg = "Status: $($res.StatusCode)" }
    } catch {
        $errMsg = "Timeout/Disconnect"
        if ($_.Exception.Response) { $errMsg = "Status: $($_.Exception.Response.StatusCode.value__)" }
        return [PSCustomObject]@{ Url = $u; Success = $false; Msg = $errMsg }
    }
}

# ====== 4. LOOP MULTI-ROUND ENGINE ======
while ($pendingUrls.Count -gt 0 -and $round -le $MaxRounds) {
    Write-Host "==> [Round $round] Remaining URLs to process: $($pendingUrls.Count)" -ForegroundColor Yellow
    
    # Init Runspace Pool
    $sessionState = [System.Management.Automation.Runspaces.InitialSessionState]::CreateDefault()
    $pool = [RunspaceFactory]::CreateRunspacePool(1, $MaxThreads, $sessionState, $Host)
    $pool.Open()
    $jobs = New-Object System.Collections.Generic.List[Object]

    # Distribute Tasks
    foreach ($url in $pendingUrls) {
        $ps = [PowerShell]::Create().AddScript($scriptBlock).AddArgument($url.Trim()).AddArgument($Referer).AddArgument($UserAgent)
        $ps.RunspacePool = $pool
        $handle = $ps.BeginInvoke()
        $jobs.Add([PSCustomObject]@{ Instance = $ps; Handle = $handle })
    }

    # Collect and Analyze Results
    $failedUrls = New-Object System.Collections.Generic.List[String]
    
    foreach ($job in $jobs) {
        $result = $job.Instance.EndInvoke($job.Handle)
        if ($result.Success) {
            Write-Host "   [SUCCESS] $($result.Msg) | $($result.Url)" -ForegroundColor Green
        } else {
            Write-Host "   [FAILED]  $($result.Msg) | $($result.Url) (Will retry next round)" -ForegroundColor Red
            $failedUrls.Add($result.Url)
        }
        $job.Instance.Dispose()
    }

    # Shutdown current pool
    $pool.Close()
    $pool.Dispose()

    # Pass the baton to the next round
    $pendingUrls = $failedUrls
    $round++
    Write-Host "--------------------------------------------------------"
}

# ====== 5. FINAL EXPORT & REPORT ======
if ($pendingUrls.Count -eq 0) {
    Write-Host "-> [ALL SUCCESS] Magnificent! All images are 100% cached into CDN." -ForegroundColor Green
    # Clean up old failure logs from previous days if everything is clean now
    if (Test-Path $FailedLogPath) { Remove-Item $FailedLogPath }
} else {
    Write-Host "-> [WARNING] Reached max retry rounds. $($pendingUrls.Count) URLs still failed." -ForegroundColor Yellow
    try {
        # ✨ Export remaining bad URLs to local txt file
        $pendingUrls | Out-File -FilePath $FailedLogPath -Encoding utf8
        Write-Host "-> [LOGGED] Stubborn failures successfully written to: $FailedLogPath" -ForegroundColor Cyan
        Write-Host "-> Please check this file manually to filter deleted or blocked assets." -ForegroundColor Cyan
    } catch {
        Write-Host "-> Failed to write log file: $_" -ForegroundColor Red
    }
}