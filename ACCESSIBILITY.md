# Accessibility and interaction checks

Hassenger is designed for keyboard, pointer, and touch use. Interactive icon buttons include accessible names; dialogs use modal roles, initial focus, Escape dismissal, and focus restoration; message actions can be reached by keyboard focus; and animated RGB/upload effects honor reduced-motion preferences.

Release testing covers:

- keyboard traversal through the header, conversation selector, transcript actions, Contacts, composer, menus, and dialogs;
- visible focus treatment in every preset;
- screen-reader names for icon-only buttons and form fields;
- 44–48 px editor controls and configurable large message-action targets on coarse pointers;
- 200% browser zoom and 75–150% card scale without horizontal clipping;
- light, dark, Retro, High Contrast, and RGB surfaces;
- reduced-motion behavior;
- portrait and landscape phone/tablet layouts.

Automated checks cannot certify a complete assistive-technology experience. Before release, manually test current VoiceOver on iOS/Safari, TalkBack on Android/Chrome, and a desktop screen reader. Confirm focus order, announcements, conversation changes, error/retry states, and dialog closure. Record any exception in `VALIDATION_REPORT.md`.
