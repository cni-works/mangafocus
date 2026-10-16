# Phase 3 — Cover image UI and panel-setting explanations

## 1. Starting point and boundaries
- Independent repository: C:\Dev\WordPress-Development\plugins\MangaFocus-Free-Next
- Branch: feature/free-reading-modes-ui-next; HEAD: 9f26de203c3e6a7a1909fbba195b0de7a0270809.
- Before: 16 tracked modifications and 7 new files from Phases 1/2. Changes are cumulative and uncommitted.
- Phase 1/2 ZIPs, old Free/worktree, Pro source/index/HEAD, SDK197, protected PNGs and existing artifacts remain protected.
- No ZIP, commit, deployment, WordPress/DB/license operation is part of this phase.

## 2. Cover UI and standard save — placement correction
The Cover image PanelBody is now the first child in the MangaFocus block's InspectorControls on amv_viewer, immediately before Page images. It is shown only when that block is selected. The five existing groups remain: Page images, Inline viewer, Fullscreen mode, Panel reading mode, General settings. Gutenberg supplies its existing Advanced panel afterwards; no duplicate Advanced panel is added. Ordinary posts/pages receive no custom cover panel.

Core/editor getEditedPostAttribute('featured_media') remains the only edited cover identity; editPost({featured_media: attachmentId}) changes draft state only. Publish/Update uses the normal core save to _thumbnail_id. Both the custom block control and native Featured image control read/update this same edited state, including before saving. No new block attributes, metadata or endpoints are added. Clearing sets zero, unlinks the image and retains first-page fallback without deleting an attachment. Save failure remains explicitly labelled.

## 3. Native panel coexistence — user-confirmed requirement
The earlier document placement prioritized access while a block was deselected but did not meet the intended beginner workflow. PluginDocumentSettingPanel, registerPlugin, the picker mount removal effect and all native panel removal/toggle actions have been removed. The now-unused wp-plugins dependency is removed; wp-editor/core-data remain for the standard post store/media selectors.

The native Featured image panel stays as WordPress normally displays it. There are two controls for one featured_media, not separate cover data. The block help explains this shared state. Deselecting the comic or selecting another block hides the custom Inspector panel but never removes the native panel or changes data. Reselecting reads the latest edited featured_media. The native panel also remains when custom UI cannot initialize. WordPress user's own display preferences still apply; the plugin does not change them.

No private API, DOM manipulation or automatic sidebar/tab switching is used. removeEditorPanel does not provide a public paired restore operation in the inspected API, so selection-dependent hide/restore was rejected. The user's subsequent explicit direction confirms coexistence, rather than native-panel hiding. The actual order of core Advanced and plugin third-party sections remains a real Gutenberg check.

Public API references:
- https://github.com/WordPress/gutenberg/blob/trunk/packages/block-editor/src/components/inspector-controls/README.md
- https://developer.wordpress.org/block-editor/reference-guides/data/data-core-editor/

## 4. Retiring automatic featured images
Removed the first-page sync helper, save_post_amv_viewer and rest_after_insert_amv_viewer registrations, and the direct registration call. No set/delete_post_thumbnail or tracking-meta migration remains in the plugin. Legacy _amv_auto_featured_image data is left untouched. Page creation, reordering, replacement and removal cannot invoke the retired code.

## 5. Existing covers and fallback
Existing _thumbnail_id values and image files remain. Library list, read-only amv_cover_url REST field, shortcode cover and analytics cover consumers still use ai_manga_viewer_library_cover_url: existing featured image first, otherwise first page attachment/image URL, otherwise empty. The helper never persists the fallback. The editor explicitly labels a first-page fallback as not a saved cover. First-page labels no longer imply it must be the configured cover. Removing a cover can still show page 1 as fallback.

## 6. Exact panel display behavior (engine unchanged)
Stored area.view values remain auto, focus, overview. Coordinates x/y are the region center in percent; width/height percentages are clamped to 5..100 for fitting. Let W,H be loaded image dimensions, Rw,Rh stage dimensions, w,h region percentages.
- auto: if w >= 74 AND h >= 68, show the full page; otherwise use focus fitting.
- focus: always fit the selected region, even if it meets those thresholds. This can reduce a large region; it does not guarantee enlargement.
- overview: always contain the entire page, ignoring region location/size and area.zoom.

Full-page scale=min(Rw/W,Rh/H), centered both ways. Focus contain scale=min(Rw/(W*w/100),Rh/(H*h/100)). Region aspect=(W*w)/(H*h). Wide progress=clamp((aspect-1.35)/(3.2-1.35),0,1); smart multiplier=1+0.25*progress. User zoom is clamped to 60..110%, then effective=min(1.25,userZoom*smartMultiplier). Focus scale=contain*deviceFactor*effective; deviceFactor is .92 at <=781 CSS px and .86 otherwise. The region center is centered in the stage; the page can extend beyond it. The 125% cap is this multiplier, not an absolute page magnification cap.

Landscape/portrait differences follow actual pixel aspect and available stage. A wide region can intentionally crop horizontally due to the smart multiplier. source natural dimensions are preferred; modal dimensions are fallback. A source change waits for modal load and then refits. Resize refits. PC/mobile use the same formula, but mobile has a larger fill factor; when mobileFocusReader is ON and viewport <=781px, mobileFocusAreas are used. An empty mobile set becomes a whole-page entry, not a runtime fallback to PC areas.

Use auto for ordinary panel sequences with occasional full-page views; focus to emphasize a selected region regardless of threshold; overview for establishing shots or reading the entire page. The separate Full page control can temporarily override the stored method.

## 7. Exact panel start behavior (engine unchanged)
focusReaderStartAtCurrent=false starts at the first sequence item. true finds the first panel/full-page item of the Viewer API's current logical page. It does not resume the exact panel index. Opening from inline, fullscreen or cover uses the same API page state. A fresh cover/panel-only viewer begins on page 1; panel navigation synchronizes that page state. Closing before the last page retains it, so panel-only true can resume on that page. Closing anywhere on the final logical page resets to page 1, even if it is not the final panel of that page. In a fullscreen spread, current means the API's logical page, not a separate panel-side choice. This setting therefore remains visible in panel-only mode; no saved flag is reset.

## 8. Panel UI/help and translations
New choice labels explain large-region automatic overview, fit-to-region, and full page. Help states the 74%/68% boundary and that full page ignores region/zoom. Start help explains page-level resume and final-page reset. Partial unconfigured pages remain whole-page sequence entries; all-unconfigured comics still cannot enable panel-only mode through Phase 1 guards. No geometry, engine, order, keys or sanitization logic is changed.

English gettext strings use mangafocus; the existing TSV/compiler generates POT/PO/MO and handle-based JSON. Previous map rows/catalog keys remain. Bundled JS handle JSON uses the existing wp_set_script_translations registration. Standard WordPress uses the supplied handle JSON before a global hashed language pack. Translation filters, missing bundles and user editor locale require real checks. PHP's existing global MO preference is unchanged. No PTE operations or translations-loader change.

## 9. Mobile investigations — proposals only
- Arrows: edge buttons occupy an absolute region over the pages, with pseudo-element guide arrows. Current edge-click and guide visibility share that surface. A future outside-gutter layout should reserve space and fall back in narrow columns; compact/translucent mobile controls should retain contrast, focus, hit targets and an obvious navigation alternative. No global overflow change: it could clip page turns, zoom and CTA.
- Zoom: when enableZoom and all control elements are present, two-finger touch and Ctrl+wheel drive plugin zoom; one-finger pan works when enlarged, alongside keyboard + / - / 0. This scales manga content, unlike browser page zoom. Removing the controls from DOM can disable zoom initialization; hiding every reset control also harms discoverability/accessibility. A future compact/reset control should keep a reachable non-gesture alternative, preserve PC behavior and test vertical-reading differences.
- Landscape fullscreen pages: the stage is horizontally centered, while canvases/spread surfaces use vertical-align:top and images are capped at viewport height minus128px. A short landscape page can therefore leave space below. Future vertical centering should be limited to paged, unzoomed display and measured against actual available controls; test portrait, spreads, rotation/dynamic mobile viewport, long controls and zoom transforms. Vertical reading needs its top-anchored flow preserved.
- Fullscreen spread page-turn animation remains a separate issue. None of these runtime/CSS changes is implemented.

## 10. Files
Phase-3 runtime edits: mangafocus.php, blocks/viewer/index.js, assets/panel-reader/editor.js.
Translation input/output: scripts/i18n-map.tsv and the existing POT, ja PO/MO, editor/panel-reader-editor JSON.
Existing tests updated: render-smoke.php, panel-reader-editor-smoke.cjs, inspector-groups-smoke.cjs.
New tests: cover-editor-smoke.cjs, cover-editor-browser-smoke.cjs. This design/test note is new. Phase 1/2 files remain uncommitted.

## 11. Local validation — placement correction
The tests now render the actual block Edit and check the first Cover image panel before Page images and the five existing groups. Unit and en/ja DOM doubles cover deselect/reselect, unselected native control access, selection/change/unlink, save failure and simulated save/reload. A native preview store double checks both directions before save: block selection/unlink reaches the native edited preview, and native selection/unlink reaches the selected block preview. Other block-setting changes retain cover and page/CTA data. Pro CTA inspector hooks remain after core groups.

Runtime contains no document panel registration, removeEditorPanel or toggleEditorPanelEnabled. Test spies reject native panel mutation. Unsupported permission/store/media states leave native access unchanged; normal posts/pages receive no cover Inspector. The standard component, media dialog, persistence and Gutenberg SlotFill selection behavior are doubles/local checks, not a real WordPress integration test.

Existing PHP/render, eight legacy renders, seven new modes, no implicit migration, library/shortcode, panel editing, en/ja groups, extensions and full public-browser regression remain required. Runtime engines, block schema, API1 and wp_kses are hash-compared to the pre-correction source.

## 12. Compatibility
No rendering-engine, block schema, modern/legacy interpretation, pages[], view values, start key, viewerKey/instanceKey/pageKey/CTA keys or public runtime changes are made in Phase 3. Old automatic covers stop following page 1 but keep their current saved identity. No automatic migration or bulk delete is introduced. Ordinary save must be verified in real WordPress.

## 13. Pro / Extension API
Extension API 1 and wp_kses allowlist remain. Public extension hooks and context remain. Pro source/SDK/CTA guard/license state are untouched. Existing CTA data survives page edits and registration mocks. Pro's cover consumers continue to receive the standard featured image or fallback URL. License and Pro real-site testing is outside this phase.

## 14. Real WordPress checks still needed
On a backed-up Free-only site: open an amv_viewer comic, select its MangaFocus block and open the Block tab. Confirm Cover image first, Page images next, then inline/fullscreen/panel/general and the native Advanced panel. Select/change/remove from the block, inspect native Featured image before saving, change/remove from native controls and immediately re-check the block. Verify Publish/Update/reload and failed-save behavior separately. Deselect/reselect and switch to another block without losing the shared edited state. Check ordinary posts/pages, user preferences/permissions, en/ja, real media and Gutenberg/API compatibility. Native controls remain by design; no automatic tab switching is expected. Existing covers, legacy automatic-tracking meta and fallback images must remain unchanged by unrelated saves.

## 15. Next step
Review this placement correction, then separately authorize a new verification ZIP if wanted. Existing Phase3 ZIPs retain the earlier document placement and do not include this correction. No new ZIP, commit, WordPress installation or UI-engine optimization was performed here.

Official sources inspected:
- https://developer.wordpress.org/block-editor/reference-guides/slotfills/plugin-document-setting-panel/
- https://developer.wordpress.org/block-editor/reference-guides/data/data-core-editor/
- https://developer.wordpress.org/block-editor/reference-guides/data/data-core-edit-post/
- https://raw.githubusercontent.com/WordPress/gutenberg/wp/6.3/packages/editor/src/components/post-featured-image/index.js
- https://raw.githubusercontent.com/WordPress/gutenberg/wp/6.3/packages/edit-post/src/store/actions.js
- https://raw.githubusercontent.com/WordPress/gutenberg/wp/6.3/packages/core-data/src/selectors.ts
- https://raw.githubusercontent.com/WordPress/WordPress/6.3-branch/wp-includes/rest-api/endpoints/class-wp-rest-posts-controller.php
