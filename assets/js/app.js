/* kinplug — shared front-end runtime.
   Original: mobile nav toggle + language persist.
   Added: site config (single source) + GA4 analytics + kpTrack() helper.
   Heavier auth/trial/contact logic lives in /assets/js/auth.js,
   which is loaded only on the pages that need it and reads the config below. */

(function() {
  'use strict';

  /* ============================================================================
     CONFIG — the ONLY place to edit keys. Every value here is PUBLIC and safe to
     ship client-side. Do NOT put secrets here (no sk_, no Resend re_, no service
     account JSON, no Kintone auth). See README / PR notes.

       apiBase              public backend API (no trailing slash) — verified live
       clerkPublishableKey  Clerk pk_test_… / pk_live_… (publishable = safe)
       ga4Id                GA4 Measurement ID, e.g. G-XXXXXXXXXX

     Leave a value as its "REPLACE_ME" placeholder to keep that integration OFF
     (no script loads, no console errors) until you drop the real value in.
     ============================================================================ */
  var CONFIG = {
    apiBase: 'https://kinplug-api-165259092767.asia-northeast1.run.app',
    clerkPublishableKey: 'pk_REPLACE_ME',
    ga4Id: 'G-REPLACE_ME'
  };
  window.KINPLUG_CONFIG = CONFIG;

  /* ---------- GA4 analytics (loads only when a real Measurement ID is set) ---- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  if (typeof window.gtag !== 'function') { window.gtag = gtag; }

  var ga4 = CONFIG.ga4Id || '';
  var ga4Enabled = /^G-[A-Z0-9]{6,}$/.test(ga4) && ga4.indexOf('REPLACE') === -1;
  if (ga4Enabled) {
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(ga4);
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', ga4);
  }

  /* Single tracking helper used site-wide. Always queues to dataLayer (so events
     are observable even before GA4 is enabled); GA4 forwards them once enabled. */
  window.kpTrack = function(eventName, params) {
    try { window.gtag('event', eventName, params || {}); } catch (e) {}
  };

  /* ---------- mobile nav toggle ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.querySelector('.nav-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', function() {
      menu.classList.toggle('open');
    });
  }

  /* ---------- remember language preference so cross-links respect user choice -- */
  var lang = document.documentElement.getAttribute('lang');
  if (lang === 'ja' || lang === 'en') {
    try { localStorage.setItem('kp-lang', lang); } catch (e) {}
  }

  /* ---------- active state on current page nav link ---------- */
  var path = window.location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.nav-menu a').forEach(function(a) {
    var href = a.getAttribute('href') || '';
    var hrefPath = href.replace(/\/$/, '') || '/';
    if (hrefPath === path ||
        (hrefPath !== '/' && path.indexOf(hrefPath) === 0)) {
      a.classList.add('active');
    }
  });
})();
