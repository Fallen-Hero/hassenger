# Contributing

Keep changes focused and preserve compatibility with existing `custom:ha-chat-card` dashboards. New documentation and test fixtures must use `Person #1` and `Person #2`; never commit real names, Home Assistant user or conversation IDs, notifier names, hostnames, IP addresses, workstation paths, access tokens, signed media URLs, or message history.

Before opening a pull request:

1. Run every Python contract test and every Playwright browser test in `tests/`.
2. Run the release privacy scan and Python/JavaScript syntax checks.
3. Test phone and tablet portrait/landscape layouts at 100% and 150% card scale.
4. If backend behavior changes, replace the complete integration folder and restart Home Assistant before manual testing.
5. Update `CHANGELOG.md`, README behavior, first-time setup, and any affected service or blueprint descriptions.

Do not weaken participant authorization, upload signature/size validation, escaping, custom-CSS end-tag protection, URL protocol checks, or administrator confirmation dialogs without a documented security review and regression test.
