---
name: Website Auditor
description: A self-hosted site-audit console, severity-led and change-aware, built to the category standard.
colors:
  accent: "#2563eb"
  accent-hover: "#1d4ed8"
  accent-text: "#1d4ed8"
  accent-soft: "#eef4ff"
  accent-border: "#c7d7fe"
  on-accent: "#ffffff"
  focus-ring: "#2563eb"
  selection: "#c7d7fe"
  bg: "#f6f7f9"
  surface: "#ffffff"
  surface-subtle: "#f2f4f7"
  surface-hover: "#eef1f5"
  border: "#e3e6eb"
  border-strong: "#cdd2da"
  input-border: "#858fa1"
  text: "#101828"
  text-secondary: "#475467"
  text-muted: "#5f6b7d"
  sidebar-bg: "#101828"
  sidebar-text: "#d0d5dd"
  sidebar-text-strong: "#ffffff"
  sidebar-hover: "#1d2939"
  sidebar-active: "#253247"
  sidebar-muted: "#98a2b3"
  sidebar-border: "#1f2a3b"
  error: "#d92d20"
  error-text: "#b42318"
  error-soft: "#fef3f2"
  error-border: "#fecdca"
  danger-solid: "#d92d20"
  danger-solid-hover: "#b42318"
  warning: "#f79009"
  warning-text: "#a14a07"
  warning-soft: "#fffaeb"
  warning-border: "#fedf89"
  success: "#17b26a"
  success-text: "#067647"
  success-soft: "#ecfdf3"
  success-border: "#abefc6"
  neutral: "#98a2b3"
  neutral-text: "#475467"
  neutral-soft: "#f2f4f7"
  neutral-border: "#e3e6eb"
  accent-dark: "#2f64db"
  accent-hover-dark: "#2856c2"
  accent-text-dark: "#7aa5ff"
  accent-soft-dark: "#16213a"
  accent-border-dark: "#24386a"
  focus-ring-dark: "#7aa5ff"
  selection-dark: "#24386a"
  bg-dark: "#0c0e12"
  surface-dark: "#13161c"
  surface-subtle-dark: "#191d25"
  surface-hover-dark: "#1f2430"
  border-dark: "#262b36"
  border-strong-dark: "#363d4b"
  input-border-dark: "#5f687a"
  text-dark: "#f2f4f7"
  text-secondary-dark: "#b8c0cc"
  text-muted-dark: "#949eae"
  sidebar-bg-dark: "#080a0d"
  sidebar-text-dark: "#c2c9d4"
  sidebar-hover-dark: "#151922"
  sidebar-active-dark: "#1d2330"
  sidebar-muted-dark: "#8e98a8"
  sidebar-border-dark: "#1a1f29"
  error-dark: "#f04438"
  error-text-dark: "#ff9c8f"
  error-soft-dark: "#2a1414"
  error-border-dark: "#5c2420"
  warning-text-dark: "#fdc35c"
  warning-soft-dark: "#2a1f0d"
  warning-border-dark: "#5a4012"
  success-text-dark: "#6ce0a3"
  success-soft-dark: "#0f2419"
  success-border-dark: "#1d4d33"
  neutral-dark: "#667085"
  neutral-text-dark: "#b8c0cc"
  neutral-soft-dark: "#1c212a"
  neutral-border-dark: "#2d3340"
typography:
  figure:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontFeature: '"tnum"'
  headline:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title-sm:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1
  label:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1
  tag:
    fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.01em"
  mono:
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'
    fontSize: "0.92em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.text}"
  button-danger:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.error-text}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-danger-hover:
    backgroundColor: "{colors.error-soft}"
  button-danger-solid:
    backgroundColor: "{colors.danger-solid}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "28px"
  button-danger-solid-hover:
    backgroundColor: "{colors.danger-solid-hover}"
  button-sm:
    padding: "0 8px"
    height: "28px"
  button-icon:
    padding: "0"
    width: "32px"
    height: "32px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  filter-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  filter-chip-pressed:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-text}"
  status-badge:
    backgroundColor: "{colors.neutral-soft}"
    textColor: "{colors.neutral-text}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "22px"
  status-badge-error:
    backgroundColor: "{colors.error-soft}"
    textColor: "{colors.error-text}"
  status-badge-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning-text}"
  status-badge-success:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success-text}"
  status-badge-accent:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-text}"
  tag-new:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-text}"
    typography: "{typography.tag}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "18px"
  change-chip-worse:
    backgroundColor: "{colors.error-soft}"
    textColor: "{colors.error-text}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  change-chip-better:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success-text}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  delta-worse:
    textColor: "{colors.error-text}"
  delta-better:
    textColor: "{colors.success-text}"
  delta-same:
    textColor: "{colors.text-muted}"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "20px"
  table-header:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label}"
    padding: "0 16px"
    height: "36px"
  table-cell:
    padding: "12px 16px"
  tab:
    textColor: "{colors.text-secondary}"
    typography: "{typography.control}"
    padding: "0 12px"
    height: "40px"
  tab-active:
    textColor: "{colors.text}"
  sidebar:
    backgroundColor: "{colors.sidebar-bg}"
    textColor: "{colors.sidebar-text}"
    padding: "20px 12px"
    width: "232px"
  sidebar-link:
    textColor: "{colors.sidebar-text}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "36px"
  sidebar-link-hover:
    backgroundColor: "{colors.sidebar-hover}"
    textColor: "{colors.sidebar-text-strong}"
  sidebar-link-active:
    backgroundColor: "{colors.sidebar-active}"
    textColor: "{colors.sidebar-text-strong}"
  alert:
    backgroundColor: "{colors.neutral-soft}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  alert-error:
    backgroundColor: "{colors.error-soft}"
  alert-warning:
    backgroundColor: "{colors.warning-soft}"
  alert-success:
    backgroundColor: "{colors.success-soft}"
  alert-accent:
    backgroundColor: "{colors.accent-soft}"
  verdict-strip:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  verdict-figure:
    typography: "{typography.figure}"
    padding: "20px"
  verdict-secondary:
    backgroundColor: "{colors.surface-subtle}"
    padding: "16px 20px"
  progress-panel:
    backgroundColor: "{colors.accent-soft}"
    rounded: "{rounded.lg}"
    padding: "20px"
  unsaved-bar:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "12px 12px 12px 16px"
---

# Design System: Website Auditor

## Overview

**Creative North Star: "The Triage Ledger"**

Website Auditor is an operator's console built to the category standard set by Ahrefs Site Audit, Sitebulb and the Vercel dashboard. Every screen answers two questions in order: what is broken, and what has changed since the last run. The world is cool grey paper with hairline borders, one blue for action and location, and a locked semantic set (red, amber, green, slate) that carries every verdict. Nothing is decorative. Density is moderate (14px base text, 32px controls), tuned for sweeping a portfolio table and then reading one report in depth.

Hierarchy comes from severity and position rather than scale or colour fields: errors before warnings before info, one verdict strip above a ranked list of collapsible issue groups, and counts set in tabular figures with signed deltas beside them. The dark navy sidebar is the only large field of colour; the content plane stays flat and light (near-black in dark mode). Light and dark themes are one token set, flipped by `prefers-color-scheme`. There is no in-app theme switch.

Motion reports work rather than decorating it. Routine state changes run 100–240ms on a single ease-out curve. Longer durations appear only where they carry information: the live stage track, counters that count rather than jump, the finish moment when results arrive, and a brief tint on a table row whose status just changed. Reduced motion removes travel and sweeping loops but keeps fades, colour and state. Confirmed refusals from the direction contract: no dark gradient hero card, no rows of identical metric cards, no gradients or glow on surfaces, and no web fonts or external assets.

**Key Characteristics:**
- Cool neutral greys, a single blue, and four semantic tones, each with a dark-theme counterpart.
- One system UI sans for everything; system mono only for URLs, patterns, selectors and code.
- Tabular figures on every count, with change since the last run shown beside it.
- 1px borders and tonal steps instead of shadows; 8px controls, 12px containers.
- A fixed dark sidebar and a 1280px content column; tables reflow to rows on small screens.
- Quiet, informational motion on one ease-out curve, with a full reduced-motion path.

## Colors

Cool neutral greys with one blue and four semantic tones. Each key is the CSS custom property name without `--` (`accent` is `var(--accent)`); a `-dark` key is the value that property takes under `prefers-color-scheme: dark`. Keys with no `-dark` sibling (`on-accent`, `warning`, `success`, `danger-solid`, `danger-solid-hover`, `sidebar-text-strong`) are shared by both themes. Components always use `var(--token)`, never a literal, so the theme flips without component changes.

### Primary
- **Operator Blue** (`accent`, #2563eb; dark #2f64db): primary button fill, the brand mark, the active tab underline, the pressed filter border, the stage-track fill and the category bars on the website overview. Hover deepens to `accent-hover` (#1d4ed8; dark #2856c2). Both steps hold 4.5:1 or better under the white `on-accent` label in both themes, which is why the dark fill is no lighter than #2f64db.
- **Link Blue** (`accent-text`, #1d4ed8; dark #7aa5ff): links, link buttons, and any text sitting on a blue wash (pressed filter counts, the selected combobox option, the New tag, the running badge).
- **Blue Wash** (`accent-soft`, #eef4ff; dark #16213a) with **Blue Edge** (`accent-border`, #c7d7fe; dark #24386a): pressed and selected backgrounds, the live progress panel, accent alerts, the running badge, and the start of the row-flash tint.
- **Focus Blue** (`focus-ring`, #2563eb; dark #7aa5ff) and **Selection** (`selection`, #c7d7fe; dark #24386a): the 2px focus outline and text selection.

### Neutral
- **Cool Paper** (`bg`, #f6f7f9; dark #0c0e12): the page canvas behind panels.
- **Sheet** (`surface`, #ffffff; dark #13161c): panels, tables, inputs, default buttons, the verdict strip.
- **Recessed Sheet** (`surface-subtle`, #f2f4f7; dark #191d25): table headers, panel footers, the verdict strip's secondary column, row hover, chip rows, skeleton base.
- **Hover Sheet** (`surface-hover`, #eef1f5; dark #1f2430): hover fill for buttons, sort buttons and inline verdict lines.
- **Hairline** (`border`, #e3e6eb; dark #262b36): panel edges, table and list dividers, tab baseline.
- **Control Edge** (`border-strong`, #cdd2da; dark #363d4b): borders of buttons, the unsaved-changes bar, dashed inline empty states, breadcrumb separators.
- **Field Edge** (`input-border`, #858fa1; dark #5f687a): borders of text inputs, selects and textareas only. It holds 3:1 against Sheet and Cool Paper in both themes so an empty field's boundary stays visible; buttons and every other edge keep Control Edge.
- **Ink** (`text`, #101828; dark #f2f4f7): primary text, site names, figures.
- **Slate** (`text-secondary`, #475467; dark #b8c0cc): secondary text, table headers, inactive tabs, alert body copy.
- **Muted Slate** (`text-muted`, #5f6b7d; dark #949eae): hosts, hints, timestamps, zero counts, placeholders, definition-list terms. This is the faintest text step; it holds 4.9:1 on `surface-subtle` in light and 6.2:1 in dark.
- **Night Navy sidebar** (`sidebar-bg`, #101828; dark #080a0d) with its own text (`sidebar-text`, `sidebar-text-strong`), hover (`sidebar-hover`), active (`sidebar-active`), muted icon (`sidebar-muted`) and divider (`sidebar-border`) steps. The sidebar is dark in both themes.

### Semantic
Each verdict tone is a four-step set: solid (dots and solid fills), `-text` (words and counts), `-soft` (fills) and `-border` (edges).
- **Signal Red** (`error`, #d92d20; dark #f04438): errors, worse deltas, the "+N new" chip when non-zero, failed runs, destructive actions.
- **Danger Fill** (`danger-solid`, #d92d20; hover `danger-solid-hover`, #b42318): the fill of the solid destructive button only, under the white `on-accent` label. It is the same in both themes because the dark `error` solid is too light to hold 4.5:1 under white.
- **Caution Amber** (`warning`, #f79009): warnings, "Completed, limit reached", the unsaved-changes dot, Lighthouse scores 50–89.
- **Clear Green** (`success`, #17b26a): clean sites, completed runs, better deltas, the "N fixed" chip, active users, Lighthouse scores of 90 and above.
- **Quiet Slate** (`neutral`, #98a2b3; dark #667085): info severity, queued, cancelled, not audited, archived and disabled states.

### Named Rules
**The One Blue Rule.** Blue is the only hue that never passes judgement. It marks where to act, where you are, what is selected, and what is live or new. It never means good or bad; that belongs to the semantic tones.

**The Verdict Set Rule.** Red, amber, green and slate are reserved for verdicts and always travel as their four-step set. Text on a soft fill uses the `-text` step, never the solid; solids are for dots, bars and solid buttons only.

## Typography

**Display Font:** none. Headings and figures use the body family.
**Body Font:** system UI sans (`ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`)
**Label/Mono Font:** system mono (`ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`), for machine strings only

**Character:** Native and instrument-like. The platform's own UI face keeps the tool feeling like part of the operating system, loads nothing from external hosts, and lets weight and tabular figures do the work a display face would do elsewhere.

### Hierarchy
- **Figure** (600, 2rem, line-height 1.1, -0.02em, tabular): the error and warning counts in the verdict strip. Drops to 1.5rem below 720px. Live progress statistics use a smaller sibling (600, 1.25rem, tabular).
- **Headline** (600, 1.5rem, 1.25, -0.01em, balanced wrap): the page `h1`, one per screen.
- **Title** (600, 1rem, 1.25, -0.01em): section `h2`s and the sidebar wordmark.
- **Title small** (600, 0.875rem, 1.25): panel and empty-state `h3`s.
- **Body** (400, 0.875rem, 1.5): default text and table cells. Empty-state copy is capped at 44ch.
- **Body small** (400, 0.8125rem, 1.5): hints, breadcrumbs, hosts, metadata lines, small buttons, URL lists.
- **Control** (500, 0.875rem, line-height 1): button, tab, filter and navigation labels.
- **Label** (500, 0.75rem): table headers, badges, stage names, tab counts, statistic captions.
- **Tag** (600, 11px, +0.01em): the "New" marker only.
- **Mono** (0.92em of its context): URLs, crawl patterns, source locations, evidence lists, inline code.

### Named Rules
**The Tabular Rule.** Every number that can change or be compared is set in tabular figures: counts, deltas, scores, durations and live statistics.

**The Machine-Strings Rule.** Mono marks strings a machine reads: URLs, patterns, selectors, source locations and code. It is never used for headings, numbers or prose.

**The Three-Weight Rule.** Weights are 400 (reading), 500 (controls and labels) and 600 (headings, figures, non-zero counts). Everything is sentence case; nothing is uppercased or letter-spaced for effect.

## Layout

The shell is a fixed 232px sidebar beside a single main column. Content is capped at 1280px and centred, with 32px padding at the top and sides and 40px at the foot. Every page follows the same header anatomy: breadcrumbs, then the `h1` with an optional status badge, a dot-separated subtitle line, and actions aligned right; website pages add a tab row beneath. Sections below are stacked with 24px gaps; content inside a section uses 16px; tight groups use 8px.

Spacing runs on a 4px base (4, 8, 12, 16, 20, 24, 32, 40). Controls are 32px tall (28px small, 36px for text inputs and sidebar links, 40px tabs); table cells take 12px by 16px padding; panel bodies take 20px.

Two-column views (the website overview at 2fr/1fr, crawl settings at 1.1fr/0.9fr with a sticky aside) collapse to one column at 1080px. At 900px the sidebar becomes a sticky top bar: wordmark left, sign out right, navigation wrapping full width below, the account name hidden, and content padding tightened to 20px/16px. At 720px, two-column forms stack; the sites table reflows each row into two lines (name and status, then labelled counts and actions); other data tables become labelled stacks; the verdict strip becomes two columns with the secondary column spanning beneath; and tabs switch to short labels with a fading right edge.

### Named Rules
**The Header-Owns-the-Action Rule.** A page's primary action sits at the right of its page header (Add website, Run audit, Run again). The only exception is the sticky unsaved-changes bar, which owns Save and "Save and run audit" while edits are pending.

## Elevation & Depth

The system is flat. Depth comes from tonal steps (canvas, then sheet, then recessed sheet) and 1px borders, never from shadows at rest. Shadows exist only for elements that float above content, plus two hairline rings that mark a pressed state.

### Shadow Vocabulary
- **Popover** (`box-shadow: 0 8px 24px -6px rgb(16 24 40 / 0.18), 0 2px 6px -2px rgb(16 24 40 / 0.08)`; dark uses `rgb(0 0 0 / 0.6)` and `rgb(0 0 0 / 0.4)`): the URL combobox list, the sticky unsaved-changes bar, the skip link.
- **Segment ring** (`box-shadow: 0 0 0 1px var(--border)`, both themes): the pressed button inside a segmented control.
- **Input focus halo** (`box-shadow: 0 0 0 3px var(--accent-soft), 0 0 0 1px var(--accent)`): focused text inputs, selects and textareas, which drop the outline in favour of this halo.
- **Pressed ring** (`box-shadow: 0 0 0 2px var(--accent)`): the "+N new" change chip while it filters the report.

### Named Rules
**The Float-Only Rule.** A shadow means "this sits above the page". Panels, tables, cards and the verdict strip never carry one.

## Shapes

Corners are gently rounded and tied to role. Controls (buttons, inputs, filter chips, alerts, list rows inside panels) take 8px. Containers (panels, tables, the verdict strip, disclosure lists, the progress panel, the unsaved bar) take 12px, and a table's header cells round their outer corners to match. Nested or small elements (segmented buttons, sort buttons, combobox options, the New tag, the "You" tag) take 6px. Inline code and Lighthouse score values take 4px. Status badges, tab counts, change chips and bar tracks are full pills; severity dots are circles (6px, or 8px in the filter row).

Every border is a 1px solid line. Inline empty states use a 1px dashed `border-strong` edge. The active tab is marked by a 2px blue bar with 2px rounded ends sitting on the tab row's hairline. Icons are drawn on a 24px grid with 2px round-capped strokes (adapted from Lucide), sized 16px by default, 12px inside badges, deltas and sort headers, 14px in small buttons, and 24–28px in empty states.

### Named Rules
**The 8/12 Rule.** Things you press are 8px; things that hold content are 12px. A pill always means status or count, never an action.

## Components

### Buttons
Compact, bordered and quiet; only the primary is filled.
- **Shape:** gently rounded (8px), 32px tall, 12px horizontal padding, 8px gap between icon and label.
- **Primary:** Operator Blue fill and border with white label; one per view, in the page header or the form it submits.
- **Secondary (default):** Sheet fill, Control Edge border, Ink label; hover moves to Hover Sheet.
- **Ghost:** transparent with Slate text; hover gains Hover Sheet and Ink. Used for dismiss, archive and other low-stakes row actions, often icon-only (32px or 28px square).
- **Danger:** Sheet fill with red text and a pale red border; hover takes the red wash. **Danger solid** (Danger Fill with the white `on-accent` label, deepening to `danger-solid-hover` on hover) appears only as the confirmation step of an inline confirm.
- **Small:** 28px tall, 8px padding, 13px label; used in table rows and alert actions.
- **Hover / Focus / Active:** colour changes over 150ms; press nudges down 0.5px over 100ms; the global focus outline is 2px Focus Blue offset by 2px. Disabled drops to 55% opacity with a not-allowed cursor. Pending actions swap their icon for a spinning loader and change the label ("Starting…", "Saving…").

### Chips
- **Filter chips:** the dashboard's summary row. 32px, 8px radius, Sheet fill, Hairline border, Slate label, a coloured severity dot and a bold tabular count. Pressed takes the Blue Wash, a blue border and Link Blue text. Filters with a count of zero are hidden unless active.
- **Segmented control:** the report's severity filter. A recessed track with 2px inset; the pressed segment steps up onto Sheet, edged by the Hairline segment ring.
- **Change chips:** "+N new" and "N fixed" in the verdict strip. 24px pills; red set when new issues exist, green set when issues were fixed, neutral when zero. They act as filters and jump links.
- **Word chips and chip rows:** recessed 8px rows for allowlisted words and Lighthouse targets, each with a trailing remove button.

### Status Badges and Tags
- **Status badge:** a 22px pill in a semantic set with a 6px dot (or a spinning loader while running) and a plain-language label. Labels come from one vocabulary: runs are Queued, Running, Completed, "Completed, limit reached", Cancelled or Failed; sites are Errors, Warnings, Clean, Not audited, "Last run failed", "Last run cancelled", Running, Queued or Archived. Colour changes animate over 300ms so a status flip reads as a change, not a redraw.
- **New tag:** an 18px, 6px-radius blue-wash tag with 11px semibold text, marking issue groups and occurrences that did not exist in the previous run.
- **Square badge:** the neutral badge with 6px corners, used for identity tags ("You") rather than status.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Sheet on Cool Paper.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px Hairline.
- **Internal Padding:** header 16px by 20px with a Hairline divider; body 20px; footer 12px by 20px on Recessed Sheet. Panels can be `details` elements, collapsing to the header alone.

### Inputs / Fields
- **Style:** 36px minimum height, 12px padding, 8px radius, Field Edge border on Sheet; labels above in 13px medium, hints and errors below in 13px (Muted Slate or red text). Selects carry a 16px chevron and 32px right padding; the chevron is drawn in mid slate (#667085) and switches to the dark Muted Slate value (#949eae) under the dark theme so it stays visible on the dark Sheet. Search fields add a leading 16px search icon and 34px left padding. Crawl patterns are typed in mono.
- **Focus:** the border turns Operator Blue with the input focus halo; hover (when not focused) darkens the border to Muted Slate.
- **Error / Disabled:** `aria-invalid` turns the border red, with the message in red text below.
- **URL combobox:** a search field over an 8px popover list (popover shadow, 280px maximum height); options are 6px rows that take the Blue Wash when active, driven by arrow keys, Enter and Escape.

### Navigation
- **Sidebar:** Night Navy in both themes. Wordmark with a 28px blue brand mark at the top; 36px links with 16px icons; hover lifts to the hover step, the current section takes the active step with white text and icon. The current section stays lit on nested routes (a website's report keeps "Websites" active). The account name, role and "Sign out" sit at the foot above a divider.
- **Breadcrumbs:** 13px Muted Slate with slash separators; the current page in Ink.
- **Tabs:** 40px, Slate labels, a count pill where useful; the active tab turns Ink with the 2px blue underline. Report tabs are true ARIA tabs with arrow-key movement; website tabs are links.

### Alerts
A full-width 8px box with a leading 16px icon, optional bold title, body copy in Slate and an actions row of small buttons. Tones follow the semantic sets (error, warning, success, accent, neutral); errors announce as `alert`, everything else as `status`. Dismissible alerts rise in on entry.

### Tables
The sites table, audit history and users list share one pattern: a 36px header row on Recessed Sheet with 12px Slate labels, sortable headers as quiet buttons with a 12px direction arrow, 12px by 16px cells, hairline row dividers, and a Recessed Sheet hover. The lead cell stacks the name (Ink, medium) over a muted host. Numeric columns align right in tabular figures; non-zero error and warning counts are semibold in red and amber, zeros are muted, and a missing value is an em dash. Row actions sit in a shrink-wrapped trailing cell.

### Delta Value
The signature of the system: change since the last run, shown wherever a count has a predecessor (the dashboard's Change column, beside each verdict figure, in history). A positive number means more issues and is red with an up arrow; a negative number is green with a down arrow and a true minus sign; zero reads "No change" in Muted Slate; no previous run reads as an em dash. A visually hidden sentence spells out the change for screen readers.

### Verdict Strip
The report's headline and the website overview's latest result. One bordered 12px strip in three columns: Errors and Warnings as large tabular figures with their deltas, then a recessed column holding the Info count and "Since the last audit" with the new and fixed change chips. On the report each part is a toggle that filters the issue list. Focus outlines inside the strip are inset (offset -3px) so its clipped, rounded edge cannot cut them off. Below 720px it becomes two columns with the recessed column spanning beneath.

### Live Progress Panel
Shown while an audit is queued or running: a Blue Wash panel with a spinning loader and the stage in words ("Crawling pages"), a four-step stage track (Discover, Crawl pages, Check links, Lighthouse), the current URL in mono, and four live statistics (pages crawled, pages queued, links checked, issues so far). The crawl step fills in proportion to pages crawled against the queue; steps with no measurable progress sweep a highlight across the bar instead of pretending to fill. The stage line is a polite live region.

### Issue Groups
The report's ranked fix list: one bordered 12px disclosure list, most severe first. Each summary row carries a rotating chevron, a severity badge, the issue title, a New tag when applicable, and right-aligned category and page count. Opened groups list occurrences with the page URL in mono, the message, and evidence or one-click "Allow word" actions for typos. Long lists end with a centred "show more" row.

### Motion
One curve, `cubic-bezier(0.16, 1, 0.3, 1)`, carries every entrance and fill; plain `ease` handles hover colour and exits.
- **Routine (100–240ms):** press 100ms; hover and border colour 150ms; disclosure chevron 150ms; page view transitions cross-fade the content in 160ms while the sidebar holds still (its own view-transition name); tab panels fade and rise 6px in 180ms; dismissible alerts and the unsaved bar rise in 220ms and leave in 140ms; the progress panel fades out in 160ms; disclosure height opens in 240ms where the browser supports animating to `auto`.
- **Informational (longer):** stage fills settle over 600ms; indeterminate stages sweep every 1500ms; badge and stage-label colours change over 300ms; live counters tween over 900ms and verdict figures over 700ms with a quartic ease-out, so numbers read as progress.
- **Finish moment:** when a running audit completes on screen, the verdict strip's columns rise in over 420ms, staggered 0/60/120ms, while its counts tween in staggered 0–240ms, and a hidden status line announces the totals.
- **Row flash:** a dashboard row whose status changes while the list is open starts on the Blue Wash and fades to normal over 1600ms.
- **Reduced motion:** travel distance drops to zero, so rises become pure fades; stage fills and disclosure heights snap; the sweep becomes a static bar at 60% opacity; the spinner slows to 1800ms; staggers collapse; counters jump straight to their value.

## Do's and Don'ts

### Do:
- **Do** use the CSS custom properties (`var(--accent)`, `var(--space-4)`, `var(--radius-lg)`) for every colour, space and radius, so both themes stay in step.
- **Do** pair every status colour with a dot or spinner and a plain-language label from the shared status vocabulary.
- **Do** show change since the last run beside any count that has a predecessor, using the delta, change-chip or New-tag patterns.
- **Do** order findings most severe first: errors, then warnings, then info.
- **Do** set counts, deltas and scores in tabular figures, and set URLs and patterns in mono with `overflow-wrap: anywhere` (or truncate with a full-value tooltip inside fixed-height lists).
- **Do** keep routine transitions within 100–240ms on `cubic-bezier(0.16, 1, 0.3, 1)`, and give every new animation a reduced-motion path that removes travel but keeps the fade or state change.
- **Do** keep text on fills at 4.5:1 or better in both themes, per the product's WCAG 2.2 AA commitment, and check every new surface in light and dark.

### Don't:
- **Don't** build a dark gradient hero card or a row of identical metric cards; the verdict strip is the summary pattern.
- **Don't** put gradients or glows on surfaces, cards or buttons. The only gradients in the system are functional: the skeleton shimmer, the indeterminate stage sweep and the tab-overflow fade mask.
- **Don't** use blue to mean good, bad or severity, and don't use red, amber or green for anything but verdicts.
- **Don't** add shadows to panels, tables or cards at rest.
- **Don't** uppercase labels or add eyebrow text above headings; headings and labels are sentence case.
- **Don't** use mono for headings, prose or numbers.
- **Don't** load web fonts, icon fonts or assets from external hosts; this is a private, self-hosted install.
