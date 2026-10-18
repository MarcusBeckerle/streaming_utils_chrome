$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\..\native\core.ps1"
function Assert($Condition, [string]$Message) { if (-not $Condition) { throw "FAILED: $Message" } }
function Assert-Throws([scriptblock]$Action, [string]$Message) {
    $thrown = $false
    try { & $Action | Out-Null } catch { $thrown = $true }
    Assert $thrown $Message
}
Assert ((Get-CanonicalYouTubeUrl 'https://youtu.be/abcdefghI_1') -eq 'https://www.youtube.com/watch?v=abcdefghI_1') 'Short URL canonicalization'
Assert-Throws { Get-CanonicalYouTubeUrl 'https://youtube.com.evil.test/watch?v=abcdefghI_1' } 'Host allowlist'
Assert-Throws { Get-CanonicalYouTubeUrl 'https://user@youtube.com/watch?v=abcdefghI_1' } 'Credentials rejected'
Assert-Throws { Get-CanonicalYouTubeUrl 'https://youtube.com/playlist?list=PL123' } 'Playlists rejected'
Assert-Throws { Get-ValidatedFolder '\\server\share' 'mp3' } 'UNC rejected'
Assert-Throws { Get-ValidatedFolder 'C:\Music:stream' 'mp3' } 'Alternate data stream rejected'
Assert ((Get-ValidatedFolder 'D:\Music' 'mp3') -eq 'D:\Music') 'Absolute folder retained'
Assert ((Get-SafeTitle 'CON') -eq '_CON') 'Reserved filename'
Assert ((Get-SafeTitle 'a/b:c*?') -eq 'a_b_c__') 'Windows forbidden characters'
$paths = @{ deno = 'C:\Program Files\deno.exe'; ffmpeg = 'C:\Program Files\ffmpeg.exe' }
$video = Get-DownloadArguments 'https://www.youtube.com/watch?v=abcdefghI_1&list=foo' 'video' 128 'D:\Video' 'Title 100%' $paths
Assert ($video -contains 'bestvideo*+bestaudio/best') 'Best video and audio'
Assert ($video -contains 'res,fps') 'Highest resolution first'
Assert ($video -contains 'mkv') 'Lossless MKV container'
Assert ($video -contains 'Title 100%%.%(ext)s') 'Literal percent in title'
Assert ($video[-1] -eq 'https://www.youtube.com/watch?v=abcdefghI_1') 'Canonical URL to process'
Assert ($video -contains '--no-overwrites') 'Existing files preserved'
$limited = Get-DownloadArguments 'https://youtu.be/abcdefghI_1' 'video' 128 'D:\Video' 'Title' $paths '720'
Assert ($limited -contains 'bestvideo*[height<=720]+bestaudio/best[height<=720]') 'Resolution cap applies to split and combined formats'
Assert ($limited -notcontains 'bestvideo*+bestaudio/best') 'No unlimited fallback above selected resolution'
Assert-Throws { Get-DownloadArguments 'https://youtu.be/abcdefghI_1' 'video' 128 'D:\Video' 'Title' $paths '720]+best' } 'Video quality allowlist'
$audio = Get-DownloadArguments 'https://youtu.be/abcdefghI_1' 'mp3' 128 'D:\Music' 'Title' $paths
Assert ($audio -contains '128K') 'MP3 128 kbit/s'
Assert ($audio -contains '--extract-audio') 'Audio conversion'
Assert-Throws { Get-DownloadArguments 'https://youtu.be/abcdefghI_1' 'mp3' 999 'D:\Music' 'Title' $paths } 'Bitrate allowlist'
Assert ((ConvertTo-ProcessArgument 'C:\Space Folder\') -eq '"C:\Space Folder\\"') 'Trailing slash quoting'
Assert ((ConvertTo-ProcessArgument 'a"b') -eq '"a\"b"') 'Quote escaping'
Write-Host 'Native validation and command tests passed.'

Assert-Throws { Get-RevealPath 'https://example.com/test.mp3' } 'Explorer rejects URLs'
Assert-Throws { Get-RevealPath 'C:\Windows\notepad.exe' } 'Explorer rejects non-media files'
Assert-Throws { Get-RevealPath 'C:\file.mp3:stream' } 'Explorer rejects alternate data streams'
Assert-Throws { Get-RevealPath (Join-Path $PSScriptRoot 'does-not-exist.mp3') } 'Explorer reports deleted files'
$sampleRoot = Join-Path $PSScriptRoot '.runtime'
[void][IO.Directory]::CreateDirectory($sampleRoot)
$sample = Join-Path $sampleRoot 'Details [test] & spaces.mp3'
try {
    [IO.File]::WriteAllBytes($sample, (New-Object byte[] 128))
    Assert ((Get-RevealPath $sample) -eq $sample) 'Explorer accepts literal brackets and spaces'
    $details = Get-DownloadedFileDetails $sample 'C:\does-not-exist\ffprobe.exe' 42.5
    Assert ($details.sizeBytes -eq 128) 'Actual file size'
    Assert ($details.durationSeconds -eq 42.5) 'Metadata fallback when FFprobe fails'
} finally { if (Test-Path -LiteralPath $sample) { Remove-Item -LiteralPath $sample } }
$probePath = Join-Path $sampleRoot 'bin\ffprobe.exe'
foreach ($name in @('Me at the zoo.mp3','Me at the zoo.mkv')) {
    $realFile = Join-Path $sampleRoot "output\$name"
    if ((Test-Path -LiteralPath $realFile) -and (Test-Path -LiteralPath $probePath)) {
        $details = Get-DownloadedFileDetails $realFile $probePath
        Assert ($details.durationSeconds -gt 18 -and $details.durationSeconds -lt 21) "Real media duration: $name"
        Assert ($details.sizeBytes -eq (Get-Item -LiteralPath $realFile).Length) "Real media size: $name"
        Write-Host "$name : $($details.durationSeconds) seconds, $($details.sizeBytes) bytes"
    }
}
Write-Host 'Explorer validation and file detail tests passed.'
