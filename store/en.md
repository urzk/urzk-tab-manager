# Chrome Web Store listing (English)

Copy each section into the matching field of the Chrome Web Store Developer
Dashboard.

## Name

Urzk Tab Manager

## Short description

<!-- 129 characters (limit 132) -->

See and manage every tab in every window from your new tab page. Search by title, site or load state. Stays light with many tabs.

## Detailed description

Urzk Tab Manager replaces your new tab page with an overview of every open tab in every Chrome window, so you can find, organize and close tabs without hunting through crowded tab strips.

Features

• Every window at a glance. The current window is listed first and expanded; other windows can be expanded or collapsed. Each window shows its tab count, with buttons to minimize, focus or close it.
• Tab cards. Each tab shows its favicon, title and URL. Click a card, or press Enter, to switch to that tab. Unloaded (discarded) tabs are dimmed.
• Quick actions. Hover over a card to discard, close, pop out to a new window, move to the end of the current window, or move it up, down, left or right. With the keyboard, Enter switches to the focused tab and the arrow keys move it.
• Search. Type words to find tabs whose title contains them in that order (case-insensitive). Add site:example.com to match a site and its subdomains, and loaded: (or l:) to show only tabs that are loaded. Windows with no matches are hidden while you search.
• Toolbar button and shortcut. Click the toolbar button or press Alt+Shift+T to jump to the tab manager. If it is already open, that tab is focused instead of opening another one. You can change the shortcut at chrome://extensions/shortcuts.
• Designed for many tabs. The page is designed to stay light with many tabs. It follows Chrome's tab events and checks itself against Chrome regularly, so the list stays in sync with Chrome within seconds.
• English and Japanese, following your browser's language.

Privacy

Urzk Tab Manager reads the titles and URLs of your open tabs only to show and manage them on the new tab page. This information is handled in memory on your computer and is never saved or sent to the developer or anyone else. There are no analytics, no accounts and no remote code.

Urzk Tab Manager is free and open source software under the GPL-3.0-or-later license: https://github.com/urzk/urzk-tab-manager

## Category

Productivity (Workflow & Planning)

## Language

English

---

# Privacy practices tab

## Single purpose

Urzk Tab Manager has a single purpose: to show all open tabs in all windows on the new tab page and let the user find, switch to, move, discard and close them.

## Permission justification

### tabs

Read the titles and URLs of open tabs to list and manage them on the new tab page: showing each tab's title and URL, searching tabs, and switching to, moving, discarding and closing tabs at the user's request.

### favicon

Show the favicons that Chrome has cached for open tabs when a page's own icon is unavailable.

### Host permissions

None requested.

### Remote code

No, I am not using remote code. All JavaScript is packaged in the extension, and the Content Security Policy only allows scripts from the extension itself.

## Data usage

Check **Web history** only. Leave every other data type unchecked
(personally identifiable information, health information, financial and
payment information, authentication information, personal communications,
location, user activity, website content).

Web history is declared because the extension reads the titles and URLs of the
user's open tabs. Chrome Web Store asks for this disclosure even when the data
never leaves the device. If the dashboard asks how the data is used, enter:

> The titles and URLs of open tabs are read only to show the tab list on the new tab page and to carry out the user's actions (switch, move, discard, close). They are processed in memory on the user's device, are never stored, and are never sent to the developer or any third party.

Certifications (check all three):

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases.
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL

https://github.com/urzk/urzk-tab-manager/blob/main/PRIVACY.md
