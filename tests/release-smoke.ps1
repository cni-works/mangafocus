# Run against a disposable project copy, never mutate the real runtime files.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$fixture = Join-Path $PSScriptRoot ('.release-test-' + [guid]::NewGuid().ToString('N'))
$files = @('ai-manga-viewer.php', 'readme.txt', 'includes/features.php', 'includes/capabilities.php', 'includes/extensions.php', 'includes/settings.php', 'includes/analytics.php', 'includes/analytics/lifecycle.php', 'includes/analytics/storage.php', 'includes/analytics/settings.php', 'assets/admin-library.css', 'assets/admin-library.js', 'assets/admin-settings.css', 'blocks/library-viewer/block.json',
    'blocks/library-viewer/index.js', 'blocks/viewer/block.json',
    'blocks/viewer/layout.js', 'blocks/viewer/index.js', 'blocks/viewer/view.js', 'blocks/viewer/render.php',
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
    $firstRebuildHash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash
    & $builder -Force | Out-Null
    $secondRebuildHash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash
    if ($firstRebuildHash -cne $secondRebuildHash) {
        throw 'Consecutive builds must produce the same ZIP hash.'
    }
    $archive = [IO.Compression.ZipFile]::OpenRead($zip)
    try {
        $expected = @($files | Where-Object { $_ -notlike 'scripts/*' } | ForEach-Object { 'ai-manga-viewer/' + $_ })
        $entryNames = @($archive.Entries | ForEach-Object { $_.FullName })
        $diff = @(Compare-Object $expected $entryNames)
        if ($diff.Count -ne 0) { throw 'Unexpected archive file list.' }
        if (@($entryNames | Where-Object { $_ -match '(?i)ai-manga-viewer-pro|(^|/)(pro|premium|commercial)/' }).Count -ne 0) {
            throw 'Pro Add-on source leaked into the Free Core ZIP.'
        }
		if (@($entryNames | Where-Object { $_ -match '(?i)(consultation|admin-analytics|analytics/(?:queries|rest|admin))' }).Count -ne 0) {
			throw 'Pro-owned Analytics or AI Consultation runtime leaked into the Free Core ZIP.'
		}
		$editorSource = [IO.File]::ReadAllText((Join-Path $fixture 'blocks/viewer/index.js'))
		$rendererSource = [IO.File]::ReadAllText((Join-Path $fixture 'blocks/viewer/render.php'))
		$viewSource = [IO.File]::ReadAllText((Join-Path $fixture 'blocks/viewer/view.js'))
		$styleSource = [IO.File]::ReadAllText((Join-Path $fixture 'blocks/viewer/style.css'))
		if ($editorSource -match 'function ctaOf|CTA画像を選択|このページにCTAを表示' -or $rendererSource -match 'function ai_manga_viewer_page_cta' -or $viewSource -match 'notifyCtaClick|\.amv-reader__cta' -or $styleSource -match '\.amv-reader__cta') {
			throw 'Pro-owned CTA runtime or editor implementation leaked into the Free Core ZIP.'
		}
		if ($editorSource -match 'コマ読みを有効化|スマホ用にコマを追加|amv-reader__focus-area' -or $rendererSource -match 'amv-reader__focus-open|amv-modal__stage|data-amv-panel-reader' -or $viewSource -match 'parseAreas|focusFit|amv-modal__image' -or $styleSource -match '\.amv-modal|\.amv-reader__focus-open|\.amv-reader__focus-area') {
			throw 'Pro-owned panel reader runtime or editor implementation leaked into the Free Core ZIP.'
		}
		if ($editorSource -notmatch 'previous\.cta' -or -not $rendererSource.Contains("'cta' => `$cta") -or [IO.File]::ReadAllText((Join-Path $fixture 'ai-manga-viewer.php')) -notmatch 'ai_manga_viewer_sanitize_library_cta') {
			throw 'Core CTA compatibility preservation is missing from the Free Core ZIP.'
		}
		$blockMetadata = [IO.File]::ReadAllText((Join-Path $fixture 'blocks/viewer/block.json'))
		if ($editorSource -notmatch 'focusAreas:\s*areasOf\(\s*previous\s*\)' -or $editorSource -notmatch 'mobileFocusAreas:\s*areasOf\(\s*previous,\s*true\s*\)' -or $rendererSource -notmatch "'focus_reader'" -or $blockMetadata -notmatch '"focusReader"' -or $blockMetadata -notmatch '"focusReaderStartAtCurrent"' -or $blockMetadata -notmatch '"mobileFocusReader"' -or $viewSource -notmatch 'is-page-focus') {
			throw 'Core panel-reader compatibility schema or Free pageFocus runtime is missing from the Free Core ZIP.'
		}
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
