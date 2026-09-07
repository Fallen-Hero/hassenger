# Hassenger support

Use GitHub Issues for reproducible defects and feature requests. Do not post access tokens, signed media URLs, exact home addresses, personal names, private conversation text, or unredacted screenshots.

Before reporting a problem:

For a content-free starting report, use the conversation menu's **Copy safe diagnostics**. New 1.0.0 options and limitations are documented in FEATURE_GUIDE.md. Do not attach conversation exports as diagnostics.

1. Confirm the browser console reports card `1.0.0` and Home Assistant reports integration `1.0.0`.
2. Replace the complete integration folder, restart Home Assistant, refresh the dashboard, and clear the frontend cache once.
3. Reproduce with the Modern Chat preset and without custom CSS.
4. Check whether the same problem occurs in a current desktop browser and the Home Assistant Companion App.
5. Enable **Advanced → Advanced / Debug** only long enough to collect non-sensitive version and event information.

For security vulnerabilities, use GitHub private vulnerability reporting instead of a public issue. See [SECURITY.md](SECURITY.md).

The maintainer cannot diagnose browser microphone denial, mobile notification permissions, or speaker firmware entirely from card logs. Include the operating system, browser/Companion App version, Home Assistant version, card/integration version, and minimal sanitized configuration.
