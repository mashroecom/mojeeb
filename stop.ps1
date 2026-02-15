# ============================================
# Mojeeb - Stop All Services
# ============================================

Write-Host ""
Write-Host "Stopping Mojeeb services..." -ForegroundColor Yellow

# Stop Node processes (API + Web)
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "  Node servers stopped" -ForegroundColor Green

# Stop Docker containers
docker stop postgres redis 2>$null | Out-Null
Write-Host "  PostgreSQL & Redis stopped" -ForegroundColor Green

Write-Host ""
Write-Host "All services stopped!" -ForegroundColor Green
Write-Host ""
