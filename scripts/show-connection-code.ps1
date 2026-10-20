$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$privateFile = Join-Path $projectDirectory '.private/deployment-secrets.dpapi'
if (-not (Test-Path -LiteralPath $privateFile)) {
    throw 'The private setup backup is not on this PC. Ask the owner for the connection code; it is deliberately not in GitHub.'
}
$encrypted = Get-Content -LiteralPath $privateFile -Raw
$secure = ConvertTo-SecureString -String $encrypted
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $configuration = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) | ConvertFrom-Json
    Write-Host 'Private connection code. Keep it secret and enter it only in your own Yuki timer app:'
    Write-Host $configuration.ownerKey
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
