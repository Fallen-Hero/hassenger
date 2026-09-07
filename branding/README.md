# Hassenger branding

This folder contains the three original Hassenger designs selected by the project owner and the approved full-logo presentation assets. The originals are preserved byte-for-byte and must not be replaced with redraws.

## Original files

- `hassenger-original-mark.png`: standalone house-and-bubbles mark, 1254 × 1254 with transparency.
- `hassenger-original-wordmark-wide.png`: original wide Hassenger wordmark, 1734 × 907.
- `hassenger-original-wordmark-banner.png`: original banner Hassenger wordmark, 1961 × 802.

The two supplied wordmark PNGs contain the visible checkerboard in their original pixels. They remain unchanged here so the selected source artwork is preserved exactly.

## README full logo

- `hassenger-full-logo-transparent.png`: approved full logo for dark backgrounds, 2048 × 512 with genuine transparency; white “Hass” and cyan “enger”.
- `hassenger-full-logo-light.png`: the same composition for light backgrounds, with dark “Hass” for legibility.
- `hassenger-full-logo-banner.png`: the approved white/cyan full logo on a solid dark backdrop, 2048 × 512. This is the HACS-compatible README presentation.

These combine the unchanged transparent original house-and-bubbles image with the full Hassenger lettering. The original rounded bubbles and centered dots are not redrawn. The README uses a standard Markdown image with an absolute URL instead of theme-switching HTML, which HACS does not reliably render. Its solid backdrop keeps the lettering readable in light and dark views. None of these presentation assets contains a checkerboard background.

## Home Assistant and HACS

`custom_components/hassenger/brand/icon.png` and `icon@2x.png` are the required 256 × 256 and 512 × 512 runtime sizes generated directly from `hassenger-original-mark.png`. No additional standalone artwork replaces the three originals; the card's configurable, preset-aware header identity is rendered by the card itself.

Original-file SHA-256 hashes are enforced by the release-layout test.
