$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host "Setze ExecutionPolicy für den aktuellen User ..." -ForegroundColor Cyan
try {
  Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
} catch {
  Write-Host "Hinweis: ExecutionPolicy konnte nicht gesetzt werden ($($_.Exception.Message))." -ForegroundColor Yellow
  Write-Host "Der Start wird trotzdem fortgesetzt ..." -ForegroundColor Yellow
}

if (-not (Test-Path ".env")) {
  if (Test-Path ".env.example") {
    Copy-Item ".env.example" ".env"
    Write-Host "'.env' wurde aus '.env.example' erstellt. Bitte OPENAI_API_KEY in .env eintragen." -ForegroundColor Yellow
  } else {
    Write-Host "Keine .env gefunden. Bitte eine .env mit OPENAI_API_KEY erstellen." -ForegroundColor Yellow
  }
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm wurde nicht gefunden. Bitte Node.js installieren."
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Installiere Abhängigkeiten ..." -ForegroundColor Cyan
  npm install
}

Write-Host "Starte Development-Server ..." -ForegroundColor Green
npm run dev
