param([string]$Origin, [string]$ParentWindow)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\core.ps1"
. "$PSScriptRoot\install-tools.ps1"
$script:InputStream = [Console]::OpenStandardInput()
$script:OutputStream = [Console]::OpenStandardOutput()

function Read-Exact([int]$Length) {
    $buffer = New-Object byte[] $Length
    $offset = 0
    while ($offset -lt $Length) {
        $count = $script:InputStream.Read($buffer, $offset, $Length - $offset)
        if ($count -eq 0) {
            if ($offset -eq 0) { return $null }
            throw 'Unvollstaendige Nachricht.'
        }
        $offset += $count
    }
    return ,$buffer
}
function Write-Message([hashtable]$Message) {
    $json = ConvertTo-Json -InputObject $Message -Compress -Depth 10
    $bytes = $script:Utf8.GetBytes($json)
    $prefix = [BitConverter]::GetBytes([uint32]$bytes.Length)
    $script:OutputStream.Write($prefix, 0, 4)
    $script:OutputStream.Write($bytes, 0, $bytes.Length)
    $script:OutputStream.Flush()
}
function Select-TargetFolder([string]$Folder) {
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $owner = New-Object System.Windows.Forms.Form
    try {
        $owner.TopMost = $true
        $dialog.Description = 'Zielordner fuer YouTube Utils waehlen'
        $dialog.ShowNewFolderButton = $true
        if ($Folder -and (Test-Path -LiteralPath $Folder -PathType Container)) { $dialog.SelectedPath = $Folder }
        $result = $dialog.ShowDialog($owner)
        if ($result -eq [System.Windows.Forms.DialogResult]::OK) { return @{folder = $dialog.SelectedPath} }
        return @{folder = ''}
    } finally { $dialog.Dispose(); $owner.Dispose() }
}

while ($true) {
    $id = ''
    try {
        $prefix = Read-Exact 4
        if ($null -eq $prefix) { break }
        $length = [BitConverter]::ToUInt32($prefix, 0)
        if ($length -lt 2 -or $length -gt 65536) { break }
        $payload = Read-Exact $length
        if ($null -eq $payload) { break }
        $request = $script:Utf8.GetString($payload) | ConvertFrom-Json
        $id = [string]$request.id
        if ($id.Length -gt 80) { throw 'Ungueltige Anfrage.' }
        $progress = {
            param($message, $percent, $durationSeconds)
            $text = [string]$message
            if ($text.Length -gt 3000) { $text = $text.Substring(0, 3000) }
            Write-Message @{ id = $id; event = 'progress'; message = $text; percent = $percent; durationSeconds = $durationSeconds }
        }
        $mutex = $null; $locked = $false
        try {
            if ($request.action -in @('download', 'install')) {
                $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
                $mutex = New-Object System.Threading.Mutex($false, "Local\YouTubeUtils.$sid")
                try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
                if (-not $locked) { throw 'Ein anderer Download oder eine Installation laeuft bereits.' }
            }
            $result = switch ($request.action) {
                'status' { Get-HelperStatus }
                'browse' { Select-TargetFolder ([string]$request.folder) }
                'install' { Install-Tools $progress }
                'download' { Invoke-Download $request $progress }
                'reveal' { Show-DownloadedFile ([string]$request.path) }
                default { throw 'Unbekannte Aktion.' }
            }
        } finally {
            if ($locked) { $mutex.ReleaseMutex() }
            if ($mutex) { $mutex.Dispose() }
        }
        Write-Message @{ id = $id; event = 'result'; ok = $true; result = $result }
    } catch {
        $message = $_.Exception.Message
        if ($message.Length -gt 6000) { $message = $message.Substring(0, 6000) }
        try { Write-Message @{ id = $id; event = 'result'; ok = $false; error = $message } }
        catch { break }
    }
}
