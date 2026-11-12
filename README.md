# Daftar

A personal spending ledger that looks and feels like a typewritten paper notebook. It's for one person on one device: no accounts, no backend, and your data never leaves the phone. Amounts are in Bahraini dinars (BD, 3 decimals).

- **Quick add.** The pen button opens a sheet. Type an amount and what it was for (suggestions are ranked by how often you use them), then write it down.
- **Monthly items.** Savings, gym, subscriptions and so on are written into the ledger automatically each month on their day. Missed months are filled in when you next open the app. Day 31 falls on the last day of shorter months.
- **Month view.** A sticky-note summary shows Fixed, Spent, Saved, Total out and Left this month. Entries are grouped by day, and a breakdown shows where the money went.
- **Settings.** Monthly income, Day/Night paper, CSV export and import (validated, with a preview), and an erase that you have to confirm by typing.
- **Works offline and installs** on Android and iPhone. The app shortcut "Add expense" opens straight into quick add.

## Run it

You need Node 20 or newer (it's developed on Node 24).

```bash
npm install
npm run dev        # http://localhost:5173
```

In development you can pretend it's another day to try out the monthly backfill. Add `?today=2027-03-10` to the URL. This only works in dev, and it's remembered for the tab.

```bash
npm test           # unit + IndexedDB integration tests (Vitest)
npm run typecheck
npm run build      # production build in dist/, including the service worker
npm run preview    # serve dist/ at http://localhost:4173
npm run icons      # regenerate PNG icons from public/icon.svg
```

The service worker only runs in the production build (`npm run build && npm run preview`), not in `npm run dev`.

## Deploy as a static site

The build is plain static files with relative paths, so it works at a domain root or under a subpath. Installing requires HTTPS, and both options below give you that.

### GitHub Pages

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages → Build and deployment** and set **Source: GitHub Actions**.
3. Push to `main`. [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs the tests, builds, and publishes `dist/` to `https://<you>.github.io/<repo>/`.

### Netlify

Connect the repo in Netlify, or run `npx netlify deploy --prod --dir dist` after a build. [`netlify.toml`](netlify.toml) sets the build command and makes sure `sw.js` is never cached, so updates reach installed apps.

## Install on your phone

- **Android (Chrome):** open the site, then tap **⋮ → Install app** (or accept the install banner). Long-press the icon for the **Add expense** shortcut.
- **iPhone (Safari):** open the site, tap **Share → Add to Home Screen**. iOS doesn't support app shortcuts, so open the app and tap the pen.

When a new version is deployed, the app shows "A new version of Daftar is ready" with a **Reload** button.

## How it works

| Area | Where |
| --- | --- |
| Money parsing/formatting (integer fils only) | [`src/lib/money.ts`](src/lib/money.ts) |
| Recurring planner (idempotent, backfill, clamping) | [`src/lib/recurring.ts`](src/lib/recurring.ts) |
| Totals, day groups, breakdown | [`src/lib/totals.ts`](src/lib/totals.ts) |
| CSV export/import + validation | [`src/lib/csv.ts`](src/lib/csv.ts) |
| IndexedDB (via `idb`) | [`src/db/db.ts`](src/db/db.ts) |
| App state (Preact signals) | [`src/state/store.ts`](src/state/store.ts) |
| Notebook styles | [`src/styles/`](src/styles) |

**Money.** Every amount is stored as an integer number of fils (1 BD = 1000 fils). Input like `3`, `3.5`, `3.250`, `.5` or `1,250.000` is parsed digit by digit, so no floating-point value ever touches money. Arabic-Indic digits work too.

**Monthly items never duplicate.**
- Each generated entry gets a fixed id, `rec:<itemId>:<YYYY-MM>`.
- A separate `generated` log records every item and month that has been written. Generation runs in one IndexedDB transaction, so two open tabs can't both write the same month.
- Because the log is separate, editing or deleting a generated entry only changes that month and never brings the entry back.
- Pausing an item and resuming it later doesn't backfill the paused months.

**Storage.** Daftar asks the browser for persistent storage (`navigator.storage.persist()`), and Settings shows whether it was granted. Browsers can still clear site data, and on iPhone that happens more readily for sites that aren't on the home screen. Export a CSV backup now and then.

**CSV format.** One file holds everything. A `kind` column marks each row as `entry`, `recurring` or `setting`. Amounts are written as dinars (`12.500`), and the file is UTF-8 with a BOM so Excel opens it correctly. An import with any invalid row imports nothing and lists the problems by line number.
