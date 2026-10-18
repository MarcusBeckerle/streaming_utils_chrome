param([switch]$SkipTools, [switch]$UpdateTools)
$ErrorActionPreference = 'Stop'
try {
    # Build embeds these variables into the standalone setup.
    if (-not (Get-Variable Bundle -ErrorAction SilentlyContinue)) {
        $Bundle = @{}
        foreach ($name in @('core.ps1','host.ps1','install-tools.ps1')) {
            $Bundle[$name] = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $PSScriptRoot $name)))
        }
        $Bundle['LICENSE.txt'] = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Join-Path $PSScriptRoot '..\LICENSE')))
        $ExtensionId = ([IO.File]::ReadAllText((Join-Path $PSScriptRoot '..\extension-id.txt'))).Trim()
    }
    if ($ExtensionId -notmatch '^[a-p]{32}$') { throw 'Die Erweiterungs-ID ist ungueltig. Bitte das vollstaendige Paket verwenden.' }
    $installRoot = Join-Path $env:LOCALAPPDATA 'YouTubeUtils'
    [void][IO.Directory]::CreateDirectory($installRoot)
    foreach ($name in @('core.ps1','host.ps1','install-tools.ps1','LICENSE.txt')) {
        [IO.File]::WriteAllBytes((Join-Path $installRoot $name), [Convert]::FromBase64String($Bundle[$name]))
    }
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    $launcher = '@echo off' + "`r`n" + '"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -STA -File "%~dp0host.ps1" %*' + "`r`n"
    [IO.File]::WriteAllText((Join-Path $installRoot 'host.cmd'), $launcher, [Text.Encoding]::ASCII)
    $manifest = @{
        name = 'de.youtube_utils.helper'
        description = 'YouTube Utils Windows helper'
        path = (Join-Path $installRoot 'host.cmd')
        type = 'stdio'
        allowed_origins = @("chrome-extension://$ExtensionId/")
    }
    $manifestPath = Join-Path $installRoot 'native-host.json'
    [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 4), $utf8)
    $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Software\Google\Chrome\NativeMessagingHosts\de.youtube_utils.helper')
    try { $key.SetValue('', $manifestPath, [Microsoft.Win32.RegistryValueKind]::String) } finally { $key.Dispose() }
    Write-Host "Chrome-Verbindung eingerichtet: $installRoot" -ForegroundColor Green
    if (-not $SkipTools) {
        . (Join-Path $installRoot 'core.ps1')
        . (Join-Path $installRoot 'install-tools.ps1')
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        $mutex = New-Object System.Threading.Mutex($false, "Local\YouTubeUtils.$sid")
        $locked = $false
        try {
            try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
            if (-not $locked) { throw 'Ein Download oder eine Installation laeuft bereits. Bitte spaeter erneut versuchen.' }
            $status = Install-Tools -Progress { param($message, $percent) Write-Host $message } -Force:$UpdateTools
            foreach ($tool in $status.tools) { Write-Host "$($tool.name): $($tool.version)" }
        } finally {
            if ($locked) { $mutex.ReleaseMutex() }
            $mutex.Dispose()
        }
    }
    Write-Host "Fertig. In der Erweiterung auf 'Erneut pruefen' klicken." -ForegroundColor Green
} catch {
    Write-Host "Setup nicht vollstaendig: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Die Chrome-Verbindung kann bereits eingerichtet sein. Status in den Einstellungen pruefen.'
    exit 1
}
