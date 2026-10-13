param([int]$BackendPort = 5000, [int]$FrontendPort = 5173)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$backendRoot = Join-Path $projectRoot 'backend'
$frontendRoot = Join-Path $projectRoot 'frontend'
$demoPython = Join-Path $backendRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $demoPython)) { throw 'Create backend/.venv and install backend/requirements.txt first. See README.' }
if (-not (Test-Path -LiteralPath (Join-Path $frontendRoot 'node_modules/vite/bin/vite.js'))) { throw 'Run npm.cmd install from frontend first.' }
$demoNode = (Get-Command node -ErrorAction Stop).Source
foreach ($port in @($BackendPort, $FrontendPort)) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { throw "Port $port is occupied. Stop the existing project server or pass another port." }
}
$originalDemo = $env:DEMO_ENABLED
$originalEmitter = $env:DEMO_EMITTER_ENABLED
$originalProxy = $env:API_PROXY_TARGET
$ownedProcesses = @()
try {
    $env:DEMO_ENABLED = 'true'
    $env:DEMO_EMITTER_ENABLED = 'true'
    $env:API_PROXY_TARGET = "http://127.0.0.1:$BackendPort"
    New-Item -ItemType Directory -Force -Path (Join-Path $backendRoot '.tmp'), (Join-Path $frontendRoot '.tmp') | Out-Null
    Push-Location $backendRoot
    try {
        & $demoPython -m flask --app app prepare-demo
        if ($LASTEXITCODE -ne 0) { throw 'Demo preparation failed; no servers started.' }
    } finally { Pop-Location }
    $ownedProcesses += Start-Process -FilePath $demoPython -ArgumentList @('-m','app.demo_worker') -WorkingDirectory $backendRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $backendRoot '.tmp/worker.stdout.log') -RedirectStandardError (Join-Path $backendRoot '.tmp/worker.stderr.log')
    $ownedProcesses += Start-Process -FilePath $demoPython -ArgumentList @('-m','flask','--app','app','run','--no-reload','--host','127.0.0.1','--port',"$BackendPort") -WorkingDirectory $backendRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $backendRoot '.tmp/dev.stdout.log') -RedirectStandardError (Join-Path $backendRoot '.tmp/dev.stderr.log')
    $ownedProcesses += Start-Process -FilePath $demoNode -ArgumentList @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',"$FrontendPort",'--strictPort') -WorkingDirectory $frontendRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $frontendRoot '.tmp/dev.stdout.log') -RedirectStandardError (Join-Path $frontendRoot '.tmp/dev.stderr.log')
    Write-Host "Demo dashboard: http://127.0.0.1:$FrontendPort"
    Write-Host 'Starting API and one simulator worker. Ctrl+C stops this launcher and its child processes.'
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($ownedProcesses | Where-Object HasExited) { throw 'A project process exited; inspect backend/.tmp and frontend/.tmp logs.' }
        try {
            $session = Invoke-RestMethod "http://127.0.0.1:$BackendPort/api/summary" -TimeoutSec 1
            $page = Invoke-WebRequest "http://127.0.0.1:$FrontendPort/" -UseBasicParsing -TimeoutSec 1
            if ($session.demo_session.emitter_status -eq 'running' -and $page.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw 'Startup timed out; inspect the project logs.' }
    Write-Host 'Ready: persistent simulated scenarios, VIT Vellore catalogue, 30-second telemetry.'
    while ($true) {
        if ($ownedProcesses | Where-Object HasExited) { throw 'A project process exited; stop and inspect logs before restarting.' }
        Start-Sleep -Milliseconds 500
    }
} finally {
    foreach ($process in $ownedProcesses) {
        if (-not $process.HasExited) { & taskkill /PID $process.Id /T /F 2>$null | Out-Null }
    }
    $env:DEMO_ENABLED = $originalDemo
    $env:DEMO_EMITTER_ENABLED = $originalEmitter
    $env:API_PROXY_TARGET = $originalProxy
}
