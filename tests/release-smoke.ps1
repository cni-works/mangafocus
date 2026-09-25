# Run against a disposable project copy, never mutate the real runtime files.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$fixture = Join-Path $PSScriptRoot ('.release-test-' + [guid]::NewGuid().ToString('N'))
$files = @('ai-manga-viewer.php', 'readme.txt', 'blocks/viewer/block.json',
    'blocks/viewer/index.js', 'blocks/viewer/view.js', 'blocks/viewer/render.php',
    'blocks/viewer/style.css', 'scripts/build-release.ps1')
$utf8 = [Text.UTF8Encoding]::new($false)
function Expect-Failure([scriptblock]$Action, [string]$Message) {
    $failed = $false
    try { & $Action | Out-Null } catch {
        if ($_.Exception.Message -notlike "*$Message*") { throw }
        $failed = $true
    }
    if (-not $failed) { throw "Expected failure: $Message" }
    if ((Get-FileHash -LiteralPath $zip).Hash -cne $baselineHash) { throw 'Existing ZIP was modified by failed build.' }
}
try {
    foreach ($relative in $files) {
        $target = Join-Path $fixture $relative
        New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $root $relative) -Destination $target
    }
    # Development and OS files must not be copied into the ZIP.
    [IO.File]::WriteAllText((Join-Path $fixture 'desktop.ini'), 'exclude', $utf8)
    $builder = Join-Path $fixture 'scripts/build-release.ps1'
    & $builder | Out-Null
    $zip = @(Get-ChildItem -LiteralPath (Join-Path $fixture 'release') -Filter '*.zip')[0].FullName
    $baselineHash = (Get-FileHash -LiteralPath $zip).Hash
    Expect-Failure { & $builder } 'ZIP already exists'

    $readmePath = Join-Path $fixture 'readme.txt'
    $originalReadme = [IO.File]::ReadAllText($readmePath)
    [IO.File]::WriteAllText($readmePath, ($originalReadme -replace '(?m)^Stable tag:.*$', 'Stable tag: invalid'), $utf8)
    Expect-Failure { & $builder -Force } 'Stable tag does not match'
    [IO.File]::WriteAllText($readmePath, $originalReadme, $utf8)

    $css = Join-Path $fixture 'blocks/viewer/style.css'
    $cssBytes = [IO.File]::ReadAllBytes($css)
    Remove-Item -LiteralPath $css
    Expect-Failure { & $builder -Force } 'Required file missing'
    [IO.File]::WriteAllBytes($css, $cssBytes)

    $js = Join-Path $fixture 'blocks/viewer/index.js'
    $jsBytes = [IO.File]::ReadAllBytes($js)
    [IO.File]::WriteAllText($js, 'function {', $utf8)
    Expect-Failure { & $builder -Force 2>$null } 'JavaScript syntax check failed'
    [IO.File]::WriteAllBytes($js, $jsBytes)

    & $builder -Force | Out-Null
    $archive = [IO.Compression.ZipFile]::OpenRead($zip)
    try {
        $expected = @($files | Where-Object { $_ -notlike 'scripts/*' } | ForEach-Object { 'ai-manga-viewer/' + $_ })
        $diff = @(Compare-Object $expected @($archive.Entries | ForEach-Object { $_.FullName }))
        if ($diff.Count -ne 0) { throw 'Unexpected archive file list.' }
    } finally { $archive.Dispose() }
    if (@(Get-ChildItem -LiteralPath (Join-Path $fixture 'release') -Force -Filter '.candidate-*').Count -ne 0) {
        throw 'Candidate ZIP was left behind.'
    }
    Write-Output 'PASS: build, duplicate guard, version mismatch, missing file, syntax failure, preservation, Force replacement and exact ZIP file list.'
} finally {
    # Resolve and validate the disposable directory before recursive cleanup.
    if (Test-Path -LiteralPath $fixture) {
        $resolved = (Resolve-Path -LiteralPath $fixture).Path
        $parent = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') + '\'
        if (-not $resolved.StartsWith($parent, [StringComparison]::OrdinalIgnoreCase) -or
            [IO.Path]::GetFileName($resolved) -notlike '.release-test-*') { throw 'Unsafe cleanup path.' }
        $items = @((Get-Item -LiteralPath $resolved -Force)) + @(Get-ChildItem -LiteralPath $resolved -Recurse -Force)
        if (@($items | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count -gt 0) {
            throw 'Refusing recursive cleanup through a reparse point.'
        }
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
