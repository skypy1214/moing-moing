[CmdletBinding()]
param(
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$env:GRADLE_USER_HOME = Join-Path $repositoryRoot '.gradle-user-home'

function Invoke-CheckedStep {
    param(
        [Parameter(Mandatory)]
        [string]$Name,
        [Parameter(Mandatory)]
        [scriptblock]$Action
    )

    Write-Host "`n==> $Name"
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }
}

Push-Location (Join-Path $repositoryRoot 'backend')
try {
    Invoke-CheckedStep 'Backend build and tests' { & .\gradlew.bat clean build }
} finally {
    Pop-Location
}

Push-Location (Join-Path $repositoryRoot 'frontend')
try {
    if (-not $SkipInstall) {
        Invoke-CheckedStep 'Frontend clean dependency install' { npm ci }
    }
    Invoke-CheckedStep 'Frontend lint and formatting' { npm run lint }
    Invoke-CheckedStep 'Frontend tests' { npm test }
    Invoke-CheckedStep 'Frontend build' { npm run build }
} finally {
    Pop-Location
}

Push-Location $repositoryRoot
try {
    Invoke-CheckedStep 'Git whitespace validation' { git diff --check }
    Invoke-CheckedStep 'Git status' { git status --short }
} finally {
    Pop-Location
}

Write-Host "`nAll verification steps passed."
