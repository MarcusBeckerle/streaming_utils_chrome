Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$script:AppRoot = $PSScriptRoot
$script:Utf8 = New-Object System.Text.UTF8Encoding($false)

function ConvertTo-ProcessArgument([string]$Value) {
    # CommandLineToArgvW escaping; never pass user input through a command shell.
    $escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
    $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
    return '"' + $escaped + '"'
}

function New-ToolProcess([string]$File, [string[]]$Arguments) {
    $info = New-Object System.Diagnostics.ProcessStartInfo
    $info.FileName = $File
    $info.Arguments = (($Arguments | ForEach-Object { ConvertTo-ProcessArgument $_ }) -join ' ')
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $info.StandardOutputEncoding = $script:Utf8
    $info.StandardErrorEncoding = $script:Utf8
    $info.WorkingDirectory = $script:AppRoot
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $info
    return $process
}

function Invoke-CapturedTool([string]$File, [string[]]$Arguments, [int]$TimeoutSeconds = 10) {
    $process = New-ToolProcess $File $Arguments
    try {
        [void]$process.Start()
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
            $process.Kill()
            throw "Zeitlimit beim Aufruf von $([IO.Path]::GetFileName($File))."
        }
        return @{ code = $process.ExitCode; stdout = $stdout.GetAwaiter().GetResult(); stderr = $stderr.GetAwaiter().GetResult() }
    } finally { $process.Dispose() }
}

function Get-ToolInfo([string]$Name) {
    $candidates = New-Object 'System.Collections.Generic.List[string]'
    $local = Join-Path $script:AppRoot "bin\$Name.exe"
    if (Test-Path -LiteralPath $local -PathType Leaf) { $candidates.Add($local) }
    $commands = @(Get-Command "$Name.exe" -CommandType Application -All -ErrorAction SilentlyContinue)
    foreach ($command in $commands) { if (-not $candidates.Contains($command.Source)) { $candidates.Add($command.Source) } }
    $failure = 'Nicht gefunden'
    foreach ($candidate in $candidates) {
        try {
            $versionArg = '--version'
            if ($Name -in @('ffmpeg', 'ffprobe')) { $versionArg = '-version' }
            $result = Invoke-CapturedTool $candidate @($versionArg) 5
            if ($result.code -ne 0) { throw 'Programm konnte nicht gestartet werden.' }
            $first = ($result.stdout -split "`r?`n")[0]
            if ($Name -eq 'deno' -and $first -match '^deno (\d+)\.(\d+)\.(\d+)') {
                if ([version]"$($Matches[1]).$($Matches[2]).$($Matches[3])" -lt [version]'2.3.0') { throw 'Deno 2.3 oder neuer ist erforderlich.' }
            }
            return @{ name = $Name; ok = $true; path = $candidate; version = $first }
        } catch { $failure = $_.Exception.Message }
    }
    return @{ name = $Name; ok = $false; path = ''; version = ''; error = $failure }
}

function Get-DefaultFolders {
    return @{
        audioFolder = Join-Path ([Environment]::GetFolderPath('MyMusic')) 'YouTube'
        videoFolder = Join-Path ([Environment]::GetFolderPath('MyVideos')) 'YouTube'
    }
}

function Get-HelperStatus {
    $tools = @('yt-dlp', 'ffmpeg', 'ffprobe', 'deno' | ForEach-Object { Get-ToolInfo $_ })
    if ($tools[1].ok -and $tools[2].ok -and ([IO.Path]::GetDirectoryName($tools[1].path) -ne [IO.Path]::GetDirectoryName($tools[2].path))) {
        $tools[2].ok = $false
        $tools[2].error = 'FFmpeg und FFprobe muessen im gleichen Programmordner liegen. Bitte Programme installieren.'
    }
    return @{ version = '1.2.0'; features = @('reveal', 'fileDetails', 'videoQuality'); ready = @($tools | Where-Object { -not $_.ok }).Count -eq 0; tools = $tools; defaults = Get-DefaultFolders }
}

function Get-RevealPath([string]$Path) {
    if ($Path -notmatch '^[A-Za-z]:\\' -or $Path -match '[<>"|?*\x00-\x1f]' -or $Path.Substring(2).Contains(':')) {
        throw 'Ungueltiger Dateipfad.'
    }
    $full = [IO.Path]::GetFullPath($Path)
    if ([IO.Path]::GetExtension($full) -notin @('.mp3', '.mkv')) { throw 'Nur heruntergeladene MP3- oder MKV-Dateien koennen angezeigt werden.' }
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { throw 'Die Datei wurde verschoben oder geloescht und ist nicht mehr vorhanden.' }
    return $full
}

function Show-DownloadedFile([string]$Path) {
    $full = Get-RevealPath $Path
    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = Join-Path $env:SystemRoot 'explorer.exe'
    $start.UseShellExecute = $false
    $start.Arguments = '/select,' + (ConvertTo-ProcessArgument $full)
    $process = [Diagnostics.Process]::Start($start)
    if ($process) { $process.Dispose() }
    return @{path = $full}
}

function Get-DownloadedFileDetails([string]$Path, [string]$FFprobe, $FallbackDuration = $null) {
    $file = Get-Item -LiteralPath $Path
    $duration = $FallbackDuration
    try {
        $probe = Invoke-CapturedTool $FFprobe @('-v', 'error', '-show_entries', 'format=duration', '-of', 'json', $file.FullName) 10
        if ($probe.code -eq 0) {
            $info = $probe.stdout | ConvertFrom-Json
            $value = [double]::Parse([string]$info.format.duration, [Globalization.CultureInfo]::InvariantCulture)
            if (-not [double]::IsInfinity($value) -and -not [double]::IsNaN($value) -and $value -ge 0) { $duration = $value }
        }
    } catch { # A metadata read failure must not mark a successfully saved download as failed.
    }
    return @{path = $file.FullName; sizeBytes = $file.Length; durationSeconds = $duration}
}

function Get-CanonicalYouTubeUrl([string]$Value) {
    $uri = $null
    if (-not [Uri]::TryCreate($Value, [UriKind]::Absolute, [ref]$uri)) { throw 'Ungueltige YouTube-Adresse.' }
    if ($uri.Scheme -ne 'https' -or $uri.UserInfo -or -not $uri.IsDefaultPort) { throw 'Nur HTTPS-YouTube-Adressen sind erlaubt.' }
    $videoId = ''
    if ($uri.Host -eq 'youtu.be') { $videoId = $uri.AbsolutePath.TrimStart('/') }
    elseif ($uri.Host -in @('youtube.com', 'www.youtube.com', 'm.youtube.com')) {
        if ($uri.AbsolutePath -eq '/watch' -and $uri.Query -match '(?:^\?|&)v=([A-Za-z0-9_-]{11})(?:&|$)') { $videoId = $Matches[1] }
        elseif ($uri.AbsolutePath -match '^/(?:shorts|live|embed)/([A-Za-z0-9_-]{11})/?$') { $videoId = $Matches[1] }
    }
    if ($videoId -notmatch '^[A-Za-z0-9_-]{11}$') { throw 'Bitte die Adresse eines einzelnen YouTube-Videos verwenden.' }
    return "https://www.youtube.com/watch?v=$videoId"
}

function Get-ValidatedFolder([string]$Folder, [string]$Format) {
    if ([string]::IsNullOrWhiteSpace($Folder)) {
        $defaults = Get-DefaultFolders
        if ($Format -eq 'mp3') { $Folder = $defaults.audioFolder } else { $Folder = $defaults.videoFolder }
    }
    $Folder = $Folder.Trim()
    if ($Folder -notmatch '^[A-Za-z]:\\' -or $Folder -match '[<>"|?*\x00-\x1f]' -or $Folder.Substring(2).Contains(':')) {
        throw 'Bitte einen vollstaendigen lokalen Windows-Ordner angeben, z. B. D:\YouTube.'
    }
    $full = [IO.Path]::GetFullPath($Folder)
    if ($full.Length -gt 160) { throw 'Der Zielordner ist zu lang (maximal 160 Zeichen).' }
    return $full
}

function Get-SafeTitle([string]$Title) {
    $name = [regex]::Replace($Title, '[<>:"/\\|?*\x00-\x1f]', '_').Trim().TrimEnd('.')
    if ($name.Length -gt 100) { $name = $name.Substring(0, 100).TrimEnd('.', ' ') }
    if ($name -match '^(?i:CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:\.|$)') { $name = '_' + $name }
    if (-not $name) { $name = 'YouTube-Video' }
    return $name
}

function Get-DownloadArguments([string]$Url, [string]$Format, [int]$Bitrate, [string]$Folder, [string]$Stem, [hashtable]$Paths, [string]$VideoQuality = 'best') {
    if ($Format -notin @('video', 'mp3')) { throw 'Ungueltiges Format.' }
    if ($Bitrate -notin @(64, 96, 128, 192, 256, 320)) { throw 'Ungueltige MP3-Bitrate.' }
    if ($VideoQuality -notin @('best','4320','2160','1440','1080','720','480','360','240','144')) { throw 'Ungueltige Videoqualitaet.' }
    # yt-dlp output templates interpret percent signs; escape literal title characters.
    $template = $Stem.Replace('%', '%%') + '.%(ext)s'
    $arguments = @('--ignore-config', '--no-plugin-dirs', '--no-playlist', '--no-overwrites', '--no-cache-dir',
        '--encoding', 'utf-8', '--socket-timeout', '30', '--retries', '3', '--fragment-retries', '3',
        '--no-js-runtimes', '--js-runtimes', "deno:$($Paths.deno)", '--ffmpeg-location', $Paths.ffmpeg,
        '--newline', '--progress', '--progress-delta', '1', '--no-simulate',
        '--progress-template', 'download:__YTU_PROGRESS__%(progress._percent_str)s',
        '--print', 'after_move:__YTU_FILE__%(filepath)s',
        '--match-filters', '!is_live', '--paths', $Folder, '--output', $template)
    if ($Format -eq 'mp3') {
        $arguments += @('--format', 'bestaudio/best', '--extract-audio', '--audio-format', 'mp3', '--audio-quality', "${Bitrate}K")
    } else {
        # Resolution has priority over codec preference. MKV can retain all selected streams.
        $selection = 'bestvideo*+bestaudio/best'
        if ($VideoQuality -ne 'best') { $selection = "bestvideo*[height<=$VideoQuality]+bestaudio/best[height<=$VideoQuality]" }
        $arguments += @('--format', $selection, '--format-sort', 'res,fps', '--merge-output-format', 'mkv', '--remux-video', 'mkv')
    }
    return $arguments + @('--', (Get-CanonicalYouTubeUrl $Url))
}

function Invoke-Download([object]$Request, [scriptblock]$Progress) {
    $url = Get-CanonicalYouTubeUrl ([string]$Request.url)
    $format = [string]$Request.format
    if ($format -notin @('mp3', 'video')) { throw 'Ungueltiges Format.' }
    $bitrate = [int]$Request.bitrate
    if ($bitrate -notin @(64, 96, 128, 192, 256, 320)) { throw 'Ungueltige MP3-Bitrate.' }
    $folder = Get-ValidatedFolder ([string]$Request.folder) $format
    $quality = 'best'
    if ($Request.PSObject.Properties['videoQuality']) { $quality = [string]$Request.videoQuality }
    if ($quality -notin @('best','4320','2160','1440','1080','720','480','360','240','144')) { throw 'Ungueltige Videoqualitaet.' }
    $status = Get-HelperStatus
    if (-not $status.ready) { throw 'Programme fehlen. Bitte zuerst in den Einstellungen installieren.' }
    $paths = @{}
    foreach ($tool in $status.tools) { $paths[$tool.name] = $tool.path }
    [void][IO.Directory]::CreateDirectory($folder)
    & $Progress 'Videoinformationen werden geladen ...' $null
    $metadataArgs = @('--ignore-config', '--no-plugin-dirs', '--no-playlist', '--no-cache-dir', '--encoding', 'utf-8',
        '--no-js-runtimes', '--js-runtimes', "deno:$($paths.deno)", '--socket-timeout', '30', '--retries', '2',
        '--skip-download', '--print', '%(.{id,title,live_status,duration})j', '--', $url)
    $metadata = Invoke-CapturedTool $paths['yt-dlp'] $metadataArgs 150
    if ($metadata.code -ne 0) { throw "YouTube-Abfrage fehlgeschlagen: $($metadata.stderr)" }
    $info = $metadata.stdout.Trim() | ConvertFrom-Json
    if ($info.live_status -in @('is_live', 'is_upcoming', 'post_live')) { throw 'Laufende oder noch nicht verarbeitete Livestreams werden nicht heruntergeladen. Bitte nach der Verarbeitung erneut versuchen.' }
    $sourceDuration = $null
    if ($info.PSObject.Properties['duration'] -and $null -ne $info.duration) {
        $value = [double]$info.duration
        if (-not [double]::IsInfinity($value) -and -not [double]::IsNaN($value) -and $value -ge 0) { $sourceDuration = $value }
    }
    & $Progress 'Download wird vorbereitet ...' $null $sourceDuration
    $stem = Get-SafeTitle ([string]$info.title)
    $maxTitle = [Math]::Min(100, 220 - $folder.Length)
    if ($stem.Length -gt $maxTitle) { $stem = $stem.Substring(0, $maxTitle).TrimEnd('.', ' ') }
    $extension = if ($format -eq 'mp3') { '.mp3' } else { '.mkv' }
    $target = Join-Path $folder ($stem + $extension)
    if (Test-Path -LiteralPath $target) {
        $stem += ' [' + ($url.Substring($url.Length - 11)) + ']'
        $target = Join-Path $folder ($stem + $extension)
        $counter = 2
        $base = $stem
        while (Test-Path -LiteralPath $target) {
            $stem = "$base ($counter)"
            $target = Join-Path $folder ($stem + $extension)
            $counter++
        }
    }
    $arguments = Get-DownloadArguments $url $format $bitrate $folder $stem $paths $quality
    $process = New-ToolProcess $paths['yt-dlp'] $arguments
    $errors = New-Object 'System.Collections.Generic.Queue[string]'
    $savedPath = ''
    try {
        [void]$process.Start()
        $outTask = $process.StandardOutput.ReadLineAsync()
        $errTask = $process.StandardError.ReadLineAsync()
        $outDone = $false; $errDone = $false
        while (-not ($outDone -and $errDone -and $process.HasExited)) {
            foreach ($stream in @('out', 'err')) {
                $task = if ($stream -eq 'out') { $outTask } else { $errTask }
                $done = if ($stream -eq 'out') { $outDone } else { $errDone }
                if ($done -or -not $task.IsCompleted) { continue }
                $line = $task.GetAwaiter().GetResult()
                if ($null -eq $line) {
                    if ($stream -eq 'out') { $outDone = $true } else { $errDone = $true }
                    continue
                }
                if ($line.StartsWith('__YTU_FILE__')) { $savedPath = $line.Substring(12) }
                elseif ($line -match '__YTU_PROGRESS__\s*([\d.]+)%') {
                    $percent = [double]::Parse($Matches[1], [Globalization.CultureInfo]::InvariantCulture)
                    & $Progress "Download: $($Matches[1]) % (aktuelle Spur)" $percent
                } else {
                    $errors.Enqueue($line)
                    if ($errors.Count -gt 12) { [void]$errors.Dequeue() }
                    & $Progress $line $null
                }
                if ($stream -eq 'out') { $outTask = $process.StandardOutput.ReadLineAsync() }
                else { $errTask = $process.StandardError.ReadLineAsync() }
            }
            Start-Sleep -Milliseconds 60
        }
        $process.WaitForExit()
        if ($process.ExitCode -ne 0) { throw (($errors.ToArray() -join "`n") + "`nBei YouTube-Aenderungen bitte Programme-aktualisieren.cmd ausfuehren.") }
        if (-not $savedPath -or -not (Test-Path -LiteralPath $savedPath -PathType Leaf)) { throw 'Der Download hat keine fertige Datei erzeugt.' }
        if ([IO.Path]::GetExtension($savedPath) -ne $extension) { throw "Unerwartetes Ausgabeformat: $savedPath" }
        return Get-DownloadedFileDetails $savedPath $paths.ffprobe $sourceDuration
    } finally {
        try { if (-not $process.HasExited) { $process.Kill() } } catch { }
        $process.Dispose()
    }
}
