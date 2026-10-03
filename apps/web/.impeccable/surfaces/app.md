---
version: 1
slug: "app"
primary_target: "app"
related_targets: []
---

# Surface brief: Website Auditor app (all authenticated screens + login)

Scope: dashboard, website overview, website crawl settings, audit report, add website, users, login. Visitor mode: Operate.

Audience/job: a small technical team sweeping a portfolio for what broke or got worse, and running targeted audits after changes. Success: within seconds know which sites need attention, and per report what to fix first and what changed since the last run.

Constraints: self-hosted private instance, no external font or asset hosts; light and dark from one token set via prefers-color-scheme; WCAG 2.2 AA.

## Direction contract

THESIS: A site-audit tool at the craft level of Ahrefs Site Audit, Sitebulb and the Vercel dashboard: severity-led, change-aware, conventional. Refuses the dark gradient hero card and rows of identical metric cards.

OWN-WORLD: Cool neutral greys with one blue accent reserved for primary actions, links, focus and selection; semantic red (error), amber (warning), green (clean), slate (info/neutral). System UI sans with tabular figures; system mono only for URLs, selectors and code. 1px borders, 8px controls, 12px panels, no gradients or glow. Light and dark themes.

STORY: The operator scans the sites table, sees errors, warnings and change since the last run, opens a site, runs or configures it, and reads the report as a ranked fix list with new and fixed issues called out.

FIRST VIEWPORT: Left sidebar (Websites, Add website, Users, account). Main: "Websites" heading with "Add website" primary at right; a summary row of filter buttons (Errors, Warnings, Clean, Not audited, Running) with counts; a search and "Show archived" toggle; a sortable table: Site (name + host), Status, Errors, Warnings, Change since last run, Last audit (relative), row actions (Run audit, Archive). Signature: change-since-last-run deltas everywhere (dashboard column, report verdict strip "New · Fixed", New markers on issue rows).

FORM: canon (category standard), user-chosen from the safer register; references Ahrefs Site Audit, Sitebulb, Vercel. Seed key 66c4e757.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
