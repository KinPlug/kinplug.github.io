# KinPlug Website

Premium kintone plugins. Plug in. Power up.

## 🌐 Live Site

[https://kinplug.com](https://kinplug.com)

## 🚀 Deployment

This site is deployed via GitHub Pages from the `main` branch.

### Setup

1. Push to `main` branch
2. Go to repo Settings → Pages
3. Source: Deploy from branch → `main` → `/ (root)`
4. Custom domain: `kinplug.com`

### DNS Configuration (Squarespace)

Add these records in Squarespace DNS settings:

| Type | Host | Value |
|------|------|-------|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | kinplug.github.io |

## 📁 Structure

```
/
├── index.html      # Landing page
├── CNAME           # Custom domain config
└── README.md       # This file
```

## 🎨 Brand Colors

| Color | Hex | Usage |
|-------|-----|-------|
| KinPlug Blue | `#0EA5E9` | Primary |
| KinPlug Teal | `#14B8A6` | Secondary |
| KinPlug Gold | `#F59E0B` | Accent |
| Navy | `#0F172A` | Text/Headers |

## 📧 Email Signup

Currently logs to console. TODO: Connect to kintone app for storage.

## License

© 2026 KinPlug
