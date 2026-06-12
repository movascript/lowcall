# cloud.ps1
# Usage:
#   cloud deploy              -> deploy client and server
#   cloud deploy -client      -> client only
#   cloud deploy -server      -> server only
#   cloud rollback            -> rollback client and server
#   cloud rollback -client    -> client only
#   cloud rollback -server    -> server only

param(
    [Parameter(Position = 0, Mandatory = $false)]
    [string]$Action,

    [switch]$client,
    [switch]$server
)

# Validate action manually so we can show a clean usage message
if (-not $Action -or ($Action -ne "deploy" -and $Action -ne "rollback")) {
    Write-Host ""
    Write-Host "  cloud.ps1 - Deployment tool" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Usage:" -ForegroundColor Yellow
    Write-Host "    cloud deploy              deploy client and server"
    Write-Host "    cloud deploy -client      client only"
    Write-Host "    cloud deploy -server      server only"
    Write-Host "    cloud rollback            rollback client and server"
    Write-Host "    cloud rollback -client    client only"
    Write-Host "    cloud rollback -server    server only"
    Write-Host ""
    Write-Host "  ERROR: first argument must be 'deploy' or 'rollback'" -ForegroundColor Red
    Write-Host ""
    exit 1
}

# Load .env
$envFile = Join-Path $PSScriptRoot ".env"

if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env not found in $PSScriptRoot" -ForegroundColor Red
    Write-Host "       Create a .env file with DEPLOY_HOST_USER and DEPLOY_HOST_IP" -ForegroundColor Red
    exit 1
}

Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*#" -or $_ -match "^\s*$") { return }
    $parts = $_ -split "=", 2
    if ($parts.Length -eq 2) {
        Set-Item -Path "Env:$($parts[0].Trim())" -Value $parts[1].Trim()
    }
}

$HOST_USER = $env:DEPLOY_HOST_USER
$HOST_IP   = $env:DEPLOY_HOST_IP

if (-not $HOST_USER -or -not $HOST_IP) {
    Write-Host "ERROR: DEPLOY_HOST_USER or DEPLOY_HOST_IP missing in .env" -ForegroundColor Red
    exit 1
}

$SSH  = "${HOST_USER}@${HOST_IP}"
$both = -not ($client -or $server)

# Logging helpers

function Step($msg)    { Write-Host "  >> $msg" -ForegroundColor Gray }
function Ok($msg)      { Write-Host "  OK $msg" -ForegroundColor Green }
function Fail($msg)    { Write-Host "  FAIL $msg" -ForegroundColor Red }
function Section($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }

# Runners

function Run-Remote($label, $cmd) {
    Step $label
    $output = ssh $SSH $cmd 2>&1
    if ($LASTEXITCODE -ne 0) {
        Fail $label
        Write-Host $output -ForegroundColor DarkRed
        throw "Remote step failed: $label"
    }
    Ok $label
}

function Run-Local($label, $scriptBlock) {
    Step $label
    try {
        & $scriptBlock
        if ($LASTEXITCODE -ne 0) { throw "Exit code $LASTEXITCODE" }
        Ok $label
    } catch {
        Fail $label
        Write-Host "  $_" -ForegroundColor DarkRed
        throw
    }
}

# Actions

function Deploy-Client {
    Section "Deploy Client"

    Run-Local "Build client" {
        Push-Location client
        pnpm run build
        Pop-Location
    }

    Run-Local "Upload dist to server" {
        scp -r client/dist "${SSH}:/tmp/dist"
    }

    Run-Remote "Backup current client" `
        "sudo cp -r /var/www/lowcall-client /var/backups/lowcall-client/backup-`$(date +%Y%m%d-%H%M%S)"

    Run-Remote "Clear web root" `
        "sudo rm -rf /var/www/lowcall-client/*"

    Run-Remote "Copy new build to web root" `
        "sudo cp -r /tmp/dist/* /var/www/lowcall-client"

    Run-Remote "Clean up temp files" `
        "sudo rm -rf /tmp/dist"
}

function Deploy-Server {
    Section "Deploy Server"

    Run-Local "Upload server.js" {
        scp server/server.js "${SSH}:/tmp/server.js"
    }

    Run-Remote "Backup current server.js" `
        "sudo cp /var/www/lowcall-server/server.js /var/backups/lowcall-server/server.js.backup-`$(date +%Y%m%d-%H%M%S)"

    Run-Remote "Copy new server.js" `
        "sudo cp /tmp/server.js /var/www/lowcall-server/server.js"

    Run-Remote "Clean up temp files" `
        "sudo rm -f /tmp/server.js"

    Run-Remote "Restart pm2" `
        "pm2 restart all"
}

function Rollback-Client {
    Section "Rollback Client"

    Run-Remote "Restore last client backup" `
        "sudo cp -r `$(ls -td /var/backups/lowcall-client/backup-* | head -1)/* /var/www/lowcall-client/"
}

function Rollback-Server {
    Section "Rollback Server"

    Run-Remote "Restore last server.js backup" `
        "sudo cp `$(ls -t /var/backups/lowcall-server/server.js.backup-* | head -1) /var/www/lowcall-server/server.js"

    Run-Remote "Restart pm2" `
        "pm2 restart all"
}

# Main

Write-Host "cloud $Action -- target: $SSH" -ForegroundColor DarkGray

try {
    if ($Action -eq "deploy") {
        if ($both -or $client) { Deploy-Client }
        if ($both -or $server) { Deploy-Server }
    } else {
        if ($both -or $client) { Rollback-Client }
        if ($both -or $server) { Rollback-Server }
    }

    Write-Host "`nAll steps completed successfully." -ForegroundColor Green

} catch {
    Write-Host "`nAborted -- fix the error above and retry." -ForegroundColor Red
    exit 1
}