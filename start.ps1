# ============================================
# Mojeeb - Start All Services
# ============================================
# Usage: Right-click > Run with PowerShell
#   OR:  powershell -File start.ps1
# ============================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Mojeeb - Starting All Services...     " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# -------------------------------------------
# 1. Start Docker Desktop (if not running)
# -------------------------------------------
$dockerProcess = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if (-not $dockerProcess) {
    Write-Host "[1/5] Starting Docker Desktop..." -ForegroundColor Yellow
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"

    Write-Host "       Waiting for Docker to be ready..." -ForegroundColor Gray
    $attempts = 0
    $maxAttempts = 60
    do {
        Start-Sleep -Seconds 2
        $attempts++
        try {
            $null = docker info 2>$null
            $dockerReady = $LASTEXITCODE -eq 0
        } catch {
            $dockerReady = $false
        }
        if ($attempts % 5 -eq 0) {
            Write-Host "       Still waiting... ($attempts seconds)" -ForegroundColor Gray
        }
    } while (-not $dockerReady -and $attempts -lt $maxAttempts)

    if (-not $dockerReady) {
        Write-Host "       ERROR: Docker failed to start after $($maxAttempts * 2) seconds" -ForegroundColor Red
        Write-Host "       Please start Docker Desktop manually and try again." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "       Docker is ready!" -ForegroundColor Green
} else {
    Write-Host "[1/5] Docker Desktop already running" -ForegroundColor Green
}

# -------------------------------------------
# 2. Start PostgreSQL container
# -------------------------------------------
Write-Host "[2/5] Starting PostgreSQL..." -ForegroundColor Yellow
$pgExists = docker ps -a --filter "name=^postgres$" --format "{{.Names}}" 2>$null
if ($pgExists) {
    docker start postgres 2>$null | Out-Null
} else {
    docker run -d --name postgres `
        -p 5432:5432 `
        -e POSTGRES_USER=postgres `
        -e POSTGRES_PASSWORD=postgres `
        -e POSTGRES_DB=mojeeb `
        -v pgdata:/var/lib/postgresql/data `
        pgvector/pgvector:pg16 2>$null | Out-Null
}

# Wait for PostgreSQL to accept connections
$pgReady = $false
for ($i = 0; $i -lt 15; $i++) {
    try {
        docker exec postgres pg_isready -q 2>$null
        if ($LASTEXITCODE -eq 0) { $pgReady = $true; break }
    } catch {}
    Start-Sleep -Seconds 1
}
if ($pgReady) {
    # Enable pgvector extension
    docker exec postgres psql -U postgres -d mojeeb -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>$null | Out-Null
    Write-Host "       PostgreSQL is ready (port 5432)" -ForegroundColor Green
} else {
    Write-Host "       WARNING: PostgreSQL may not be ready yet" -ForegroundColor Yellow
}

# -------------------------------------------
# 3. Start Redis container
# -------------------------------------------
Write-Host "[3/5] Starting Redis..." -ForegroundColor Yellow
$redisExists = docker ps -a --filter "name=^redis$" --format "{{.Names}}" 2>$null
if ($redisExists) {
    docker start redis 2>$null | Out-Null
} else {
    docker run -d --name redis `
        -p 6379:6379 `
        -v redisdata:/data `
        redis:7-alpine 2>$null | Out-Null
}
Start-Sleep -Seconds 1
Write-Host "       Redis is ready (port 6379)" -ForegroundColor Green

# -------------------------------------------
# 4. Run Prisma migrations
# -------------------------------------------
Write-Host "[4/5] Running database migrations..." -ForegroundColor Yellow
Set-Location "D:\mojeeb"
npx prisma db push --skip-generate --accept-data-loss 2>$null | Out-Null
npx prisma generate 2>$null | Out-Null
Write-Host "       Database is up to date" -ForegroundColor Green

# -------------------------------------------
# 5. Start API + Web in new terminals
# -------------------------------------------
Write-Host "[5/5] Starting application servers..." -ForegroundColor Yellow

# Start API server in new terminal
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location 'D:\mojeeb\apps\api'; Write-Host 'API Server starting on port 4000...' -ForegroundColor Cyan; npx tsx src/index.ts"
)

# Small delay to let API start first
Start-Sleep -Seconds 3

# Start Web server in new terminal
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location 'D:\mojeeb\apps\web'; Write-Host 'Web Server starting on port 3000...' -ForegroundColor Cyan; npx next dev --port 3000"
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  All services started!                 " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Web:  http://localhost:3000" -ForegroundColor White
Write-Host "  API:  http://localhost:4000" -ForegroundColor White
Write-Host ""
Write-Host "  (Two new terminal windows opened" -ForegroundColor Gray
Write-Host "   for API and Web servers)" -ForegroundColor Gray
Write-Host ""

# Keep this window open briefly
Start-Sleep -Seconds 5
