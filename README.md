# Daftar

A personal spending ledger that looks and feels like a typewritten paper notebook. It's for one person on one device: no accounts, no backend, and your data never leaves the phone. Amounts are in Bahraini dinars (BD, 3 decimals).

- **Pay cycles, not calendar months.** A cycle runs from one salary to the day before the next (payday defaults to the 26th). A salary logged up to 7 days early, or a few days late, moves the start. Each cycle is named after the month it mostly covers and always shows its dates, e.g. "November (26 Oct – 25 Nov)".
- **Salary received.** Income is a real entry. The wallet button (and a "Got paid?" note around payday) opens a sheet prefilled with your usual salary and today's date. Untick "This is my salary" to log a bonus or refund without starting a new cycle.
- **Quick add.** The pen button opens a sheet: amount, what it was for (suggestions ranked by how often you use them), date, and Spend / Savings / From savings.
- **Taking money out of savings.** "From savings" entries (brown ink) need a reason. They add to what you have to spend: Left = income + from savings − (fixed + spent + saved). Net saved = saved − from savings. With a starting balance in Settings, the cycle note also shows what's in savings.
- **Monthly items.** Savings, gym, subscriptions… are written in once per cycle, either on payday or on a day of the month. They never duplicate within a cycle, missed cycles are filled in, and day 31 falls on the last day of shorter months.
- **Ledger.** A sticky-note summary (Income, From savings, Fixed, Spent, Saved, Total out, Left, In savings), entries grouped by day, the daily goal and its streak.
- **Where it went.** A hand-hatched donut of the cycle's spending (top 7 + Other); tap a slice to see its entries. Below it, every description ranked by total. Switch to "Everything out" to include fixed and saved.
- **Insights.** Charts comparing cycles: income vs total out, savings balance, savings rate, this cycle's spending pace with a projection to payday, the costliest weekdays, fixed costs as a share of income, one description over time, a daily-spending calendar, and streaks and records.
- **Reports.** A Month Report per cycle and a Year Report per year, in Markdown, to copy, share or download (`daftar-report-YYYY-MM.md`, `daftar-report-YYYY.md`) and paste into Claude. Made on the device.
- **Daily goal.** Set a daily spending goal in Settings; the pen button and tab icon shift from blue to red as you near it, and days at or under it build a streak.
- **Settings.** Payday, usual salary, starting savings, daily goal, Day/Night paper, CSV export/import (validated, with a preview), and erase-everything behind a typed confirmation.
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

### Code structure

The code is split into layers. [`CLAUDE.md`](CLAUDE.md) has the full conventions.

| Layer | What it holds |
| --- | --- |
| [`src/domain/`](src/domain) | Pure, unit-tested logic: money (integer fils), dates, entry types, totals, recurring posting, goal streaks, reports, CSV |
| [`src/data/`](src/data) | Everything that touches the device: IndexedDB repositories, CSV backup, file download/copy, preferences, clock |
| [`src/state/`](src/state) | Preact signals and actions (the only caller of the database), plus the hash router |
| [`src/ui/components/`](src/ui/components) | Shared components (Button, AmountInput, SegmentedControl, BottomSheet, EntryRow, StickyNote…), each with its CSS next to it |
| [`src/ui/pages/`](src/ui/pages) | One folder per screen, built only from components |
| [`src/ui/tokens.css`](src/ui/tokens.css) | Every colour, font size, spacing step, radius, shadow and timing |

Rules in short:
- use tokens, never raw values;
- pages never touch the database;
- reuse a component before creating a new one;
- domain code stays pure and tested.

**Money.** Every amount is stored as an integer number of fils (1 BD = 1000 fils). Input like `3`, `3.5`, `3.250`, `.5` or `1,250.000` is parsed digit by digit, so no floating-point value ever touches money. Arabic-Indic digits work too.

**Pay cycles.** Each month's expected payday anchors one cycle. A salary dated from 7 days before that payday up to just before the next payday's window starts the cycle on its own date; without one, the cycle starts on the payday. Cycles are worked out from entry dates every time, so nothing has to be stored per cycle and changing your payday regroups everything.

**Monthly items never duplicate.**
- Each posted entry gets a fixed id, `rec:<itemId>:<cycle>`, and remembers the cycle it was posted for.
- A separate `generated` log records every item and cycle that has been posted. Posting runs in one IndexedDB transaction, so two open tabs can't both post the same cycle.
- Editing or deleting a posted entry only changes that cycle and never brings it back.
- If a salary moves a cycle's start or end after its items were posted, those entries move with it, so a cycle never holds the same item twice.

**Moving from the first version.** Data saved before pay cycles is migrated once, after a screen that offers a CSV backup first: the monthly income becomes the usual salary, recurring items keep their day, and entries are left exactly as they were.

**Storage.** Daftar asks the browser for persistent storage (`navigator.storage.persist()`), and Settings shows whether it was granted. Browsers can still clear site data, and on iPhone that happens more readily for sites that aren't on the home screen. Export a CSV backup now and then.

**CSV format.** One file holds everything. A `kind` column marks each row as `entry`, `recurring` or `setting`; entry types are `spend`, `fixed`, `savings`, `income` (with a `salary` flag) and `withdrawal`. Files from the first, month-based version still import and are converted to cycles. Amounts are written as dinars (`12.500`), and the file is UTF-8 with a BOM so Excel opens it correctly. An import with any invalid row imports nothing and lists the problems by line number.
