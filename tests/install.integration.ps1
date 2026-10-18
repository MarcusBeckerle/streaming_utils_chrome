# Opt-in network test. Installs only into tests/.runtime, without registry changes.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\..\native\core.ps1"
. "$PSScriptRoot\..\native\install-tools.ps1"
$script:AppRoot = Join-Path $PSScriptRoot '.runtime'
[void][IO.Directory]::CreateDirectory($script:AppRoot)
$status = Install-Tools -Progress { param($message, $percent) Write-Host $message }
$status | ConvertTo-Json -Depth 5
