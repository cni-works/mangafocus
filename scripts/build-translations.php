<?php
/** Build bundled Japanese translations and optionally convert source strings to English. */

declare(strict_types=1);

$root = dirname(__DIR__);
$map_file = __DIR__ . '/i18n-map.tsv';
$convert = in_array('--convert-source', $argv, true);
$map = array();

foreach (file($map_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
	$parts = explode("\t", $line, 2);
	if (2 !== count($parts) || '' === $parts[0] || '' === $parts[1]) {
		throw new RuntimeException('Invalid translation map line: ' . $line);
	}
	if (isset($map[$parts[0]])) {
		throw new RuntimeException('Duplicate Japanese source string: ' . $parts[0]);
	}
	$map[$parts[0]] = $parts[1];
}

$runtime_sources = array(
	'mangafocus.php',
	'includes/settings.php',
	'includes/analytics/settings.php',
	'includes/panel-reader/renderer.php',
	'blocks/viewer/render.php',
	'blocks/viewer/index.js',
	'blocks/viewer/view.js',
	'blocks/library-viewer/index.js',
	'assets/panel-reader/editor.js',
	'assets/panel-reader/frontend.js',
	'blocks/viewer/block.json',
	'blocks/library-viewer/block.json',
);

$test_sources = array(
	'tests/settings-hub-smoke.php',
	'tests/render-smoke.php',
	'tests/browser-smoke.cjs',
	'tests/extensions-browser-smoke.cjs',
	'tests/panel-reader-editor-smoke.cjs',
	'tests/spread-browser-smoke.cjs',
);

if ($convert) {
	$replacement_map = $map;
	uksort($replacement_map, static function (string $left, string $right): int {
		return strlen($right) <=> strlen($left);
	});
	foreach (array_merge($runtime_sources, $test_sources) as $relative) {
		$path = $root . '/' . $relative;
		$source = file_get_contents($path);
		if (false === $source) {
			throw new RuntimeException('Could not read ' . $relative);
		}
		$converted = str_replace(array_keys($replacement_map), array_values($replacement_map), $source);
		if ($converted !== $source && false === file_put_contents($path, $converted)) {
			throw new RuntimeException('Could not write ' . $relative);
		}
	}

	$main = $root . '/mangafocus.php';
	$source = file_get_contents($main);
	$source = str_replace("_n( '%sページ', '%sページ'", "_n( '%s page', '%s pages'", $source);
	$source = str_replace("_n( '%sPage', '%sPage'", "_n( '%s page', '%s pages'", $source);
	file_put_contents($main, $source);
}

$catalog = array_flip($map);
$catalog['%s page'] = '%sページ';
$catalog['%s pages'] = '%sページ';
ksort($catalog, SORT_STRING);
$singular_page = '%s page';
$plural_pages = '%s pages';

$languages = $root . '/languages';
if (!is_dir($languages) && !mkdir($languages, 0777, true) && !is_dir($languages)) {
	throw new RuntimeException('Could not create languages directory.');
}

function po_quote(string $value): string {
	return '"' . addcslashes($value, "\\\"\n\r\t") . '"';
}

$header = "Project-Id-Version: MangaFocus 0.3.0\n"
	. "Report-Msgid-Bugs-To: https://github.com/cni-works/mangafocus/issues\n"
	. "POT-Creation-Date: 2026-10-04 00:00+0900\n"
	. "PO-Revision-Date: 2026-10-04 00:00+0900\n"
	. "Language: ja\n"
	. "MIME-Version: 1.0\n"
	. "Content-Type: text/plain; charset=UTF-8\n"
	. "Content-Transfer-Encoding: 8bit\n"
	. "Plural-Forms: nplurals=1; plural=0;\n"
	. "X-Domain: mangafocus\n";

$po = "msgid \"\"\nmsgstr \"\"\n";
foreach (explode("\n", rtrim($header)) as $line) {
	$po .= po_quote($line . "\n") . "\n";
}
$po .= "\n";
$pot = "msgid \"\"\nmsgstr \"\"\n" . po_quote("Project-Id-Version: MangaFocus 0.3.0\n") . "\n" . po_quote("Content-Type: text/plain; charset=UTF-8\n") . "\n" . po_quote("X-Domain: mangafocus\n") . "\n\n";
foreach ($catalog as $english => $japanese) {
	if ($singular_page === $english || $plural_pages === $english) {
		continue;
	}
	$po .= 'msgid ' . po_quote($english) . "\nmsgstr " . po_quote($japanese) . "\n\n";
	$pot .= 'msgid ' . po_quote($english) . "\nmsgstr \"\"\n\n";
}
$po .= 'msgid ' . po_quote($singular_page) . "\n"
	. 'msgid_plural ' . po_quote($plural_pages) . "\n"
	. 'msgstr[0] ' . po_quote('%sページ') . "\n\n";
$pot .= 'msgid ' . po_quote($singular_page) . "\n"
	. 'msgid_plural ' . po_quote($plural_pages) . "\n"
	. "msgstr[0] \"\"\n"
	. "msgstr[1] \"\"\n\n";
file_put_contents($languages . '/mangafocus-ja.po', $po);
file_put_contents($languages . '/mangafocus.pot', $pot);

function build_mo(array $messages): string {
	ksort($messages, SORT_STRING);
	$messages = array_merge(array('' => $GLOBALS['header']), $messages);
	$count = count($messages);
	$originals = '';
	$translations = '';
	$original_table = '';
	$translation_table = '';
	$original_offset = 28 + ($count * 16);
	$translation_offset = $original_offset;
	foreach ($messages as $original => $translation) {
		$translation_offset += strlen($original) + 1;
	}
	$current_original = $original_offset;
	$current_translation = $translation_offset;
	foreach ($messages as $original => $translation) {
		$original_table .= pack('VV', strlen($original), $current_original);
		$translation_table .= pack('VV', strlen($translation), $current_translation);
		$originals .= $original . "\0";
		$translations .= $translation . "\0";
		$current_original += strlen($original) + 1;
		$current_translation += strlen($translation) + 1;
	}
	return pack('V7', 0x950412de, 0, $count, 28, 28 + ($count * 8), 0, 0)
		. $original_table . $translation_table . $originals . $translations;
}

$mo_catalog = $catalog;
unset($mo_catalog['%s page'], $mo_catalog['%s pages']);
$mo_catalog["%s page\0%s pages"] = "%sページ\0%sページ";
file_put_contents($languages . '/mangafocus-ja.mo', build_mo($mo_catalog));

$script_sources = array(
	'ai-manga-viewer-editor' => 'blocks/viewer/index.js',
	'ai-manga-viewer-view' => 'blocks/viewer/view.js',
	'ai-manga-viewer-library-editor' => 'blocks/library-viewer/index.js',
	'ai-manga-viewer-panel-reader-editor' => 'assets/panel-reader/editor.js',
	'ai-manga-viewer-panel-reader-frontend' => 'assets/panel-reader/frontend.js',
);
$gettext_pattern = "/(?:__|_x|_n|_nx)\\(\\s*'((?:\\\\'|[^'])*)'/";
foreach ($script_sources as $handle => $relative) {
	$source = file_get_contents($root . '/' . $relative);
	preg_match_all($gettext_pattern, $source, $matches);
	$messages = array('' => array('domain' => 'messages', 'lang' => 'ja', 'plural-forms' => 'nplurals=1; plural=0;'));
	foreach (array_unique($matches[1]) as $english) {
		if (isset($catalog[$english])) {
			$messages[$english] = array($catalog[$english]);
		}
	}
	$data = array(
		'translation-revision-date' => '2026-10-04 00:00+0900',
		'generator' => 'MangaFocus scripts/build-translations.php',
		'source' => array($relative),
		'domain' => 'messages',
		'locale_data' => array('messages' => $messages),
	);
	file_put_contents(
		$languages . '/mangafocus-ja-' . $handle . '.json',
		json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n"
	);
}

echo 'PASS: generated Japanese PO, MO, POT and ' . count($script_sources) . " script catalogs.\n";
