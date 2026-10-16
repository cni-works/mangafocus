# WordPress.org asset candidates

These files are intended for the WordPress.org plugin-directory `assets`
location, separate from the plugin runtime package:

- `icon-128x128.png`
- `icon-256x256.png`
- `banner-772x250.png`
- `banner-1544x500.png`
- `screenshot-1.jpg`: block editor page setup
- `screenshot-2.jpg`: standard single-page view
- `screenshot-3.jpg`: spread view
- `screenshot-4.jpg`: fullscreen view
- `screenshot-5.jpg`: vertical reading view
- `screenshot-6.jpg`: Manga Library list

Both banner files retain the supplied MangaFocus PNG bytes. The icon files are
unchanged because the icon artwork does not contain the former product name.

The six screenshot files retain the supplied JPEG bytes. Their lowercase
filenames match the WordPress.org screenshot numbering used by `readme.txt`.

The Core release script uses an explicit runtime allowlist. Do not add this
directory or `branding/` to that allowlist.
