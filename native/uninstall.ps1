$ErrorActionPreference = 'Stop'
$key = 'Software\Google\Chrome\NativeMessagingHosts\de.youtube_utils.helper'
$existing = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($key)
if ($existing) {
    $existing.Dispose()
    [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKey($key)
}
Write-Host 'Chrome-Verbindung entfernt. Die Erweiterung kann unter chrome://extensions entfernt werden.'
Write-Host 'Die Programmdateien bleiben unter %LOCALAPPDATA%\YouTubeUtils und koennen manuell geloescht werden.'
Write-Host 'Heruntergeladene Videos und MP3 bleiben erhalten.'
