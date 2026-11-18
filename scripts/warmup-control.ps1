[CmdletBinding()]
param(
    [ValidateSet('status', 'on', 'off')]
    [string]$Action = 'status',
    [string]$WorkerUrl = 'https://moing-moing.ddrd.workers.dev/_internal/warmup-control'
)

$ErrorActionPreference = 'Stop'

$controlToken = Read-Host 'WARMUP_CONTROL_TOKEN' -AsSecureString
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($controlToken)

try {
    $headers = @{
        'X-Warmup-Control-Token' = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
    }

    if ($Action -eq 'status') {
        $response = Invoke-RestMethod -Method Get -Uri $WorkerUrl -Headers $headers
    } else {
        $body = @{ enabled = $Action -eq 'on' } | ConvertTo-Json -Compress
        $response = Invoke-RestMethod -Method Put -Uri $WorkerUrl -Headers $headers `
            -ContentType 'application/json' -Body $body
    }

    Write-Output ("Warm-up Cron: {0}" -f $(if ($response.enabled) { 'ON' } else { 'OFF' }))
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
}
