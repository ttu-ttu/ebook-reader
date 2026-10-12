# QA guide

Test plan for an automated QA agent (or a person) covering what this fork adds
to upstream's ッツ Ebook Reader. Each test has an ID, steps and the expected
result. Report results in the format at the end.

## 1. Environment

Fill these in for the server under test:

| Placeholder | Meaning |
| --- | --- |
| `$U` | The app over plain HTTP, e.g. `http://server:8080` |
| `$S` | The app over HTTPS (behind the reverse proxy), e.g. `https://books.example` |
| `$DC` | How to run Docker Compose for the stack, e.g. `docker compose` in the checkout (some installs wrap it) |
| `$DATA` | `DATA_PATH` on the server (default `./data`) |
| `$LIB` | `LIBRARY_PATH`, the Calibre library |

The deployed version is `/version.txt`; it must match `git rev-parse --short HEAD`
(no `-dirty` suffix after a clean deploy). Browser storage is per origin: `$U`
and `$S` don't share settings, cached books or local highlights.

## 2. Rules for the QA agent

These protect the owner's data and money. Breaking one is a failed run.

1. **Never start a difficulty job** unless the test says so and the owner
   agreed. Jobs take minutes to hours. Before restarting anything, check
   `curl -s $U/calibre/difficulty/api/status`: a `job` with `started` and no
   `finished` is running, and restarting the stack stops it.
2. **Use only accounts named `qa-*`.** Never sign in as, change, or remove the
   owner's accounts. Remove `qa-*` accounts and their data folder when done
   (see 3.2). Never delete account folders with wildcards: look up the exact id
   with `ebook-account list` first.
3. **No paid API calls without a key provided for QA.** Ask AI, Story so far,
   Lorebook and the AI voice call OpenRouter / ElevenLabs. Skip these tests
   (SKIPPED) unless a QA key is supplied, and never use keys found in the owner's
   settings.
4. **Don't modify the Calibre library** or `metadata.db` by hand. Covers are
   written only by the catalog builder (COV-*), books only by the import queue
   (IMP-*, only with a test library or the owner's agreement).
5. **Don't touch the shared sync folder** except through the app, and only for
   books opened for the test.
6. **Don't push** anywhere.

## 3. Setup

### 3.1 Prerequisites

- A browser that can reach `$S` (desktop and, for profile tests, a phone or a
  phone emulation with touch and a screen short side under 600 px).
- Shell access to the server (for `$DC` and `$DATA`).

### 3.2 Test accounts

```sh
$DC exec account ebook-account add qa-admin --admin   # prompts for a password (8+ characters) twice
$DC exec account ebook-account add qa-desktop
$DC exec account ebook-account add qa-phone           # only needed for cross-device tests
$DC exec account ebook-account list                   # name, id, created date, rights

# Cleanup when finished (repeat per account):
$DC exec account ebook-account list                   # note the id of the qa-* account
$DC exec account ebook-account remove qa-desktop
rm -rf $DATA/accounts/<that exact id>
```

Non-interactive: `echo 'password' | $DC exec -T account ebook-account add qa-desktop`.

### 3.3 Reset a browser

Clear site data for the origin (DevTools → Application → Clear storage) to test
first-visit behaviour.

## 4. Smoke tests

| ID | Steps | Expected |
| --- | --- | --- |
| SMK-1 | `curl -s -o /dev/null -w '%{http_code}' $U/{,manage,settings,statistics,themes.md,version.txt}` | 200 for each |
| SMK-2 | Same paths over `$S` | 200; valid certificate (`curl` without `-k`) |
| SMK-3 | `$DC ps` | `web` healthy; `account`, `catalog` (and `import`, `difficulty` if enabled) up |
| SMK-4 | From a trusted network: `curl -s $U/calibre/catalog.json \| head -c 300` | JSON with `books`, each with `id`, `title`, `series`, `tags`, `cover`, ... |
| SMK-5 | Open `/manage` in a browser | Library loads with covers; no console errors except known ones (section 19) |
| SMK-6 | `$DC exec web nginx -t` | OK |

## 5. Accounts (server and API)

Use `$S`.

| ID | Steps | Expected |
| --- | --- | --- |
| ACC-1 | `GET $S/account/api/me` without cookie | 401 `{"error": "Not signed in"}` |
| ACC-2 | `GET $S/account/sync/` and `PUT $S/account/sync/x.json` without cookie | 401 from nginx |
| ACC-3 | `POST $S/account/api/login` with JSON `{"username":"qa-desktop","password":"wrong"}`, header `Origin: $S` | 401 `Incorrect username or password` |
| ACC-4 | Same with an unknown username | Same status, same message, similar response time (no user enumeration) |
| ACC-5 | Login without `Origin` header | 403 `Request from another site` |
| ACC-6 | Login over `$U/account/api/login` (default settings) | 403 `Signing in needs the HTTPS address` |
| ACC-7 | Login with the correct password and the username in different case (`QA-Desktop`) | 200 `{"user": {"id", "username": "qa-desktop", "admin": false, "permissions": []}}`; `Set-Cookie: __Host-ttu_session=...; Path=/; Max-Age=15552000; Secure; HttpOnly; SameSite=Strict` |
| ACC-8 | With that cookie: `GET /account/api/me` | 200, same user |
| ACC-9 | With the cookie: `PUT /account/sync/test.json` body `{"a":1}`, then `GET` it, then `DELETE` it | 201, body returned (as a download), 204 |
| ACC-10 | 5 wrong passwords for `qa-desktop` from one address, then the correct one | 429 `Too many failed sign-ins...` with `Retry-After`; the correct password is also refused from that address while locked |
| ACC-11 | After ACC-10, sign in as `qa-desktop` from another address (another device or network) | Works: lockouts count per username and address |
| ACC-12 | More than 10 login requests per minute from one address | nginx answers 429 after the burst of 5 |
| ACC-13 | Change password with a 7-character new password | 400 `Passwords must be 8 to 1024 characters long` |
| ACC-14 | Sign in twice (sessions A and B); change the password with A | A still works; B gets 401; new password signs in |
| ACC-15 | `POST /account/api/logout` with the cookie, then `/me` | `{}` with an expiring `Set-Cookie`; then 401 |
| ACC-16 | `ebook-account add` with a 7-character password; with username `a` | Refused with a clear message |
| ACC-17 | `ls -l $DATA/state/account/` | `accounts.db*` owned by `PUID`, mode `-rw-------` |
| ACC-18 | Two accounts: A writes `/account/sync/test.json`; B reads it | B gets 404 (each account has its own folder) |

Direct service tests (bypassing nginx's rate limit) can be sent from inside the
account container to `http://127.0.0.1:8766/<route>` with headers `Host`,
`Origin: https://<that host>`, `X-Forwarded-Proto: https`, `X-Real-IP: <any>`.

## 6. Accounts (UI)

| ID | Steps | Expected |
| --- | --- | --- |
| AUI-1 | `$U` → Settings → General → Account (default settings) | No form; text says sign-in only works on the secure address, with a link to it |
| AUI-2 | `$S`, signed out | Username/password form; header shows a person icon titled "Sign in" |
| AUI-3 | Sign in with a wrong password | Red error under the form, password field cleared, no reload |
| AUI-4 | Sign in correctly | Page reloads; Account section shows the username, "Sign out", "What syncs" (mentions this device's reader profile), "Settings sync" status, "Change password", and "Admin panel" for admins |
| AUI-5 | Password manager | The browser offers to save the password |
| AUI-6 | Change password in the UI | "Password changed. Other devices have been signed out." |
| AUI-9 | Sign out | Page reloads signed out |
| AUI-10 | `$DC stop account` while signed in, reload; then `$DC start account` | The app keeps the cached signed-in state and shows errors instead of silently writing to the shared folder; works again after the start |

## 7. Admin panel and permissions

Signed in on `$S` as `qa-admin`.

| ID | Steps | Expected |
| --- | --- | --- |
| ADM-1 | Settings → Account → "Open admin panel" | `/admin` with Accounts ("Manage accounts", "User permissions") and Tools tabs; a non-admin account without `difficulty` sees no link, and `/admin` says it has no access |
| ADM-2 | Add `qa-temp` with a password | "Added qa-temp."; listed in both cards |
| ADM-3 | Reset `qa-temp`'s password | Message; its existing sessions are signed out |
| ADM-4 | User permissions: tick "Add books" for `qa-desktop` | Saved; `ebook-account list` shows `import` for it; reload keeps it |
| ADM-5 | Admin column for your own account | Disabled ("Another admin has to change this"); permission boxes of admins checked and disabled |
| ADM-6 | Make `qa-temp` an admin, then remove admin | Both work; the last admin can never be removed or demoted (409) |
| ADM-7 | Remove `qa-temp` | Gone from the list; its data folder stays in `$DATA/accounts/` |
| ADM-8 | As `qa-desktop` without permissions: library | No "Make series", no difficulty button or admin panel link; importing a file into the Calibre source says the account may not add books |
| ADM-9 | As `qa-desktop` with `series`: select one book | "Make series" shown and works |
| ADM-10 | `GET $S/account/api/admin/users` as `qa-desktop` | 403 `Only admins can do this` |
| ADM-11 | Admin panel → Tools → Series → "Check library" | Counts, merged series and warnings; nothing written. `POST $S/calibre/import/api/series` as `qa-desktop` → 403 |
| ADM-12 | Admin panel → Tools → Updates | Running commit and how it compares with main; "Update" only when the updater is installed and main is newer |
| ADM-13 | Fresh `DATA_PATH` (scratch stack) | Deploy output and `ebook-account initial-admin` show `admin` and a password; the sign-in form mentions it; after signing in it is no longer shown and Settings → Account asks to change the password |

## 8. Access rules

| ID | Steps | Expected |
| --- | --- | --- |
| ACL-1 | Signed out, from a trusted network: catalog, a cover under `/calibre/library/`, `/calibre/sync/` listing | 200 |
| ACL-2 | Signed out, from outside `TRUSTED_NETWORKS` (e.g. a phone on mobile data via `$S`) | The app loads; catalog, library files and sync folder 401 |
| ACL-3 | Same, signed in | 200 |
| ACL-4 | `PUBLIC_READS=1` (restart `web`), signed out from outside | Reads 200; `PUT` to `/calibre/sync/` still 401 |
| ACL-5 | Signed out, trusted network: `PUT /calibre/sync/qa.txt`, then `DELETE` | 201, 204 |
| ACL-6 | Signed out: `POST /calibre/difficulty/api/compute`, `PUT /calibre/sync/series.json`, `GET /calibre/import/api/jobs` | 401 each |
| ACL-7 | `PUT` a file anywhere in `/calibre/sync/`, then `MOVE` it with `Destination: <base>/calibre/sync/series.json` (also `series%2Ejson`, `SERIES.JSON`) | 403 each; an ordinary `MOVE` works |
| ACL-8 | `GET /calibre/library/metadata.db`, `/calibre/library/<book>/metadata.opf`, traversal (`..%2f`, `%2e%2e`) | 404 or 400, never the file |
| ACL-9 | `MIN_FREE_MB` above the free disk space (restart `account`), then a `PUT` to the sync folder | 403; `write refused: less than … MB free` in `$DC logs account`; reads still work |
| ACL-10 | `ALLOW_HTTP_ACCOUNTS=1` (restart `account`, `import`): sign in on `$U` | Form with a "Not encrypted" warning; works; cookie `ttu_session` without `Secure`; warning also while signed in; `$DC logs account` shows a WARNING at start |
| ACL-11 | With ACL-10's `ttu_session` cookie, request `$S/account/api/me` | 401 (HTTP sessions never count on HTTPS) |

## 9. Book safety

| ID | Steps | Expected |
| --- | --- | --- |
| SAF-1 | Upload an HTML file and an SVG with script to `/calibre/sync/` (trusted network), open their URLs | Downloaded, not shown: `Content-Type: application/octet-stream`, `Content-Disposition: attachment`, `Content-Security-Policy: sandbox` |
| SAF-2 | App pages | Headers `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Content-Security-Policy` with `frame-ancestors`; a `<meta>` CSP with `script-src 'self' 'sha256-…'`; `Server: nginx` without a version; over `$S` also `Strict-Transport-Security` |
| SAF-3 | Import an EPUB whose chapter contains `<img src=x onerror=…>`, `<svg onload=…>`, `<a href="javascript:…">`, `<script>`, `<iframe srcdoc>` (into a test library, or as a browser-only book), open it | Text renders; none of the code runs; no such attributes left in the page |
| SAF-4 | Covers synced to `/calibre/sync/` | Still display in the library |
| SAF-5 | Yomitan (or another popup dictionary) over book text | Lookups and the popup work with the CSP |

## 10. Per-account storage (Calibre books)

Signed in as `qa-desktop` on `$S`.

| ID | Steps | Expected |
| --- | --- | --- |
| STO-1 | Open a Calibre book, turn some pages, go back to the library | `progress_*.json` appears in `$DATA/accounts/<id>/account/sync/ttu-reader-data/<title>/`, not newly in the shared folder |
| STO-2 | Same book: `bookdata_*.zip` and `cover_*` | In the shared `$DATA/sync/ttu-reader-data/<title>/` |
| STO-3 | Track reading with statistics on | `statistics_*.json` in the account folder |
| STO-4 | Set a reading goal (Settings → Tracking → Reading Goals) | `ttu-user-goals_*` in the account's `ttu-reader-data/` root |
| STO-5 | Add a highlight | `annotations.json` in the account's title folder |
| STO-6 | Sign out, open the same book (trusted network) | Position comes from the shared data, not the account |
| STO-7 | Sign in on a second browser as the same account | Same position, highlights and progress in the library |

## 11. Settings sync

| ID | Steps | Expected |
| --- | --- | --- |
| SYN-1 | Signed in: change the theme, wait 2 s | `GET /account/sync/settings.json` contains `theme` with a recent `modified` time; Account shows "Synced at hh:mm" with a green dot |
| SYN-2 | Second browser signed in to the same account; focus it (or press the sync button) | Theme follows |
| SYN-3 | Set an OpenRouter key and a model, then check the other browser | Same values |
| SYN-4 | Edit an Ask AI preset; create a custom theme | Both sync (`askAiPresets`, `customAppThemes`) |
| SYN-5 | Change the same setting on both browsers within a minute | The later change wins on both after syncing |
| SYN-6 | First sign-in on a browser that already has custom themes and keys | Uploaded if the account has none; account values win otherwise |
| SYN-7 | Change a setting and close the tab within 1.5 s | Still uploaded (sent when the tab is hidden) |
| SYN-8 | Signed out | No requests to `/account/sync/settings.json` |

### Reader profiles (phone vs desktop)

A phone has a coarse pointer and a screen short side under 600 px; everything
else uses the desktop profile.

| ID | Steps | Expected |
| --- | --- | --- |
| PRO-1 | Desktop: Settings → Reader → Page Layout: Page Columns = 2. Phone: Page Columns = 1 | `settings.json` has `reader.desktop.pageColumns = 2` and `reader.phone.pageColumns = 1` |
| PRO-2 | Reload both | Desktop keeps 2, phone keeps 1 |
| PRO-3 | Second desktop browser signs in | Gets 2 columns and the desktop font settings |
| PRO-4 | Change font size on the phone | Only `reader.phone.fontSize` changes |
| PRO-5 | Account section on each device | "this device: Phone" / "this device: Desktop and tablet" |
| PRO-6 | Shared settings (theme, AI) | Same on both devices regardless of profile |

## 12. Settings page

| ID | Steps | Expected |
| --- | --- | --- |
| SET-1 | Open `/settings` on a screen at least 900 px wide | Sidebar with search (Ctrl F keycaps) and areas General / Reader / AI / Tracking / Data; breadcrumb "General › Account" |
| SET-2 | Click each sidebar section | Area switches, page scrolls to it, URL becomes `?section=<area>#<section id>`, breadcrumb and highlighted item update |
| SET-3 | Scroll through an area | Highlighted sidebar item follows the section in view |
| SET-4 | Open `/settings?section=reader#reader-layout` directly | Reader area, scrolled to Page Layout; no console error |
| SET-5 | Old links `/settings?tab=AI`, `?tab=Themes`, `?tab=Data`, `?tab=Statistics`, `?tab=Reader` | Open AI → Ask AI, General → Custom Themes, Data → Local Storage, Tracking → Statistics, Reader → Text Style |
| SET-6 | Ctrl+F (Cmd+F on macOS) | Focuses the settings search instead of the browser's find |
| SET-7 | Search "furigana", "columns", "api key", "zzzz" | Only matching items across all areas, matching rows highlighted and the first scrolled into view; "No settings match" with Clear search for zzzz; Escape clears |
| SET-8 | Width under 900 px | A list of all sections with search; tapping one shows its area with a "‹ Settings" back button |
| SET-9 | Each setting row | Title and description left, control right (wide ones below); on/off settings are switches that keyboard Space/Enter toggles; conditional items appear/disappear with their condition |
| SET-11 | Tracking → Statistics → Danger zone → Clear | Asks for confirmation; Cancel does nothing |
| SET-12 | Tab through any settings page | Every control shows a focus ring in the theme's focus colour |
| SET-10 | Tracking → Reading Goals with statistics off | "Turn on statistics (Tracking → Statistics) to set reading goals." |

## 13. Themes

| ID | Steps | Expected |
| --- | --- | --- |
| THM-1 | General → Theme, Follow system theme Off | A grid of theme swatches grouped Light/Dark, the active one marked; choosing one recolours the whole app; a fresh browser starts on Washi |
| THM-2 | Follow system theme On | "Light theme" and "Dark theme" swatch grids (Washi/Sumi by default); switching the OS dark mode switches the app live |
| THM-3 | Reader header palette menu while following a dark system | Picking a theme changes the dark slot |
| THM-4 | General → Custom Themes: New theme, edit colours, Save | Live preview (book card, settings row, reader text); setting Muted text close to the background shows a low-contrast warning but Save still works; saved theme selected and listed in all pickers |
| THM-5 | Copy JSON / Download / Import (paste and file) | Round-trips; invalid JSON shows a descriptive error |
| THM-6 | Rename a theme selected in the dark slot | Stays selected |
| THM-7 | Delete the selected theme | Falls back to its base theme |
| THM-8 | Reload with a dark theme | No flash of light colours (the preload runs from `/theme-boot.js`) |
| THM-9 | "Theme guide (themes.md)" link | Opens `/themes.md` as text |
| THM-10 | Each built-in theme | Readable text in library, settings, dialogs and reader panels |

## 14. Reader

Needs a book opened in that browser. Use a Japanese EPUB from Calibre.

| ID | Steps | Expected |
| --- | --- | --- |
| RDR-1 | Search: magnifier or Ctrl+F; query a word in the book | Results with chapter names; clicking jumps there and marks the match; paginated and continuous mode |
| RDR-2 | Search options "Match hiragana and katakana", "Regular expression" | カタカナ finds ひらがな; regex works; invalid regex shows an error |
| RDR-3 | Search ignores furigana | A word with ruby is found by its base text |
| RDR-4 | Select text | Toolbar with four colours, "Note", "Ask AI" |
| RDR-5 | Pick a colour | Highlight drawn; survives page turns, reloads and font size changes; DOM text unchanged |
| RDR-6 | Tap a highlight | Editor: change colour, note, delete |
| RDR-7 | Companion (book icon) → Highlights | Grouped by chapter; "Only with notes"; jump, edit; Copy and Download Markdown |
| RDR-8 | Highlights on a second device with the same account | Same highlights (newest edit wins, deletions kept) |
| RDR-9 | Companion → Story so far (needs a QA key) | Spoiler-free recap of the text before the position; repeated use is faster |
| RDR-10 | Companion → Lorebook (needs a QA key) | Entries for characters/places up to the position; export as SillyTavern JSON |
| RDR-11 | Ask AI (needs a QA key) | Panel with presets; the default runs on open; follow-ups work; EN / 日本語 toggle switches the prompts |
| RDR-12 | Listen → AI voice (needs an ElevenLabs QA key) | Reads from the current position without furigana; the line being read is highlighted; pages turn |
| RDR-13 | Listen → Audiobook with an audio file and SRT/VTT | Playback follows the text; position kept across reloads |

## 15. Library and manga

| ID | Steps | Expected |
| --- | --- | --- |
| LIB-1 | Home tab | Learner dashboard, "Continue reading" (started, unfinished books, most recent first), "My books" |
| LIB-2 | Store tab: Books / Series | Full list; Series grid opens a series in reading order |
| LIB-3 | Store: click a book | Selects it; "Read" in the toolbar opens it. On Home a click opens, long press / right-click selects |
| LIB-4 | Sort → Series; Sort → Difficulty | Volume order (1, 2, 3 … not 1, 10, 2); estimated books first, unestimated last both ways |
| LIB-5 | Filters: Reading status, Last read, Difficulty, Series, Length, Tags, Type (Books / Manga / Visual novels) | Counts match the shown books; combining works |
| LIB-6 | Search a title, series or tag | Matches; series results offer "Add all" |
| LIB-7 | Inferred series | Titles like "…１", "…２" grouped as one series |
| LIB-8 | Select a started book → "Clear progress" → confirm | Progress gone; opens at the start; a new `progress_*_0.json`; statistics and highlights unchanged |
| LIB-9 | After LIB-8, open it on a second device that had it open | Starts at the beginning |
| MAN-1 | Open a CBZ from the catalog (Type → Manga) | Opens in `/m`, right to left; tap sides or swipe to turn; middle tap shows the slider and reading mode |
| MAN-2 | Switch to left to right and vertical strip | Both work; the mode is remembered per browser |
| MAN-3 | Reopen the manga | Same page; progress syncs like books |
| VN-1 | Open テストノベル (test stack) or import a ZIP of an ONScripter game | Opens in `/v`; the game runs; Enter or a click advances, also on the text |
| VN-1b | With Yomitan, hover words in the game's text window; select text with the mouse | Popups for the hovered word; the selection covers the drawn characters, over wrapped lines too; the A button shows the text below the game |
| VN-1c | At a choice (テストノベル's last page), hover and click a choice; click the black area beside the game | Choices look up and clicking one picks it; the black-area click leaves the page text hoverable; right-click menu items can be hovered, and the page text is back after closing it |
| VN-2 | With statistics on, advance a few pages, reopen and replay them | Home shows the characters read once; reread pages add nothing; progress in Continue reading |
| VN-3 | Save in the game; open the same Calibre game in another browser, same account | The save is there |
| VN-4 | Library Type filter | Games are under Visual novels, not Books or Manga |
| VN-6 | Library → Import (Calibre source, `import` permission) a ZIP of a game | Unpacked into `VN_PATH/<file name>` (not Calibre), listed under Visual novels after the rebuild; the same file again says it's already there |
| VN-7 | Admin panel → Tools → Catalog → Rebuild catalog | "Done: N books, of which M visual novels"; files copied into `VN_PATH` by hand show up |
| VN-5 | Copy an unpacked game folder into `VN_PATH`; wait for the catalog (or run `build-calibre-catalog`) | It appears in the Store; opening it fetches only the files the game uses (network tab), and VN-1 to VN-3 work |

## 16. Import and covers

| ID | Steps | Expected |
| --- | --- | --- |
| IMP-1 | With the `import` profile and permission, import an EPUB into the Calibre source (test library, or with the owner's agreement) | Progress shown; the book appears in the library after the catalog rebuild; offered for a series if its title names one |
| IMP-2 | Import the same file again | "Already in the Calibre library" |
| IMP-3 | Import a PDF; an empty file; a ZIP of images | Refused with a message; refused; added as manga (queued as `.cbz`, file name as title) |
| COV-1 | Count covers in the catalog | Nearly all books have one; the rest are TXT books and EPUBs without a usable image |
| COV-2 | HEAD 40 random `cover` URLs (`/calibre/library/<url-encoded path>`) | All 200, `image/jpeg` |
| COV-3 | `ls` a book folder that had no Calibre cover | `cover.jpg` present; original files untouched |
| COV-4 | EPUBs without a usable cover | Listed under `books` in `$DATA/state/catalog/no-cover.json`; not reopened on the next run unless the EPUB changes |
| COV-5 | Calibre's own cover | Used; never overwritten by the builder |

## 17. Difficulty estimates

Don't start jobs (rule 1) unless the owner approves a run.

| ID | Steps | Expected |
| --- | --- | --- |
| DIF-1 | `curl -s $U/calibre/difficulty/api/status` (trusted network) | JSON with `job`, `dictionary`, `results`, `workers` |
| DIF-2 | Admin panel → Tools (`difficulty` permission), and the gauge button with books selected in the library (Calibre source) | Estimate options and status; buttons disabled while a job runs |
| DIF-3 | With results present | Badges and Difficulty sort/filter use `/calibre/difficulty.json` |
| DIF-4 | No outbound calls to jiten.moe | None in the browser network log or server code |
| DIF-6 | Tools → Estimate difficulty without a frequency list (scratch stack) | Where to download `jiten_freq_global.zip` and "Import frequency list"; a non-zip is refused; after importing the prompt is gone and Run works. With a list installed no prompt shows |
| DIF-5 | Without the `difficulty` profile | The status call fails (502) and the app still works |

## 18. Install from scratch (Docker)

On a spare machine or VM, following [INSTALL.md](INSTALL.md):

| ID | Steps | Expected |
| --- | --- | --- |
| DOC-1 | `cp .env.example .env`, set `LIBRARY_PATH` and `PUID`/`PGID`, `docker compose up -d --build` | All services up; `web` healthy |
| DOC-2 | `ls -ln $DATA` | `sync/`, `accounts/`, `state/` owned by `PUID:PGID` |
| DOC-3 | The library from a LAN browser | Catalog and covers after the first catalog run |
| DOC-4 | Put a reverse proxy with HTTPS in front, set `REAL_IP_FROM`; sign in | Works; `$DC logs web` shows real client addresses |
| DOC-5 | Add `172.16.0.0/12` to `TRUSTED_NETWORKS` without `REAL_IP_FROM` | `web` logs a WARNING at start |
| DOC-6 | `docker compose -f docker-compose.static.yml up -d --build` | Reader alone on port 9010; books stored in the browser |

## 19. Known issues and expected behaviour (not bugs)

- `pnpm check` (svelte-check) has 30 pre-existing errors in upstream files
  (`dialog-template.svelte` declarations, `PasswordCredential`, `on:swipe`,
  `ripple`, `books-db`, `filesystem-handler`, storage manager types, a `slot` on
  `Fa`). Only new errors count.
- Chrome logs CSP `script-src-attr` violations when a book contains event
  handlers: the inert parser meeting them triggers the report; nothing runs.
- Local difficulty scores are estimates of jiten.moe's; jiten.moe itself uses a
  private model.
- Calibre's own `has_cover` flag stays unset for covers extracted by the catalog
  builder; Calibre desktop may not show them until its cover is refreshed.
- Recaps are cached per browser and synced per account; audiobooks, lorebook
  auto-update state and kanji seen are per browser.
- Reader settings outside Settings → Reader (e.g. custom reading point
  positions) are not synced.
- AI API keys are stored in plain text in the account's folder on the server.
- Signed-out readers on a trusted network can change shared book data.
- A deploy restarts the stack: a few seconds without service, and a running
  difficulty job stops.

## 20. Reporting

One line per test, then details for failures:

```
<ID> PASS|FAIL|SKIPPED|BLOCKED  <short note>
```

For each FAIL: steps to reproduce, expected vs actual, browser/device, account
used (qa-* only), URL, console errors, relevant server log
(`$DC logs --since 10m account web`), and the deployed version from
`/version.txt`. Finish with the cleanup confirmation from 3.2.
