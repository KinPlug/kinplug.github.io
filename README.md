# kinplug.com

Native Kintone plugins · operated by Edamame Inc. (Manila · Tokyo) · since 2019.

This is the public website. Static HTML, no build step. Served by GitHub Pages from the `master` branch with CNAME → `kinplug.com`.

## Source of truth

All strategic, brand, and pricing decisions live in the private `KinPlug/kinplug-vision` repo. When this site and that repo disagree, the vision doc wins and the site gets corrected.

## Structure

```
/                      English homepage (first-class)
/ja/                   Japanese homepage (primary audience)
/plugins/              Catalog + per-plugin detail pages
  /mail/               Hero product — full detail page
  /pdf-pro/
  /smart-lookup/
  /flow/
/pricing.html          Standalone pricing
/compare/              Head-to-head vs competitors
/about/                Company / 会社概要
/contact/              Contact form + 4 case routes
/docs/                 Documentation landing
/blog/                 Journal — publish rarely
/legal/                privacy, terms, security
/signup/               Free trial signup
/login.html            Sign in
/dashboard.html        Account dashboard (authenticated)
/404.html              Not found
```

Every top-level path has a `/ja/` mirror.

## Brand tokens (locked)

- Navy `#1B2B5A` primary · Clay `#C47A42` accent · Paper `#F7F5F0` bg
- Noto Sans JP + Noto Serif JP + JetBrains Mono
- Logo: plug-in-bracket monogram, lowercase wordmark, clay spark
- Voice: Craftsman with sharp edges. 2030-proof test on every sentence.

## Editing

Pages are regenerated via Python builders at `/home/claude/builder.py`, `build_plugins.py`, `build_support.py`, `build_rest.py`. To update a shared element (nav, footer, CTA), edit `builder.py` and re-run all builders. To update one page's copy only, edit the HTML directly.

## Deploying

Push to `master`. GitHub Pages picks it up. CNAME → kinplug.com. No build step, no GitHub Actions.
