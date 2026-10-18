function Get-ReleaseAsset([string]$Repository, [string]$Name) {
    $headers = @{ 'User-Agent' = 'YouTubeUtils/1.0'; 'Accept' = 'application/vnd.github+json' }
    $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repository/releases/latest" -Headers $headers -TimeoutSec 45
    $asset = @($release.assets | Where-Object { $_.name -eq $Name })
    if ($asset.Count -ne 1) { throw "Download nicht gefunden: $Repository / $Name. Bitte die manuelle Anleitung verwenden." }
    if (-not $asset[0].PSObject.Properties['digest'] -or $asset[0].digest -notmatch '^sha256:[0-9a-fA-F]{64}$') {
        throw "Keine SHA256-Pruefsumme fuer $Name vorhanden. Automatische Installation wurde abgebrochen."
    }
    if ($asset[0].browser_download_url -notlike "https://github.com/$Repository/releases/download/*") { throw 'Unerwartete Download-Adresse.' }
    return $asset[0]
}

function Install-Tools([scriptblock]$Progress, [switch]$Force) {
    if (-not [Environment]::Is64BitOperatingSystem) { throw 'Das automatische Setup erfordert Windows x64 oder Windows ARM64 mit x64-Unterstuetzung.' }
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $ProgressPreference = 'SilentlyContinue'
    $bin = Join-Path $script:AppRoot 'bin'
    [void][IO.Directory]::CreateDirectory($bin)
    $plan = @(
        @{ name = 'yt-dlp'; repo = 'yt-dlp/yt-dlp'; asset = 'yt-dlp.exe'; files = @('yt-dlp.exe') },
        @{ name = 'ffmpeg'; repo = 'yt-dlp/FFmpeg-Builds'; asset = 'ffmpeg-master-latest-win64-gpl.zip'; files = @('ffmpeg.exe', 'ffprobe.exe') },
        @{ name = 'deno'; repo = 'denoland/deno'; asset = 'deno-x86_64-pc-windows-msvc.zip'; files = @('deno.exe') }
    )
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    foreach ($item in $plan) {
        $needed = $Force.IsPresent
        foreach ($file in $item.files) { if (-not (Get-ToolInfo ([IO.Path]::GetFileNameWithoutExtension($file))).ok) { $needed = $true } }
        if ($item.name -eq 'ffmpeg') {
            $ffmpegInfo = Get-ToolInfo 'ffmpeg'; $ffprobeInfo = Get-ToolInfo 'ffprobe'
            if ($ffmpegInfo.ok -and $ffprobeInfo.ok -and ([IO.Path]::GetDirectoryName($ffmpegInfo.path) -ne [IO.Path]::GetDirectoryName($ffprobeInfo.path))) { $needed = $true }
        }
        if (-not $needed) { & $Progress "$($item.name) ist bereits vorhanden." $null; continue }
        & $Progress "$($item.name): offizielle Release-Daten werden geladen ..." $null
        $asset = Get-ReleaseAsset $item.repo $item.asset
        $download = Join-Path $bin ([Guid]::NewGuid().ToString('N') + '.download')
        $staged = @()
        try {
            & $Progress "$($item.name) wird heruntergeladen. FFmpeg kann einige Minuten dauern ..." $null
            Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $download -UseBasicParsing -TimeoutSec 900
            $actual = (Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash
            if ($actual -ne $asset.digest.Substring(7)) { throw "Pruefsumme stimmt nicht: $($item.name). Die Datei wird nicht ausgefuehrt." }
            & $Progress "$($item.name): SHA256 geprueft, Dateien werden eingerichtet ..." $null
            if ($item.asset.EndsWith('.zip')) {
                $archive = [IO.Compression.ZipFile]::OpenRead($download)
                try {
                    foreach ($file in $item.files) {
                        $entry = @($archive.Entries | Where-Object { $_.Name -eq $file })
                        if ($entry.Count -ne 1) { throw "Archiv enthaelt $file nicht eindeutig." }
                        $temporary = Join-Path $bin ([Guid]::NewGuid().ToString('N') + '.exe')
                        $staged += @{ temp = $temporary; final = (Join-Path $bin $file) }
                        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry[0], $temporary, $false)
                    }
                } finally { $archive.Dispose() }
            } else {
                $temporary = Join-Path $bin ([Guid]::NewGuid().ToString('N') + '.exe')
                $staged += @{ temp = $temporary; final = (Join-Path $bin $item.files[0]) }
                Copy-Item -LiteralPath $download -Destination $temporary
            }
            foreach ($file in $staged) {
                $versionArg = if ([IO.Path]::GetFileName($file.final) -in @('ffmpeg.exe','ffprobe.exe')) { '-version' } else { '--version' }
                $test = Invoke-CapturedTool $file.temp @($versionArg) 20
                if ($test.code -ne 0) { throw "Das neue Programm startet nicht: $($file.final)" }
            }
            foreach ($file in $staged) { Move-Item -LiteralPath $file.temp -Destination $file.final -Force }
            & $Progress "$($item.name) wurde eingerichtet." $null
        } finally {
            if (Test-Path -LiteralPath $download) { Remove-Item -LiteralPath $download -Force }
            foreach ($file in $staged) { if (Test-Path -LiteralPath $file.temp) { Remove-Item -LiteralPath $file.temp -Force } }
        }
    }
    $status = Get-HelperStatus
    if (-not $status.ready) { throw 'Mindestens ein Programm konnte nicht eingerichtet werden. Bitte Status und manuelle Anleitung pruefen.' }
    return $status
}
