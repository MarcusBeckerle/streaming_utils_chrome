# Opt-in real YouTube test. Uses isolated binaries and writes only in tests/.runtime.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\..\native\core.ps1"
$script:AppRoot = Join-Path $PSScriptRoot '.runtime'
$folder = Join-Path $script:AppRoot 'output'
foreach ($format in @('mp3', 'video')) {
    $request = [pscustomobject]@{url='https://www.youtube.com/watch?v=jNQXAC9IVRw';format=$format;bitrate=128;folder=$folder}
    $result = Invoke-Download $request {param($message, $percent) Write-Host $message}
    Write-Host "RESULT: $($result.path)"
    $probe = Invoke-CapturedTool (Join-Path $script:AppRoot 'bin\ffprobe.exe') @('-v', 'error', '-show_entries', 'stream=codec_name,codec_type,width,height,bit_rate', '-of', 'json', $result.path) 10
    if ($probe.code -ne 0) { throw $probe.stderr }
    Write-Host $probe.stdout
}
