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
* Independent inline display, fullscreen display, and panel reading controls
* A cover launcher containing only the buttons for the enabled reading modes
* Grouped block settings and cover selection within Manga Library
* Reuse through Manga Library, the Registered Viewer block, and shortcodes

The one-page-at-a-time spread mode focuses on each complete page in reading order. Panel-by-panel reading instead follows the author-defined regions within each page.

= Creating and reusing comics =

Direct Viewer places a MangaFocus block directly in a post or page and stores the comic configuration with that block.

Manga Library stores a comic as a reusable entry. Select it with the Registered Viewer block or display it with a shortcode:

`[ai_manga_viewer id="123"]`

Registering a Direct Viewer in Manga Library creates an independent copy of its current configuration. Later edits are not synchronized automatically.

= Reading modes and settings =

Enable inline display to read within the post or page. When it is disabled, a cover and the launch buttons for the other enabled modes are shown. Disabling a mode keeps its page images, panel regions, and settings. Panel-only reading does not show an unrelated fullscreen launch button.

The block settings are grouped as Page images, Reading modes, Inline display settings, Fullscreen display settings, Panel reading settings, and Shared settings. Manga Library also has Cover image settings at the top.

Set a cover explicitly using the shared WordPress featured-image data. Existing covers are kept. If no cover is selected, page 1 is used only as a preview; the plugin no longer automatically sets or updates the featured image from page 1. Removing a cover does not delete its media file.


Choose a single-page, spread, or automatic layout. Spread and automatic layouts can show the first page as a standalone cover and can keep landscape images on their own page.

Fullscreen reading supports normal page navigation or continuous vertical scrolling. Spread-based comics can also focus on one complete page at a time while fullscreen.

= Pro add-on =

Panel reading is included in Free. A compatible Pro add-on supplies CTA, analytics reports, and AI support. Deactivating Pro keeps saved settings and Free reading.

= Data and privacy =

Free/Core does not collect public reader events, use external analytics or a CDN, generate images, or send content to an AI API. Reader event collection and reports require Pro and are disabled by default. Pro Analytics data is designed to stay in the site's local database; Core provides its table lifecycle, retention, and deletion settings.

Images hosted on another site are retrieved from that image host by the reader's browser.

== Installation ==

1. Install and activate MangaFocus.
2. Add the MangaFocus block to a post or page.
3. Select the page images in reading order.
4. In Reading modes, enable inline display, fullscreen display, panel reading, or a combination. At least one mode must remain enabled.
5. Adjust the enabled modes and Shared settings. To use panel reading alone, configure at least one panel.
6. In Manga Library, select a cover image above Page images. The standard Featured image controls use the same image. A separate cover does not replace page 1.
7. Preview the desktop and mobile layouts, then publish the post.

To reuse the same comic in multiple locations, copy a Direct Viewer into Manga Library with “Register in Manga Library.” Then add the Registered Viewer block to a post and select the comic, or use the shortcode shown in the Manga Library list.

== Frequently Asked Questions ==

= Does MangaFocus generate manga with AI? =

No. MangaFocus displays comic images in a reader on WordPress. It does not generate images.


= What is the difference between Direct Viewer and Manga Library? =

Direct Viewer stores a comic directly in a post or page. Manga Library manages a comic as a separate reusable entry that can be displayed with the Registered Viewer block or a shortcode.



= Can I offer only panel reading? =

Yes. Configure at least one panel, enable panel reading, and disable inline and fullscreen display. Pages without panels remain in the sequence as full pages. The cover then shows only the panel reading launch button.

= Does the smartphone setting enable panel reading on phones? =

No. Panel reading is available through its reading-mode switch. The smartphone option defines a separate set of panel regions. Existing mobile settings are kept, including empty arrays. Desktop regions initialize unset mobile settings only. At widths up to 781 CSS pixels, pages without mobile panels are shown as full pages.

= When are navigation arrows shown? =

Page-edge navigation must be enabled. The arrow option shows guides on the first displayed page only when off, or on every page when on. In inline display, eligible guides use available space beside the image or move below it without reducing the image width. Fullscreen and panel reading have their own controls.

= Does scroll adjustment align every page turn? =

No. It adjusts the comic position after document scrolling stops. It does not promise alignment after every page turn.

= Where do I set the cover? =

Edit the MangaFocus block in Manga Library and use Cover image above Page images. The standard Featured image panel remains available as a fallback; both controls edit the same WordPress featured image. Cover controls are not added to MangaFocus blocks in ordinary posts or pages.

= Can I use MangaFocus without the Pro add-on? =

Yes. Free/Core includes Panel-by-Panel reading, page navigation, spreads, automatic layouts, fullscreen viewing, vertical scrolling, zoom, Manga Library, Registered Viewer, and shortcodes.

= What happens if I deactivate the Pro add-on? =

Published comics continue to display with the regular Free Viewer. Saved Pro settings remain stored and can be used again after a compatible Pro add-on is reactivated.

= Is analytics data sent to an external service? =

Free/Core does not send reader data to an external analytics service. When Pro Analytics is used, data is designed to remain in the WordPress site's local database. Analytics is disabled by default.

= Does uninstalling MangaFocus delete comic data? =

Manga Library posts and post metadata are not deleted automatically. Analytics tables and settings are also retained by default. They are deleted only when “Delete on uninstall” has been enabled. The scheduled retention cleanup is removed during uninstall.

== Screenshots ==

1. Configure page images and reading modes in the block editor
2. Inline single-page reading
3. Two-page spread reading
4. Fullscreen page navigation
5. Fullscreen vertical scrolling
6. Manga Library

== Development ==

The distributed plugin contains its human-readable PHP, JavaScript, and CSS source. It does not use minified, bundled, or transpiled runtime files.

The maintained development repository is available at https://github.com/cni-works/mangafocus.

The release build tool is maintained in the development repository and is not included in the distributed plugin.

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
