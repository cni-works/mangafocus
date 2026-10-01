# WordPress.org asset candidates

These files are intended for the WordPress.org plugin-directory `assets`
location, separate from the plugin runtime package:

- `icon-128x128.png`
- `icon-256x256.png`
- `banner-772x250.png`
- `banner-1544x500.png`

`banner-772x250.png` is a lossless PNG conversion of the supplied
`branding/source/banner-772x250.jpg`. The other three public candidates retain
the supplied PNG bytes.

The Core release script uses an explicit runtime allowlist. Do not add this
directory or `branding/` to that allowlist.
