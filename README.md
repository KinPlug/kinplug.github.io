# KinPlug · kinplug.com

The static site for **KinPlug**, a curated catalog of premium plugins for Kintone.
Built and operated by **Edamame Inc.** (Manila · Tokyo).

## Design · "KinPlug Archive" v3.0

An editorial technical journal aesthetic. Rejects the generic SaaS look in favor of:

- **Typography** — Fraunces (display serif, variable axes), Geist (body sans), JetBrains Mono (technical labels), Shippori Mincho + Noto Sans JP (Japanese).
- **Palette** — warm cream paper, deep warm ink, single vermillion accent (朱 · seal).
- **Structure** — numbered magazine sections, asymmetric 12-col grid, hairline rules.
- **Voice** — the catalog is a table of contents, not a feature grid.

## Stack

- Plain HTML + CSS + vanilla JS.
- Deployed via **GitHub Pages** → `kinplug.com` via CNAME.
- Auth by **Clerk** (Google, Microsoft, email).
- License API on **Google Cloud Run** (asia-northeast1, Tokyo) with Railway fallback.

## Structure

```
/                           English root
/plugins/                   Catalog + plugin detail pages
/plugins/flow/              Flagship product (v4.9, in development)
/plugins/pdf-designer/      PDF Pro (v3.2+, live)
/plugins/enhanced-lookup/   Smart Lookup (v3.0, live)
/pricing.html               Tiers & comparison
/docs/                      Documentation landing
/blog/                      Journal
/dashboard.html             User account (Clerk-gated)
/login.html                 Auth entry
/legal/{privacy,terms}.html Legal
/ja/*                       Japanese mirror of every page

/assets/css/style.css       Design system
/assets/js/app.js           Clerk + API integration
/favicon.svg                Vermillion seal-mark
```

## Deploy

Merge to `main` — GitHub Pages builds automatically.
Custom domain is set via `/CNAME` = `kinplug.com`.
DNS A records point at GitHub Pages IPs.

## Contact

- Product · <support@kinplug.com>
- Billing · <billing@kinplug.com>
- Privacy · <privacy@kinplug.com>
- Operator · [Edamame Inc.](https://edamame.ph)

© MMXXVI · Edamame Inc.
