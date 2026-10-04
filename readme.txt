=== MangaFocus – Panel-by-Panel Manga Reader ===
Contributors: cniworks
Tags: manga, comic, viewer, reader, gutenberg
Requires at least: 6.3
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.3.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Publish image-based comics with panel-by-panel reading, page turns, spreads, fullscreen, vertical scrolling, zoom, and Manga Library.

== Description ==

= About MangaFocus =

MangaFocus is a WordPress plugin for publishing comics made from image files. Its panel-by-panel reader lets authors define regions on each page so readers can move through the comic one panel at a time. It also provides page-by-page reading, two-page spreads, fullscreen viewing, vertical scrolling, zoom and pan controls, and reusable Manga Library entries.

The plugin does not generate images and does not send content to an AI API. It can display AI-assisted artwork, conventionally created comics, company introductions, brochures, and other image-based publications.

= Free features =

* A MangaFocus block for posts and pages
* Panel-by-panel reading with author-defined panel regions
* Separate optional panel regions for mobile screens
* Single-page, two-page spread, and responsive automatic layouts
* Optional standalone cover pages and standalone handling for landscape images
* Right-to-left and left-to-right binding
* Fullscreen page navigation and vertical scrolling
* A fullscreen mode that focuses on one page at a time within a spread
* Zoom, pan, keyboard, swipe, and page-edge controls
* A cover launcher that shows only the cover and a reading button in the page
* Reuse through Manga Library, the Registered Viewer block, and shortcodes

The one-page-at-a-time spread mode focuses on each complete page in reading order. Panel-by-panel reading instead follows the author-defined regions within each page.

= Creating and reusing comics =

Direct Viewer places a MangaFocus block directly in a post or page and stores the comic configuration with that block.

Manga Library stores a comic as a reusable entry. Select it with the Registered Viewer block or display it with a shortcode:

`[ai_manga_viewer id="123"]`

Registering a Direct Viewer in Manga Library creates an independent copy of its current configuration. Later edits are not synchronized automatically.

= Layout and reading modes =

Choose a single-page, spread, or automatic layout. Spread and automatic layouts can show the first page as a standalone cover and can keep landscape images on their own page.

Fullscreen reading supports normal page navigation or continuous vertical scrolling. Spread-based comics can also focus on one complete page at a time while fullscreen.

= Pro add-on =

The Core plugin can be extended by a compatible Pro add-on. Pro features include calls to action, analytics reports, AI consultation material, and AI manga production support. Panel-by-panel reading is included in Free/Core.

When the Pro add-on is inactive, published content falls back to the regular Free Viewer. Saved Pro settings remain stored so that a compatible add-on can use them again later.

= Data and privacy =

Free/Core does not collect reader events on the public site. It does not send telemetry, use an external analytics service, depend on a CDN, or automatically send content to an external API.

Analytics is disabled by default. If Pro Analytics is used, its data is designed to remain in the local database of the WordPress site. Administrators can configure the retention period and delete stored analytics data.

Core contains the local Analytics table lifecycle, retention schedule, and deletion settings required for compatibility and stored-data management. Without the Pro add-on, no new reader events are collected.

If a site owner uses an image URL hosted on another site, the reader's browser connects to that image host to retrieve the file.

== Installation ==

1. Install and activate MangaFocus.
2. Add the MangaFocus block to a post or page.
3. Select the page images in reading order.
4. Configure the page layout, binding direction, fullscreen mode, vertical scrolling, zoom, and Panel-by-Panel reading.
5. Preview the desktop and mobile layouts, then publish the post.

To reuse the same comic in multiple locations, copy a Direct Viewer into Manga Library with “Register in Manga Library.” Then add the Registered Viewer block to a post and select the comic, or use the shortcode shown in the Manga Library list.

== Frequently Asked Questions ==

= Does MangaFocus generate manga with AI? =

No. MangaFocus displays comic images in a reader on WordPress. It does not generate images.

= Can I use it with conventionally created comic images? =

Yes. It works with conventionally created comics, AI-assisted artwork, company introductions, brochures, and other image-based publications.

= What is the difference between Direct Viewer and Manga Library? =

Direct Viewer stores a comic directly in a post or page. Manga Library manages a comic as a separate reusable entry that can be displayed with the Registered Viewer block or a shortcode.

= Does a Direct Viewer stay synchronized after registration in Manga Library? =

No. Registration creates an independent copy. The Direct Viewer and Manga Library entry are managed separately afterward.

= What is the difference between a spread and focusing on one page at a time? =

A spread shows two pages together. “Focus on one page at a time” keeps the spread structure while focusing on each complete page in fullscreen. Panel-by-Panel reading instead enlarges the author-defined regions within each page.

= Can I use MangaFocus without the Pro add-on? =

Yes. Free/Core includes Panel-by-Panel reading, page navigation, spreads, automatic layouts, fullscreen viewing, vertical scrolling, zoom, Manga Library, Registered Viewer, and shortcodes.

= What happens if I deactivate the Pro add-on? =

Published comics continue to display with the regular Free Viewer. Saved Pro settings remain stored and can be used again after a compatible Pro add-on is reactivated.

= Is analytics data sent to an external service? =

Free/Core does not send reader data to an external analytics service. When Pro Analytics is used, data is designed to remain in the WordPress site's local database. Analytics is disabled by default.

= Does uninstalling MangaFocus delete comic data? =

Manga Library posts and post metadata are not deleted automatically. Analytics tables and settings are also retained by default. They are deleted only when “Delete on uninstall” has been enabled. The scheduled retention cleanup is removed during uninstall.

== Screenshots ==

1. Configure comic pages in the block editor
2. Standard single-page reading
3. Two-page spread reading
4. Fullscreen page navigation
5. Fullscreen vertical scrolling
6. Manga Library

== Development ==

The distributed plugin contains its human-readable PHP, JavaScript, and CSS source. It does not use minified, bundled, or transpiled runtime files.

The maintained development repository is available at https://github.com/cni-works/mangafocus.

The release build tool is included at `scripts/build-release.ps1`. Run `powershell -File scripts/build-release.ps1` from the plugin directory. The script uses an explicit allowlist and runs PHP and JavaScript syntax checks before creating the archive.

== Changelog ==

= 0.3.0 =

* Renamed the plugin to MangaFocus and aligned the distribution slug and Text Domain with `mangafocus`.
* Added author-defined Panel-by-Panel reading to Free/Core.
* Added Manga Library, the Registered Viewer block, and shortcodes.
* Added single-page, spread, automatic, standalone cover, and standalone landscape layouts.
* Added fullscreen page focus, vertical scrolling, zoom, and the fullscreen cover launcher.
* Added Manga Library cover management, the admin list, and copying from Direct Viewer.
* Added Feature, Capability, and Extension APIs with a compatibility schema that preserves Pro settings.
* Added local Analytics storage, retention, and cleanup infrastructure while keeping the collector and reports outside Free/Core.
* Added bundled English and Japanese localization, REST argument definitions, documentation, and a reproducible WordPress.org release build.

= 0.2.0-alpha =

* Improved page navigation, right-to-left and left-to-right binding, swipe gestures, and keyboard controls.
* Added fullscreen viewing, free zoom, pinch gestures, and panning.
* Added the initial Manga Library and Registered Viewer infrastructure.

= 0.1.0-alpha =

* Initialized the standalone WordPress plugin under its former AI Manga Viewer name.
