[CmdletBinding()]
param(
    [ValidateRange(1, 65535)][int]$FrontendPort = 3000,
    [ValidateRange(1, 65535)][int]$BackendPort = 8000
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$backendRoot = Join-Path $projectRoot 'backend'
$frontendRoot = Join-Path $projectRoot 'frontend'
$logRoot = Join-Path $projectRoot '.cache/logs'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$runStamp = Get-Date -Format 'yyyyMMdd-HHmmss'

function Test-Listening([int]$Port) {
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Wait-Ready([string]$Url, [int]$TimeoutSeconds = 90) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Milliseconds 750
    }
    throw "The service did not become ready at $Url. See logs in $logRoot."
}

$pythonCandidates = @(
    (Join-Path $backendRoot '.venv/Scripts/python.exe'),
    (Join-Path $backendRoot '.venv313/Scripts/python.exe'),
    (Join-Path $projectRoot '.venv-ml-run/Scripts/python.exe')
)
$systemPython = Get-Command python -ErrorAction SilentlyContinue
if ($systemPython) { $pythonCandidates += $systemPython.Source }
$pythonPath = $null
foreach ($candidate in $pythonCandidates) {
    if (Test-Path -LiteralPath $candidate) {
        & $candidate -c 'import fastapi, uvicorn, motor' 2>$null
        if ($LASTEXITCODE -eq 0) { $pythonPath = $candidate; break }
    }
}
if (-not $pythonPath) {
    throw 'Install backend/requirements.txt in backend/.venv first. See README.md.'
}

Push-Location $backendRoot
try {
    $mongoHost = (& $pythonPath -c 'from urllib.parse import urlparse; from app.core.config import settings; print(urlparse(settings.mongodb_uri).hostname)').Trim()
} finally { Pop-Location }
if ($mongoHost -in @('localhost', '127.0.0.1') -and -not (Test-Listening 27017)) {
    $mongoCommand = Get-Command mongod -ErrorAction SilentlyContinue
    $mongoExecutable = if ($mongoCommand) { $mongoCommand.Source } else { $null }
    $portableMongoRoot = Join-Path $projectRoot '.cache/tools/mongodb'
    if (-not $mongoExecutable -and (Test-Path -LiteralPath $portableMongoRoot)) {
        $mongoExecutable = Get-ChildItem -LiteralPath $portableMongoRoot -Filter mongod.exe -Recurse |
            Select-Object -First 1 -ExpandProperty FullName
    }
    if (-not $mongoExecutable) {
        throw 'Start MongoDB or configure MONGODB_URI in backend/.env. See README.md.'
    }
    $databasePath = Join-Path $projectRoot '.cache/mongodb-data'
    $databaseLog = Join-Path $logRoot 'mongodb.log'
    New-Item -ItemType Directory -Force -Path $databasePath | Out-Null
    Start-Process -FilePath $mongoExecutable -WindowStyle Hidden -ArgumentList @(
        '--bind_ip', '127.0.0.1', '--port', '27017', '--dbpath', "`"$databasePath`"",
        '--logpath', "`"$databaseLog`"", '--logappend'
    ) | Out-Null
    Write-Host 'Starting project-local MongoDB...'
}

$backendUrl = "http://127.0.0.1:$BackendPort"
if (-not (Test-Listening $BackendPort)) {
    Start-Process -FilePath $pythonPath -WorkingDirectory $backendRoot -WindowStyle Hidden -ArgumentList @(
        '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', $BackendPort.ToString(), '--reload'
    ) -RedirectStandardOutput (Join-Path $logRoot "backend-$runStamp.out.log") `
      -RedirectStandardError (Join-Path $logRoot "backend-$runStamp.err.log") | Out-Null
    Write-Host 'Starting FastAPI...'
}
Wait-Ready "$backendUrl/api/health"

$frontendUrl = "http://localhost:$FrontendPort"
if (-not (Test-Listening $FrontendPort)) {
    $nextExecutable = Join-Path $frontendRoot 'node_modules/next/dist/bin/next'
    if (-not (Test-Path -LiteralPath $nextExecutable)) { throw 'Run npm install in frontend first.' }
    $savedPublicApi = $env:NEXT_PUBLIC_API_URL
    $savedBackendOrigin = $env:WARDROBE_API_ORIGIN
    try {
        $env:NEXT_PUBLIC_API_URL = '/api'
        $env:WARDROBE_API_ORIGIN = $backendUrl
        Start-Process -FilePath (Get-Command node).Source -WorkingDirectory $frontendRoot -WindowStyle Hidden -ArgumentList @(
            "`"$nextExecutable`"", 'dev', '--port', $FrontendPort.ToString()
        ) -RedirectStandardOutput (Join-Path $logRoot "frontend-$runStamp.out.log") `
          -RedirectStandardError (Join-Path $logRoot "frontend-$runStamp.err.log") | Out-Null
    } finally {
        $env:NEXT_PUBLIC_API_URL = $savedPublicApi
        $env:WARDROBE_API_ORIGIN = $savedBackendOrigin
    }
    Write-Host 'Starting Next.js...'
}
Wait-Ready "$frontendUrl/api/health"
Wait-Ready "$frontendUrl/login"
Write-Host "Thread is ready: $frontendUrl"
Write-Host "API docs: $backendUrl/docs"
Write-Host "Logs: $logRoot"
