# Builds a local installable ZIP. Does not change versions or publish anything.
[CmdletBinding()]
param([switch]$Force)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runtimeFiles = @(
    'ai-manga-viewer.php', 'readme.txt', 'includes/features.php', 'includes/capabilities.php', 'includes/extensions.php', 'includes/settings.php', 'includes/analytics.php', 'includes/analytics/lifecycle.php', 'includes/analytics/storage.php', 'includes/analytics/settings.php', 'assets/admin-library.css', 'assets/admin-library.js', 'assets/admin-settings.css',
    'blocks/library-viewer/block.json', 'blocks/library-viewer/index.js',
	'blocks/viewer/block.json', 'blocks/viewer/layout.js', 'blocks/viewer/index.js',
    'blocks/viewer/render.php', 'blocks/viewer/style.css', 'blocks/viewer/view.js'
)

function Assert-RegularPath([string]$Path) {
    $item = Get-Item -LiteralPath $Path -Force
    while ($null -ne $item) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Reparse points are not allowed in build paths: $Path"
        }
        if ($item -is [IO.FileInfo]) { $item = $item.Directory } else { $item = $item.Parent }
    }
}

function Get-Sha256([byte[]]$Bytes) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

# An allowlist prevents docs, tests, OS files and earlier ZIPs from entering the package.
$snapshots = @{}
foreach ($relative in $runtimeFiles) {
    $source = Join-Path $projectRoot $relative
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Required file missing: $relative" }
    Assert-RegularPath $source
    $snapshots[$relative] = [IO.File]::ReadAllBytes($source)
}
$header = [Text.Encoding]::UTF8.GetString($snapshots['ai-manga-viewer.php'])
$versionMatch = [regex]::Match($header, '(?m)^\s*\*\s*Version:\s*([^\r\n]+)')
if (-not $versionMatch.Success) { throw 'Plugin Version header missing.' }
$version = $versionMatch.Groups[1].Value.Trim()
if ($version -notmatch '^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)(?:\.\d+)?)?$') {
    throw "Unsupported version format: $version"
}
$constantMatch = [regex]::Match($header, "define\(\s*'AI_MANGA_VIEWER_VERSION'\s*,\s*'([^']+)'\s*\)")
if (-not $constantMatch.Success -or $constantMatch.Groups[1].Value -cne $version) {
    throw 'AI_MANGA_VIEWER_VERSION does not match the plugin Version.'
}
$readme = [Text.Encoding]::UTF8.GetString($snapshots['readme.txt'])
$stableMatch = [regex]::Match($readme, '(?m)^Stable tag:\s*([^\r\n]+)')
if (-not $stableMatch.Success -or $stableMatch.Groups[1].Value.Trim() -cne $version) {
    throw 'readme Stable tag does not match the plugin Version.'
}
$metadata = [Text.Encoding]::UTF8.GetString($snapshots['blocks/viewer/block.json']) | ConvertFrom-Json
if ($metadata.name -cne 'ai-manga-viewer/viewer' -or $metadata.textdomain -cne 'ai-manga-viewer') {
    throw 'Unexpected block namespace or text domain.'
}
$libraryMetadata = [Text.Encoding]::UTF8.GetString($snapshots['blocks/library-viewer/block.json']) | ConvertFrom-Json
if ($libraryMetadata.name -cne 'ai-manga-viewer/library-viewer' -or $libraryMetadata.textdomain -cne 'ai-manga-viewer') {
    throw 'Unexpected Library block namespace or text domain.'
}

$releaseDir = Join-Path $projectRoot 'release'
if (Test-Path -LiteralPath $releaseDir) { Assert-RegularPath $releaseDir }
$destination = Join-Path $releaseDir "ai-manga-viewer-$version.zip"
if (Test-Path -LiteralPath $destination) {
    Assert-RegularPath $destination
    if (-not $Force) { throw "ZIP already exists. Use -Force to replace it after validation: $destination" }
}

# Fail closed if a required checker is unavailable or returns an error.
$php = (Get-Command php -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
$node = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
foreach ($relative in $runtimeFiles) {
    $source = Join-Path $projectRoot $relative
    if ($relative.EndsWith('.php')) {
        $previousErrorAction = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            & $php -l $source
            $syntaxExitCode = $LASTEXITCODE
        } finally { $ErrorActionPreference = $previousErrorAction }
        if ($syntaxExitCode -ne 0) { throw "PHP lint failed: $relative" }
    } elseif ($relative.EndsWith('.js')) {
        $previousErrorAction = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            & $node --check $source
            $syntaxExitCode = $LASTEXITCODE
        } finally { $ErrorActionPreference = $previousErrorAction }
        if ($syntaxExitCode -ne 0) { throw "JavaScript syntax check failed: $relative" }
    }
    if ((Get-Sha256 ([IO.File]::ReadAllBytes($source))) -cne (Get-Sha256 $snapshots[$relative])) {
        throw "Source changed during validation. Run the build again: $relative"
    }
}

New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
Assert-RegularPath $releaseDir
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$candidate = Join-Path $releaseDir ('.candidate-' + [guid]::NewGuid().ToString('N') + '.zip')
try {
    $archive = [IO.Compression.ZipFile]::Open($candidate, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($relative in $runtimeFiles) {
            $entry = $archive.CreateEntry('ai-manga-viewer/' + $relative, [IO.Compression.CompressionLevel]::Optimal)
            # Keep archives byte-for-byte reproducible instead of inheriting the build time.
            $entry.LastWriteTime = [DateTimeOffset]::new(1980, 1, 1, 0, 0, 0, [TimeSpan]::Zero)
            $stream = $entry.Open()
            try { $stream.Write($snapshots[$relative], 0, $snapshots[$relative].Length) }
            finally { $stream.Dispose() }
        }
    } finally { $archive.Dispose() }

    $archive = [IO.Compression.ZipFile]::OpenRead($candidate)
    try {
        if ($archive.Entries.Count -ne $runtimeFiles.Count) { throw 'Unexpected ZIP entry count.' }
        foreach ($relative in $runtimeFiles) {
            $entry = $archive.GetEntry('ai-manga-viewer/' + $relative)
            if ($null -eq $entry) { throw "ZIP entry missing: $relative" }
            $stream = $entry.Open()
            $buffer = [IO.MemoryStream]::new()
            try {
                $stream.CopyTo($buffer)
                if ((Get-Sha256 $buffer.ToArray()) -cne (Get-Sha256 $snapshots[$relative])) {
                    throw "ZIP content mismatch: $relative"
                }
            } finally { $stream.Dispose(); $buffer.Dispose() }
        }
    } finally { $archive.Dispose() }

    # Publish the local candidate only after every check succeeds.
    if (Test-Path -LiteralPath $destination) {
        if (-not $Force) { throw 'A ZIP appeared during build. Existing file preserved.' }
        Assert-RegularPath $destination
        [IO.File]::Replace($candidate, $destination, [System.Management.Automation.Language.NullString]::Value)
    } else {
        [IO.File]::Move($candidate, $destination)
    }
    Write-Output "PASS: $($runtimeFiles.Count) runtime files, namespace, versions, syntax and ZIP bytes verified."
    Write-Output "ZIP: $destination"
    Write-Output "SHA256: $((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant())"
} finally {
    # Delete only the unique candidate file created by this invocation; never recurse.
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { Remove-Item -LiteralPath $candidate -Force }
}
