# Daftar: conventions

Daftar is an offline-first personal spending ledger (BHD), a Preact + signals PWA with IndexedDB storage. It has no backend. Follow these rules for every change.

## Folder structure

```
src/
  domain/          Pure logic: no DOM, no IndexedDB, no localStorage, no Date.now() calls hidden inside.
                   money, dates, text, types, entryTypes, totals, recurring, goal, suggest,
                   report, csv, brand. Every module has a *.test.ts next to it.
  data/            Everything that touches the device: db.ts (IndexedDB schema + repositories),
                   backup.ts (CSV export), files.ts (download/copy), prefs.ts (localStorage),
                   clock.ts (today, with the dev-only ?today= override), id.ts.
  state/           Signals and actions. store.ts holds entries/recurring/settings and calls data/;
                   router.ts parses the hash.
  ui/
    tokens.css     The only place for colours, fonts, font sizes, spacing, radii, shadows, timings.
    base.css       Element defaults, the notebook page, utilities (.visually-hidden, .ink-red…).
    styles.css     Imports every stylesheet in cascade order. New CSS files get added here.
    components/    Shared building blocks: X.tsx + X.css side by side.
    pages/<Page>/  One folder per screen: the page, its page-only pieces, and their CSS.
  app.tsx, main.tsx, theme.ts, favicon.ts, pwa.ts
```

## Rules

- **Use tokens, never raw values.** Colours, font sizes (`--fs-*`), spacing (`--space-*`, or multiples of `--line` for vertical rhythm), radii (`--radius-*`), shadows and durations (`--dur-*`) all come from `ui/tokens.css`. If a value you need isn't there, add a token. A few sub-scale optical nudges (e.g. `0.35rem`) predate the scale. Don't add new ones.
- **Pages never touch the database.** Pages and components import from `state/` (signals and actions), `domain/` (pure helpers) and `data/files`/`data/prefs`/`data/backup`. They never import `data/db`. Only `state/store.ts` calls `data/db`.
- **Reuse a component before creating one.** Check `ui/components/` first: Button, FileButton, IconButton, TextInput, AmountInput, FieldError, SegmentedControl, Checkbox, Chips/Chip, FormRow/FormActions/Hint, BottomSheet, Toast, Banner, StickyNote, EntryRow, HighlightBar, EmptyState, Fab, TopBar, Amount, Icon. Never hand-write `class="ink-btn"`, `class="toggle"`, `class="field-input"` and so on in a page.
- **Single sources of truth.**
  - Entry types (label, ink token, highlight, icon) are defined only in `domain/entryTypes.ts`. Colour a row with `inkVar(type)`, never with a CSS class per type.
  - Money is formatted only by `formatFils` / `filsToPlain` and parsed only by `parseFils` (`domain/money.ts`). Amounts are integer fils, never floats.
  - "Today" comes from the `today` signal in `state/store.ts`. Don't call `new Date()` in UI code.
  - Colours that CSS can't reach (manifest, favicon) live in `domain/brand.ts`, mirroring the tokens.
- **Domain code is pure and tested.** Pass `today`, entries and settings in as arguments. Add tests for new domain functions in the same folder.

## Component pattern

- Function components only. Use signals for shared app state (`state/`) and `useState` for local UI state.
- One component per file, PascalCase (`EntryRow.tsx`), with its styles in `EntryRow.css` next to it. Register the CSS in `ui/styles.css`.
- Functions and variables are camelCase. CSS classes are kebab-case, scoped by a component prefix where practical (`.bd-row`, `.tg-bar`).
- Bottom sheets open imperatively (`dialog.showModal()` and then focus, inside the tap handler) so iOS raises the keyboard.
- Accessibility: 44px minimum targets (one `--line`), visible focus, `aria-*` on custom controls, and hidden text where colour alone carries meaning.

## Checks before committing

```bash
npm test && npm run typecheck && npm run build
```

When a change shouldn't alter visuals, compare before and after screenshots at 375px in both themes.
