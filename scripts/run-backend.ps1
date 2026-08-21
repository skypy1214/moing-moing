[CmdletBinding()]
param(
    [ValidateSet('local', 'dev', 'prod')]
    [string]$SpringProfile = 'local'
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repositoryRoot '.env'

if (-not (Test-Path -LiteralPath $envFile)) {
    throw "Environment file not found: $envFile"
}

foreach ($line in Get-Content -LiteralPath $envFile) {
    $trimmed = $line.Trim()
    if ($trimmed.Length -eq 0 -or $trimmed.StartsWith('#')) {
        continue
    }

    $separator = $trimmed.IndexOf('=')
    if ($separator -lt 1) {
        throw "Invalid environment variable entry in $envFile"
    }

    $name = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim()
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
}

foreach ($requiredName in @('DB_URL', 'DB_USERNAME', 'DB_PASSWORD')) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($requiredName, 'Process'))) {
        throw "$requiredName must be set in $envFile"
    }
}

$env:SPRING_PROFILES_ACTIVE = $SpringProfile

Push-Location (Join-Path $repositoryRoot 'backend')
try {
    & .\gradlew.bat bootRun
    if ($LASTEXITCODE -ne 0) {
        throw "Backend bootRun failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}
