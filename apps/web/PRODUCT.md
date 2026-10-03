# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Bevan and a small team of technical people who maintain a portfolio of organisation and client websites. They work through the fixes themselves rather than handing reports on. They use the app in two rhythms, roughly equally: periodic sweeps across the whole portfolio to spot what is broken or has got worse, and targeted runs on one site after a deploy or content change.

## Product Purpose

Website Auditor is a self-hosted Docker service that crawls public websites in a real browser and reports broken links, sitemap coverage, likely typos, SEO and security issues, and Lighthouse scores, keeping full audit history per site. Success is an operator knowing, quickly and with confidence, what to fix first on which pages, and what has changed (new or fixed) since the previous run.

## Positioning

A private, self-hosted auditor for a known portfolio, not a SaaS crawler: browser-rendered crawling, per-site crawl rules previewed against real sitemap discovery before a run, a per-site typo dictionary and allowlist, chosen Lighthouse targets, and run-by-run history the team owns.

## Operating Context

- Installed per organisation via Docker Compose (web, worker, Postgres, Redis); registration is disabled and admins provision accounts.
- Websites are shared across all authenticated users of an installation.
- An audit run snapshots the site's saved crawl rules, Lighthouse targets and typo settings at queue time, runs on the worker, and reports live progress (stage, current URL, pages, links, queue).
- Operators act on findings in the sites' own CMSs and codebases; the app is where they decide what to fix and confirm it is fixed.

## Capabilities and Constraints

- Run statuses: queued, running, cancelled, completed, completed with limits (page/depth budget hit), failed.
- Issue categories: crawl, broken link (including failed page resources), typo, SEO (including sitemap hygiene), security, site health (SSL expiry, security headers, HTTPS redirect, favicon, JavaScript errors); severities: error, warning, info.
- Crawl rules: allowlist and denylist of glob, exact or prefix matchers (allowlist applies first; denylist wins on conflict), with discovery suggestions.
- Lighthouse: the homepage is always audited, plus up to 10 additional URLs.
- Typo checks: per-site language (en, en-AU, en-GB, en-US) and a per-site allowlist.
- Websites can be archived: hidden from the dashboard, history retained, no new audits, restorable at any time.
- Roles: admin and user; admins manage accounts.

## Evidence on Hand

No screenshots, testimonials or sample datasets ship with the repo. Real data exists only in each installation's database; do not fabricate site names, counts or claims in product UI.

## Product Principles

1. Lead with what to fix first: severity and breadth before raw counts.
2. Change since the last run is a first-class signal, not an afterthought.
3. Status must never lie: every state has an honest, plain-language label.
4. Configuration serves runs; it never silently diverges from what a run uses.
5. Portfolio-scale glanceability for sweeps, depth on demand for one site.

## Accessibility & Inclusion

Target WCAG 2.2 AA: keyboard-operable throughout, labelled controls, sufficient contrast, announced live progress.
