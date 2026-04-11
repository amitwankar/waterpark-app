Param(
  [string]$AppDir = "app"
)

$ErrorActionPreference = "Stop"

function New-RandomToken([int]$length = 32) {
  $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  $sb = New-Object System.Text.StringBuilder
  for ($i = 0; $i -lt $length; $i++) {
    [void]$sb.Append($chars[(Get-Random -Minimum 0 -Maximum $chars.Length)])
  }
  return $sb.ToString()
}

function Set-EnvValue {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Value
  )

  $content = ""
  if (Test-Path $Path) {
    $content = Get-Content -Path $Path -Raw
  }

  if ($content -match "(?m)^$([regex]::Escape($Key))=") {
    $content = [regex]::Replace($content, "(?m)^$([regex]::Escape($Key))=.*$", "$Key=$Value")
  } else {
    if ($content -and -not $content.EndsWith("`n")) { $content += "`n" }
    $content += "$Key=$Value`n"
  }

  Set-Content -Path $Path -Value $content -NoNewline
}

$appPath = Resolve-Path (Join-Path $PSScriptRoot "..\$AppDir")
$envLocalPath = Join-Path $appPath ".env.local"

if (-not (Test-Path $envLocalPath)) {
  New-Item -Path $envLocalPath -ItemType File -Force | Out-Null
}

$ticketTerminal = "TICKET-" + (New-RandomToken 6).ToUpper()
$lockerTerminal = "LOCKER-" + (New-RandomToken 6).ToUpper()
$costumeTerminal = "COSTUME-" + (New-RandomToken 6).ToUpper()
$foodTerminal = "FOOD-" + (New-RandomToken 6).ToUpper()

Set-EnvValue -Path $envLocalPath -Key "NODE_ENV" -Value "development"
Set-EnvValue -Path $envLocalPath -Key "NEXT_PUBLIC_APP_URL" -Value "http://localhost:3000"
Set-EnvValue -Path $envLocalPath -Key "BETTER_AUTH_URL" -Value "http://localhost:3000"
Set-EnvValue -Path $envLocalPath -Key "BETTER_AUTH_SECRET" -Value (New-RandomToken 48)
Set-EnvValue -Path $envLocalPath -Key "ENCRYPTION_KEY" -Value (New-RandomToken 32)
Set-EnvValue -Path $envLocalPath -Key "DATABASE_URL" -Value "postgresql://postgres:postgres@localhost:5432/waterpark_app?schema=public"
Set-EnvValue -Path $envLocalPath -Key "DIRECT_URL" -Value "postgresql://postgres:postgres@localhost:5432/waterpark_app?schema=public"
Set-EnvValue -Path $envLocalPath -Key "REDIS_URL" -Value "redis://localhost:6379"
Set-EnvValue -Path $envLocalPath -Key "LOCAL_DISABLE_REDIS" -Value "true"
Set-EnvValue -Path $envLocalPath -Key "NEXT_PUBLIC_POS_TERMINAL_TICKET" -Value $ticketTerminal
Set-EnvValue -Path $envLocalPath -Key "NEXT_PUBLIC_POS_TERMINAL_LOCKER" -Value $lockerTerminal
Set-EnvValue -Path $envLocalPath -Key "NEXT_PUBLIC_POS_TERMINAL_COSTUME" -Value $costumeTerminal
Set-EnvValue -Path $envLocalPath -Key "NEXT_PUBLIC_POS_TERMINAL_FOOD" -Value $foodTerminal

Write-Host "Local env configured at $envLocalPath"
Write-Host "Ticket POS terminal  : $ticketTerminal"
Write-Host "Locker POS terminal  : $lockerTerminal"
Write-Host "Costume POS terminal : $costumeTerminal"
Write-Host "Food POS terminal    : $foodTerminal"
