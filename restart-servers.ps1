# Redemarre backend (3000) et/ou frontend (5173).
# Tue uniquement le(s) PID reellement lie(s) a chaque port (jamais Get-Process node | Stop-Process,
# ca tuerait les deux serveurs a la fois). Ordre : on arrete d'abord tous les ports cibles, on laisse
# l'OS les liberer, puis on relance chaque serveur dans sa propre fenetre.
#
# Usage :
#   .\restart-servers.ps1              -> redemarre les deux
#   .\restart-servers.ps1 -Backend     -> redemarre uniquement le backend
#   .\restart-servers.ps1 -Frontend    -> redemarre uniquement le frontend

param(
    [switch]$Backend,
    [switch]$Frontend
)

$doBackend  = $Backend -or (-not $Backend -and -not $Frontend)
$doFrontend = $Frontend -or (-not $Backend -and -not $Frontend)
$root = $PSScriptRoot

$targets = @()
if ($doBackend)  { $targets += @{ Port = 3000; Label = "Backend";  Cwd = "$root\backend";  Command = "node src/app.js" } }
if ($doFrontend) { $targets += @{ Port = 5173; Label = "Frontend"; Cwd = "$root\frontend"; Command = "npm run dev" } }

function Get-PortPids($port) {
    # -Unique + filtre PID 0 : sur ce port on peut voir plusieurs lignes TIME_WAIT fantomes (PID 0,
    # connexions deja fermees) en plus du vrai process qui ecoute encore - on ne veut tuer que celui-la.
    Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique |
        Where-Object { $_ -ne 0 }
}

# 1) Arreter, port par port, uniquement le(s) PID reellement lie(s) a CE port.
foreach ($t in $targets) {
    $procIds = Get-PortPids $t.Port
    if ($procIds) {
        foreach ($procId in $procIds) {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            Write-Host "$($t.Label) (port $($t.Port)) arrete (PID $procId)"
        }
    } else {
        Write-Host "$($t.Label) (port $($t.Port)) : rien a arreter"
    }
}

# 2) Laisser l'OS liberer les ports avant de relancer (evite un "port deja utilise" au demarrage).
Start-Sleep -Seconds 1

# 3) Relancer chaque serveur dans sa propre fenetre PowerShell (reste ouverte -> logs visibles en direct).
foreach ($t in $targets) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$($t.Cwd)'; $($t.Command)" -WindowStyle Normal
    Write-Host "$($t.Label) relance dans une nouvelle fenetre"
}

if ($doBackend) {
    Write-Host ""
    Write-Host "Verifier dans la fenetre Backend : 'PostgreSQL connecte' et '[cron] Job invitations planifiees demarre'"
}
