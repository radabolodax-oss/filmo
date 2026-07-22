<#
  Movix — local environment setup / doctor script (Windows).

  Usage:
    powershell -ExecutionPolicy Bypass -File scripts/setup.ps1

  What it does:
    - Checks Node.js / Python versions against .nvmrc / .python-version
    - Checks whether MySQL (3306) and Redis/Memurai (6379) are reachable
    - Copies .env.example -> .env wherever a .env is missing (never overwrites)
    - Runs npm install (root + API/Mainapi)
    - Creates Python venvs + pip install for API/proxiesembed and API/miscs
    - Prints the manual command to load the DB schema (not run automatically —
      it DROPs and recreates tables, which would wipe an existing database)
    - Prints a final summary of anything still requiring manual action

  Idempotent: safe to re-run at any time.
#>

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$warnings = New-Object System.Collections.Generic.List[string]

function Write-Section($title) {
    Write-Host ""
    Write-Host "== $title ==" -ForegroundColor Cyan
}

function Test-Port([string]$hostName, [int]$port) {
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $iar = $client.BeginConnect($hostName, $port, $null, $null)
        $ok = $iar.AsyncWaitHandle.WaitOne(1000, $false)
        if ($ok -and $client.Connected) {
            $client.Close()
            return $true
        }
        $client.Close()
        return $false
    } catch {
        return $false
    }
}

# --- Node.js -----------------------------------------------------------
Write-Section "Node.js"
$nvmrcPath = Join-Path $root ".nvmrc"
$nvmrc = ""
if (Test-Path $nvmrcPath) {
    $nvmrc = (Get-Content $nvmrcPath | Select-Object -First 1).Trim()
}
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "Node.js introuvable. Installe la version $nvmrc depuis https://nodejs.org/" -ForegroundColor Red
    $warnings.Add("Node.js n'est pas installe (attendu: v$nvmrc)")
} else {
    $nodeVersion = (node --version).TrimStart('v').Trim()
    Write-Host "Installe : v$nodeVersion (attendu : v$nvmrc)"
    if ($nvmrc -and ($nodeVersion -ne $nvmrc)) {
        Write-Host "  -> version differente de .nvmrc, ca peut marcher mais ce n'est pas garanti" -ForegroundColor Yellow
        $warnings.Add("Version Node differente de .nvmrc (v$nodeVersion installe, v$nvmrc attendu)")
    }
}

# --- Python --------------------------------------------------------------
Write-Section "Python (API/proxiesembed, API/miscs)"
$pyVersionPath = Join-Path $root "API\proxiesembed\.python-version"
$pyExpected = ""
if (Test-Path $pyVersionPath) {
    $pyExpected = (Get-Content $pyVersionPath | Select-Object -First 1).Trim()
}
$pyCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pyCmd) {
    Write-Host "Python introuvable. Installe la version $pyExpected depuis https://www.python.org/" -ForegroundColor Red
    $warnings.Add("Python n'est pas installe (attendu: $pyExpected)")
} else {
    $pyRaw = (python --version 2>&1) -join " "
    $pyVersion = ($pyRaw -replace 'Python ', '').Trim()
    Write-Host "Installe : $pyVersion (attendu : $pyExpected)"
    if ($pyExpected -and ($pyVersion -ne $pyExpected)) {
        Write-Host "  -> version differente de .python-version" -ForegroundColor Yellow
        Write-Host "     Rappel : lxml==6.1.1 dans requirements.txt exige un cp314 wheel (ou un compilateur C)." -ForegroundColor Yellow
        $warnings.Add("Version Python differente de .python-version ($pyVersion installe, $pyExpected attendu)")
    }
}

# --- MySQL -----------------------------------------------------------------
Write-Section "MySQL (localhost:3306)"
if (Test-Port "localhost" 3306) {
    Write-Host "MySQL repond sur localhost:3306" -ForegroundColor Green
} else {
    Write-Host "Rien ne repond sur localhost:3306" -ForegroundColor Yellow
    Write-Host "  -> demarre ton install native (service Windows 'MySQL80') ou : docker compose up -d mysql"
    $warnings.Add("MySQL non joignable sur localhost:3306")
}

# --- Redis / Memurai ---------------------------------------------------
Write-Section "Redis / Memurai (localhost:6379)"
if (Test-Port "localhost" 6379) {
    Write-Host "Un serveur Redis-compatible repond sur localhost:6379" -ForegroundColor Green
} else {
    Write-Host "Rien ne repond sur localhost:6379" -ForegroundColor Yellow
    Write-Host "  -> installe Memurai (https://www.memurai.com/) ou : docker compose up -d redis"
    $warnings.Add("Redis/Memurai non joignable sur localhost:6379")
}

# --- Docker (informational) ---------------------------------------------
Write-Section "Docker (optionnel)"
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerCmd) {
    Write-Host "Docker present : $($dockerCmd.Source)"
    Write-Host "Rappel : API/watchpartyAPI/ manque du disque -> exclu par defaut (profile 'watchparty')."
} else {
    Write-Host "Docker non installe (facultatif si tu restes en install native pour MySQL/Redis)."
}

# --- .env files ----------------------------------------------------------
Write-Section ".env (jamais ecrases s'ils existent deja)"
$envPairs = @(
    @{ Example = (Join-Path $root ".env.example");                       Target = (Join-Path $root ".env") },
    @{ Example = (Join-Path $root "API\Mainapi\.env.example");           Target = (Join-Path $root "API\Mainapi\.env") },
    @{ Example = (Join-Path $root "API\proxiesembed\.env.example");      Target = (Join-Path $root "API\proxiesembed\.env") },
    @{ Example = (Join-Path $root "API\miscs\.env.example");             Target = (Join-Path $root "API\miscs\.env") }
)
foreach ($pair in $envPairs) {
    if (Test-Path $pair.Target) {
        Write-Host "OK deja present : $($pair.Target)"
    } elseif (Test-Path $pair.Example) {
        Copy-Item $pair.Example $pair.Target
        Write-Host "Cree depuis le template (a remplir) : $($pair.Target)" -ForegroundColor Yellow
        $warnings.Add("Remplis les vraies valeurs dans $($pair.Target)")
    } else {
        Write-Host "Template introuvable : $($pair.Example)" -ForegroundColor Red
    }
}

# --- npm install -----------------------------------------------------------
Write-Section "npm install (frontend, racine)"
npm install
if ($LASTEXITCODE -ne 0) {
    $warnings.Add("npm install (racine) a echoue - voir le log ci-dessus")
}

Write-Section "npm install (API/Mainapi)"
Push-Location (Join-Path $root "API\Mainapi")
npm install
if ($LASTEXITCODE -ne 0) {
    $warnings.Add("npm install (API/Mainapi) a echoue - voir le log ci-dessus")
}
Pop-Location

# --- Python venvs ------------------------------------------------------
if ($pyCmd) {
    Write-Section "venv + pip install (API/proxiesembed)"
    $venvPath = Join-Path $root "API\proxiesembed\.venv"
    if (-not (Test-Path $venvPath)) {
        python -m venv $venvPath
    }
    & (Join-Path $venvPath "Scripts\pip.exe") install -r (Join-Path $root "API\proxiesembed\requirements.txt")
    if ($LASTEXITCODE -ne 0) {
        $warnings.Add("pip install (API/proxiesembed) a echoue - voir le log ci-dessus")
    }

    Write-Section "venv + pip install (API/miscs)"
    $venvPathMiscs = Join-Path $root "API\miscs\.venv"
    if (-not (Test-Path $venvPathMiscs)) {
        python -m venv $venvPathMiscs
    }
    & (Join-Path $venvPathMiscs "Scripts\pip.exe") install -r (Join-Path $root "API\miscs\requirements.txt")
    if ($LASTEXITCODE -ne 0) {
        $warnings.Add("pip install (API/miscs) a echoue - voir le log ci-dessus")
    }
} else {
    Write-Section "venv + pip install"
    Write-Host "Python absent, etape sautee." -ForegroundColor Yellow
}

# --- Schema MySQL (manuel, jamais auto-execute) --------------------------
Write-Section "Schema MySQL"
Write-Host "Pas execute automatiquement : ce script DROP puis recree les tables," -ForegroundColor Yellow
Write-Host "donc destructif sur une base qui a deja des donnees. Pour l'appliquer :" -ForegroundColor Yellow
Write-Host '  mysql -h localhost -P 3306 -u movix -p movix < API\Mainapi\exportscripts\schema_full_init.sql' -ForegroundColor Yellow
Write-Host "(la plupart des tables se recreent aussi seules au demarrage de l'API si absentes)"

# --- Resume --------------------------------------------------------------
Write-Section "Resume"
if ($warnings.Count -eq 0) {
    Write-Host "Tout est pret." -ForegroundColor Green
    Write-Host "Lance : npm run dev  (puis les 3 backends, voir CLAUDE.md > Commands)"
} else {
    Write-Host "$($warnings.Count) point(s) a traiter avant de lancer le site :" -ForegroundColor Yellow
    foreach ($w in $warnings) {
        Write-Host "  - $w"
    }
}
