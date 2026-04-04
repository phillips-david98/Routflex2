# ROUTflex CRM – Start Script
# Abre dois terminais: backend (porta 3001) e frontend (porta 5173)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "  ROUTflex CRM - Iniciando..." -ForegroundColor Cyan
Write-Host ""

# Backend
$backendPath = Join-Path $root "backend"
if (-not (Test-Path (Join-Path $backendPath "node_modules"))) {
    Write-Host "  [Backend] Instalando dependencias..." -ForegroundColor Yellow
    Push-Location $backendPath
    npm install
    Pop-Location
}

# Copy .env if not exists
$envFile = Join-Path $backendPath ".env"
$envExample = Join-Path $backendPath ".env.example"
if (-not (Test-Path $envFile)) {
    Copy-Item $envExample $envFile
    Write-Host "  [Backend] .env criado a partir de .env.example" -ForegroundColor Green
}

# Frontend
$frontendPath = Join-Path $root "frontend"
if (-not (Test-Path (Join-Path $frontendPath "node_modules"))) {
    Write-Host "  [Frontend] Instalando dependencias..." -ForegroundColor Yellow
    Push-Location $frontendPath
    npm install
    Pop-Location
}

Write-Host ""
Write-Host "  Iniciando Backend em http://localhost:3001 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; npm run dev"

Start-Sleep -Seconds 2

Write-Host "  Iniciando Frontend em http://localhost:5173 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev"

Write-Host ""
Write-Host "  CRM disponivel em: http://localhost:5173" -ForegroundColor Cyan
Write-Host "  API disponivel em: http://localhost:3001/api/health" -ForegroundColor Cyan
Write-Host ""
