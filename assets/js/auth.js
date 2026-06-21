/* kinplug — auth, trial issuance, dashboard, and contact wiring.
   Loaded only on: /signup/, /login.html, /dashboard.html, /contact/ (and /ja/*).
   Reads window.KINPLUG_CONFIG (defined in app.js). No secrets live here.

   ----------------------------------------------------------------------------
   VERIFIED LIVE API CONTRACT  (curl against the public backend, 2026-06-21)
   base = window.KINPLUG_CONFIG.apiBase
   CORS: backend reflects Allow-Origin only for https://kinplug.com (apex).

   POST {base}/trial
     req : { email, subdomain, product? }          product defaults to "pdf-designer"
     200 : { success:true, license_key, subdomain, product, type:"trial",
             expiresAt, id }                        expiresAt ~ +14 days
     400 : { error:"Invalid email" }
         | { error:"Subdomain required" }
         | { error:"Trial already used", message:"<friendly text>" }

   GET  {base}/licenses        header: X-User-Email: <email>
     200 : { licenses:[ { license_key, email, subdomain, product, type, status,
             expiresAt, createdAt, subdomain_changes, subdomain_changes_allowed } ] }
     400 : { error:"Email header required" }

   POST {base}/validate
     req : { license_key, subdomain }
     200 : { valid:true, type, product, subdomain, expiresAt, daysRemaining, status }
     400 : { valid:false, error:"License key required" | "Subdomain required" }

   POST {base}/signup          (lightweight lead capture)
     req : { email, ... }      extra fields accepted without error
     200 : { success:true, id }
     400 : { error:"Invalid email" }
   ---------------------------------------------------------------------------- */

(function() {
  'use strict';

  var CFG = window.KINPLUG_CONFIG || {};
  var API = (CFG.apiBase || '').replace(/\/$/, '');
  var LANG = (document.documentElement.getAttribute('lang') === 'ja') ? 'ja' : 'en';
  var track = window.kpTrack || function() {};

  /* ------------------------------------------------------------------ i18n -- */
  var STR = {
    en: {
      creating: 'Creating your trial…',
      sending: 'Sending…',
      trialHeading: 'Your 14-day trial is live.',
      keyLabel: 'License key',
      copy: 'Copy', copied: 'Copied ✓',
      productLabel: 'Plugin', expiresLabel: 'Expires', daysLeft: 'days left',
      emailed: function(e) { return 'A copy has been emailed to ' + e + ' (check spam if it is not in your inbox).'; },
      installTitle: 'Install in Kintone — about 90 seconds',
      installSteps: [
        'In Kintone, open <strong>Settings → Plugins → Import</strong> and upload the kinplug plugin .zip.',
        'Open the plugin settings on your app, paste the <strong>license key</strong> above, and Save.',
        'For Kinplug Mail, authorize Google or Microsoft once on their consent screen.'
      ],
      gotoDashboard: 'Go to dashboard',
      errEmail: 'Please enter a valid email address.',
      errSub: 'Please enter your Kintone subdomain.',
      errDup: 'A trial for this plugin already exists on that subdomain.',
      errNetwork: 'Network error — check your connection and try again.',
      errGeneric: 'Something went wrong. Please try again, or email support@kinplug.com.',
      contactOk: 'Thanks — we have your message and will reply within one business day (JST 09:00–18:00).',
      contactErr: 'Could not send right now. Please email support@kinplug.com directly.',
      loginNotice: 'Account sign-in is being finalized. Use the 14-day trial to get started now, or email support@kinplug.com.',
      dashSignedOut: 'Sign in to view your license keys, subdomains, and expiry dates.',
      dashLoading: 'Loading your licenses…',
      dashEmpty: 'No licenses yet. Start a free 14-day trial to get your first license key.',
      dashError: 'Could not load your licenses. Please refresh, or email support@kinplug.com.',
      startTrialCta: 'Start free trial',
      signInCta: 'Sign in',
      active: 'Active', expired: 'Expired', subdomainLabel: 'Subdomain'
    },
    ja: {
      creating: 'トライアルを作成中…',
      sending: '送信中…',
      trialHeading: '14日間トライアルが有効になりました。',
      keyLabel: 'ライセンスキー',
      copy: 'コピー', copied: 'コピーしました ✓',
      productLabel: 'プラグイン', expiresLabel: '有効期限', daysLeft: '日残り',
      emailed: function(e) { return e + ' 宛にライセンスキーを送信しました（受信箱にない場合は迷惑メールをご確認ください）。'; },
      installTitle: 'Kintoneへのインストール — 約90秒',
      installSteps: [
        'Kintoneで <strong>設定 → プラグイン → 読み込む</strong> から kinplug プラグインの .zip をアップロードします。',
        'アプリのプラグイン設定を開き、上記の<strong>ライセンスキー</strong>を貼り付けて保存します。',
        'Kinplug Mail の場合は、Google または Microsoft の同意画面で一度だけ認可します。'
      ],
      gotoDashboard: 'ダッシュボードへ',
      errEmail: '有効なメールアドレスを入力してください。',
      errSub: 'Kintoneのサブドメインを入力してください。',
      errDup: 'このサブドメインでは、このプラグインのトライアルは既に利用されています。',
      errNetwork: 'ネットワークエラーです。接続を確認して再度お試しください。',
      errGeneric: 'エラーが発生しました。再度お試しいただくか、support@kinplug.com までご連絡ください。',
      contactOk: 'お問い合わせを受け付けました。1営業日以内（JST 09:00–18:00）にご返信します。',
      contactErr: '送信できませんでした。お手数ですが support@kinplug.com まで直接ご連絡ください。',
      loginNotice: 'アカウントのサインインは準備中です。まずは14日間トライアルをご利用いただくか、support@kinplug.com までご連絡ください。',
      dashSignedOut: 'サインインすると、ライセンスキー・サブドメイン・有効期限を確認できます。',
      dashLoading: 'ライセンスを読み込み中…',
      dashEmpty: 'ライセンスはまだありません。14日間無料トライアルを開始すると、最初のライセンスキーが発行されます。',
      dashError: 'ライセンスを読み込めませんでした。再読み込みするか、support@kinplug.com までご連絡ください。',
      startTrialCta: '無料トライアルを開始',
      signInCta: 'サインイン',
      active: '有効', expired: '期限切れ', subdomainLabel: 'サブドメイン'
    }
  };
  var T = STR[LANG];

  /* --------------------------------------------------------------- helpers -- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) { Object.keys(attrs).forEach(function(k) { n.setAttribute(k, attrs[k]); }); }
    if (html != null) { n.innerHTML = html; }
    return n;
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function validEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

  // Accept "acme", "acme.kintone.com", "https://acme.cybozu.com/…" → "acme"
  function normalizeSubdomain(raw) {
    var s = (raw || '').trim().toLowerCase();
    s = s.replace(/^https?:\/\//, '');
    s = s.replace(/\/.*$/, '');
    s = s.replace(/\.(kintone\.com|cybozu\.com|kintone\.cn).*$/, '');
    s = s.replace(/[^a-z0-9-]/g, '');
    return s;
  }
  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return String(iso || ''); }
    try {
      return d.toLocaleDateString(LANG === 'ja' ? 'ja-JP' : 'en-US',
        { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return d.toISOString().slice(0, 10); }
  }
  function daysUntil(iso) {
    var d = new Date(iso).getTime();
    if (isNaN(d)) { return null; }
    return Math.max(0, Math.ceil((d - Date.now()) / 86400000));
  }
  function setBtnLoading(btn, text) {
    if (!btn) { return; }
    btn.dataset.kpLabel = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = text;
  }
  function resetBtn(btn) {
    if (!btn || btn.dataset.kpLabel == null) { return; }
    btn.disabled = false;
    btn.innerHTML = btn.dataset.kpLabel;
    delete btn.dataset.kpLabel;
  }
  function showMsg(box, text, ok) {
    if (!box) { return; }
    box.style.display = 'block';
    box.style.marginTop = '16px';
    box.style.padding = '12px 14px';
    box.style.borderRadius = '4px';
    box.style.fontSize = '0.875rem';
    box.style.lineHeight = '1.55';
    box.style.background = ok ? 'rgba(31,122,75,0.08)' : 'rgba(193,42,42,0.07)';
    box.style.border = '1px solid ' + (ok ? 'rgba(31,122,75,0.35)' : 'rgba(193,42,42,0.35)');
    box.style.color = ok ? 'var(--ok, #1F7A4B)' : 'var(--err, #C12A2A)';
    box.textContent = text;
  }

  // fetch wrapper returning { ok, status, body }. JSON in / JSON out.
  function apiFetch(method, path, body, headers) {
    var opts = { method: method, headers: headers || {} };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch(API + path, opts).then(function(res) {
      return res.json().catch(function() { return {}; }).then(function(json) {
        return { ok: res.ok, status: res.status, body: json };
      });
    });
  }

  /* ============================================================ TRIAL / SIGNUP */
  function initSignup(form) {
    var emailEl = $('#kp-email', form);
    var subEl = $('#kp-subdomain', form);
    var prodEl = $('#kp-product', form);
    var btn = form.querySelector('button[type="submit"]');
    var result = $('#kp-signup-result');

    // Honour ?product= / ?plan= deep-links without touching plugin pages.
    try {
      var qp = new URLSearchParams(window.location.search);
      var qprod = qp.get('product') || qp.get('plan');
      if (qprod && prodEl) {
        for (var i = 0; i < prodEl.options.length; i++) {
          if (prodEl.options[i].value === qprod) { prodEl.selectedIndex = i; break; }
        }
      }
    } catch (e) {}

    var started = false;
    function markStarted() {
      if (!started) { started = true; track('signup_started', { location: 'signup' }); }
    }
    if (emailEl) { emailEl.addEventListener('focus', markStarted); }
    if (subEl) { subEl.addEventListener('focus', markStarted); }

    // Social buttons start Clerk account sign-up — but only once Clerk is
    // configured. Until then the trial form above is the primary, no-account path
    // and the buttons stay inert (they sit outside the form, so no submit).
    var social = $('#kp-social');
    if (social && clerkConfigured()) {
      social.querySelectorAll('button').forEach(function(b) {
        b.addEventListener('click', function() {
          loadClerk().then(function(C) { C.openSignUp({ afterSignUpUrl: dashboardUrl() }); });
        });
      });
    }

    form.addEventListener('submit', function(ev) {
      ev.preventDefault();
      var email = (emailEl && emailEl.value || '').trim();
      var subdomain = normalizeSubdomain(subEl && subEl.value);
      var product = (prodEl && prodEl.value) || 'mail';

      if (!validEmail(email)) { showMsg(result, T.errEmail, false); if (emailEl) emailEl.focus(); return; }
      if (!subdomain) { showMsg(result, T.errSub, false); if (subEl) subEl.focus(); return; }
      markStarted();

      if (result) { result.style.display = 'none'; }
      setBtnLoading(btn, T.creating);

      apiFetch('POST', '/trial', { email: email, subdomain: subdomain, product: product })
        .then(function(r) {
          resetBtn(btn);
          if (r.ok && r.body && r.body.success) {
            track('trial_issued', { product: product, plan: 'trial' });
            renderTrialSuccess(r.body, email);
          } else {
            showMsg(result, mapTrialError(r.body), false);
          }
        })
        .catch(function() { resetBtn(btn); showMsg(result, T.errNetwork, false); });
    });

    function mapTrialError(b) {
      b = b || {};
      if (b.error === 'Trial already used') { return b.message || T.errDup; }
      if (b.error === 'Invalid email') { return T.errEmail; }
      if (b.error === 'Subdomain required') { return T.errSub; }
      return b.message || b.error || T.errGeneric;
    }

    function renderTrialSuccess(data, email) {
      var card = el('div');
      card.style.cssText = 'margin-top:24px; background:#FFF; border:1px solid var(--rule); border-radius:8px; padding:28px; box-shadow:0 16px 48px -20px rgba(15,20,25,0.12);';

      var days = daysUntil(data.expiresAt);
      var head = el('div', null,
        '<div style="font-size:1.25rem; font-weight:600; margin-bottom:6px; color:var(--ink);">' + escapeHtml(T.trialHeading) + '</div>');
      card.appendChild(head);

      // license key + copy
      var keyWrap = el('div');
      keyWrap.style.cssText = 'margin:18px 0; display:flex; flex-wrap:wrap; gap:10px; align-items:center;';
      var keyBox = el('code');
      keyBox.style.cssText = 'flex:1; min-width:240px; font-family:"JetBrains Mono",monospace; font-size:0.9375rem; background:var(--paper-deep,#EFEDE6); padding:12px 14px; border-radius:4px; user-select:all; word-break:break-all;';
      keyBox.textContent = data.license_key;
      keyWrap.appendChild(el('div', null, '<div style="width:100%; font-size:0.75rem; letter-spacing:0.06em; text-transform:uppercase; color:var(--ink-mute); margin-bottom:6px;">' + escapeHtml(T.keyLabel) + '</div>'));
      keyWrap.appendChild(keyBox);
      var copyBtn = el('button', { type: 'button', 'class': 'btn btn-secondary btn-sm' });
      copyBtn.textContent = T.copy;
      copyBtn.addEventListener('click', function() {
        var done = function() { copyBtn.textContent = T.copied; setTimeout(function() { copyBtn.textContent = T.copy; }, 2000); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(data.license_key).then(done, done);
        } else { done(); }
      });
      keyWrap.appendChild(copyBtn);
      card.appendChild(keyWrap);

      // meta row
      var meta = el('div');
      meta.style.cssText = 'display:flex; flex-wrap:wrap; gap:20px; font-size:0.875rem; color:var(--ink-soft); border-top:1px solid var(--rule); border-bottom:1px solid var(--rule); padding:14px 0; margin-bottom:18px;';
      meta.innerHTML =
        '<span><strong>' + escapeHtml(T.productLabel) + ':</strong> ' + escapeHtml(data.product) + '</span>' +
        '<span><strong>' + escapeHtml(T.subdomainLabel) + ':</strong> ' + escapeHtml(data.subdomain) + '.kintone.com</span>' +
        '<span><strong>' + escapeHtml(T.expiresLabel) + ':</strong> ' + escapeHtml(fmtDate(data.expiresAt)) +
        (days != null ? ' · ' + days + ' ' + escapeHtml(T.daysLeft) : '') + '</span>';
      card.appendChild(meta);

      // emailed note (backend has "email-notifications" feature enabled)
      card.appendChild(el('p', null,
        '<span style="font-size:0.8125rem; color:var(--ink-mute);">' + escapeHtml(T.emailed(email)) + '</span>'));

      // install steps
      var steps = '<div style="font-size:0.8125rem; letter-spacing:0.04em; text-transform:uppercase; color:var(--clay); margin:18px 0 10px;">' + escapeHtml(T.installTitle) + '</div><ol style="margin:0; padding-left:20px; color:var(--ink-soft); font-size:0.9375rem; line-height:1.7;">';
      T.installSteps.forEach(function(s) { steps += '<li style="margin-bottom:6px;">' + s + '</li>'; });
      steps += '</ol>';
      card.appendChild(el('div', null, steps));

      var dashHref = LANG === 'ja' ? '/ja/dashboard.html' : '/dashboard.html';
      var cta = el('a', { href: dashHref, 'class': 'btn btn-primary' });
      cta.style.marginTop = '20px';
      cta.textContent = T.gotoDashboard;
      card.appendChild(cta);

      // Replace the form card's body with the success card.
      if (result) { result.style.display = 'none'; }
      var host = form.parentNode;
      form.style.display = 'none';
      // hide the social-auth block + divider if present on the page
      var socials = $('#kp-social');
      if (socials) { socials.style.display = 'none'; }
      var divider = $('#kp-divider');
      if (divider) { divider.style.display = 'none'; }
      host.insertBefore(card, result || null);
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /* =================================================================== CONTACT */
  function initContact(form) {
    var btn = form.querySelector('button[type="submit"]');
    var result = $('#kp-contact-result');
    form.addEventListener('submit', function(ev) {
      ev.preventDefault();
      var data = {
        email: (form.querySelector('[name="email"]') || {}).value || '',
        name: (form.querySelector('[name="name"]') || {}).value || '',
        company: (form.querySelector('[name="company"]') || {}).value || '',
        topic: (form.querySelector('[name="topic"]') || {}).value || '',
        message: (form.querySelector('[name="message"]') || {}).value || '',
        source: 'contact'
      };
      if (!validEmail(data.email.trim())) { showMsg(result, T.errEmail, false); return; }
      setBtnLoading(btn, T.sending);
      // No dedicated /contact endpoint exists; /signup is the lead-capture path.
      apiFetch('POST', '/signup', data)
        .then(function(r) {
          resetBtn(btn);
          if (r.ok && r.body && r.body.success) {
            track('contact_submitted', { topic: data.topic });
            form.reset();
            showMsg(result, T.contactOk, true);
          } else {
            showMsg(result, (r.body && (r.body.message || r.body.error)) || T.contactErr, false);
          }
        })
        .catch(function() { resetBtn(btn); showMsg(result, T.contactErr, false); });
    });
  }

  /* ===================================================================== CLERK */
  // Derive the Clerk Frontend API host from the publishable key (base64 segment).
  function clerkHost(pk) {
    try {
      var seg = pk.split('_')[2];
      var decoded = atob(seg);
      return decoded.replace(/\$+$/, '');
    } catch (e) { return null; }
  }
  function clerkConfigured() {
    var pk = CFG.clerkPublishableKey || '';
    return /^pk_(live|test)_/.test(pk) && pk.indexOf('REPLACE') === -1;
  }
  function loadClerk() {
    return new Promise(function(resolve, reject) {
      if (!clerkConfigured()) { reject('not-configured'); return; }
      if (window.Clerk && window.Clerk.loaded) { resolve(window.Clerk); return; }
      var pk = CFG.clerkPublishableKey;
      var host = clerkHost(pk);
      if (!host) { reject('bad-key'); return; }
      var sc = document.createElement('script');
      sc.async = true;
      sc.crossOrigin = 'anonymous';
      sc.setAttribute('data-clerk-publishable-key', pk);
      sc.src = 'https://' + host + '/npm/@clerk/clerk-js@5/dist/clerk.browser.js';
      sc.addEventListener('load', function() {
        if (!window.Clerk) { reject('no-global'); return; }
        window.Clerk.load().then(function() { resolve(window.Clerk); }, reject);
      });
      sc.addEventListener('error', function() { reject('load-failed'); });
      document.head.appendChild(sc);
    });
  }
  function dashboardUrl() { return LANG === 'ja' ? '/ja/dashboard.html' : '/dashboard.html'; }

  /* ===================================================================== LOGIN */
  function initLogin() {
    var mount = $('#kp-clerk');
    var fallback = $('#kp-login-fallback');
    var notice = $('#kp-login-notice');
    loadClerk().then(function(Clerk) {
      if (Clerk.user) { window.location.href = dashboardUrl(); return; }
      if (mount) {
        if (fallback) { fallback.style.display = 'none'; }
        Clerk.mountSignIn(mount, { afterSignInUrl: dashboardUrl(), afterSignUpUrl: dashboardUrl() });
      }
    }).catch(function() {
      // Clerk not configured yet — keep the static UI but make it honest.
      if (notice) { showMsg(notice, T.loginNotice, false); }
      wireDisabled(fallback);
    });
  }

  // Prevent the static (non-Clerk) auth controls from no-op submitting / reloading.
  function wireDisabled(scope) {
    var root = scope || document;
    var form = root.querySelector('form');
    if (form) { form.addEventListener('submit', function(e) { e.preventDefault(); }); }
    root.querySelectorAll('button').forEach(function(b) {
      if (b.type === 'submit') { return; }
      b.addEventListener('click', function(e) {
        e.preventDefault();
        if (clerkConfigured()) { loadClerk().then(function(C) { C.openSignIn({ afterSignInUrl: dashboardUrl() }); }); }
      });
    });
  }

  /* ================================================================= DASHBOARD */
  // Dev-only escape hatch for local Playwright testing. Inert in production:
  // only honoured on localhost/127.0.0.1 (the live backend already exposes
  // /licenses by email header — see PR security note about token verification).
  function devEmail() {
    var h = window.location.hostname;
    if (h !== 'localhost' && h !== '127.0.0.1') { return null; }
    try { return new URLSearchParams(window.location.search).get('kpDevEmail'); } catch (e) { return null; }
  }

  function initDashboard(container) {
    function loadLicenses(email) {
      container.innerHTML = '';
      var loading = el('p', null, escapeHtml(T.dashLoading));
      loading.style.color = 'var(--ink-soft)';
      container.appendChild(loading);
      apiFetch('GET', '/licenses', null, { 'X-User-Email': email })
        .then(function(r) {
          container.innerHTML = '';
          if (r.ok && r.body && r.body.licenses) { renderLicenses(container, r.body.licenses); }
          else { showMsg(makeBox(container), T.dashError, false); }
        })
        .catch(function() { container.innerHTML = ''; showMsg(makeBox(container), T.dashError, false); });
    }

    var de = devEmail();
    if (clerkConfigured()) {
      mountSignedInChrome(container, loadLicenses);
    } else if (de) {
      loadLicenses(de);
    } else {
      renderSignedOut(container);
    }
  }

  function makeBox(container) { var b = el('div'); container.appendChild(b); return b; }

  function mountSignedInChrome(container, loadLicenses) {
    loadClerk().then(function(Clerk) {
      if (!Clerk.user) {
        Clerk.redirectToSignIn({ afterSignInUrl: window.location.href });
        return;
      }
      var email = Clerk.user.primaryEmailAddress && Clerk.user.primaryEmailAddress.emailAddress;
      var bar = $('#kp-userbar');
      if (bar) { Clerk.mountUserButton(bar, { afterSignOutUrl: '/' }); }
      if (email) { loadLicenses(email); } else { renderSignedOut(container); }
    }).catch(function() { renderSignedOut(container); });
  }

  function renderSignedOut(container) {
    container.innerHTML = '';
    var box = el('div');
    box.style.cssText = 'background:#FFF; padding:32px; border-radius:8px; border:1px solid var(--rule);';
    box.appendChild(el('p', null, '<span style="color:var(--ink-soft); line-height:1.7;">' + escapeHtml(T.dashSignedOut) + '</span>'));
    var row = el('div'); row.style.cssText = 'display:flex; gap:12px; flex-wrap:wrap; margin-top:18px;';
    var signup = el('a', { href: LANG === 'ja' ? '/ja/signup/' : '/signup/', 'class': 'btn btn-primary' }); signup.textContent = T.startTrialCta;
    var login = el('a', { href: LANG === 'ja' ? '/ja/login.html' : '/login.html', 'class': 'btn btn-secondary' }); login.textContent = T.signInCta;
    row.appendChild(signup); row.appendChild(login); box.appendChild(row);
    container.appendChild(box);
  }

  function renderLicenses(container, licenses) {
    if (!licenses.length) { renderSignedOut(container); return; }
    var grid = el('div');
    grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px;';
    licenses.forEach(function(lic) {
      var active = (lic.status || '').toLowerCase() === 'active';
      var days = daysUntil(lic.expiresAt);
      var card = el('div');
      card.style.cssText = 'background:#FFF; border:1px solid var(--rule); border-radius:8px; padding:22px;';
      card.innerHTML =
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:8px;">' +
          '<span style="font-weight:600; font-size:1.0625rem;">' + escapeHtml(lic.product) + '</span>' +
          '<span class="badge ' + (active ? 'badge-live' : 'badge-plan') + '">' + escapeHtml(active ? T.active : T.expired) + '</span>' +
        '</div>' +
        '<div style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--ink-mute); margin-bottom:4px;">' + escapeHtml(T.keyLabel) + '</div>' +
        '<code style="display:block; font-family:\'JetBrains Mono\',monospace; font-size:0.8125rem; background:var(--paper-deep,#EFEDE6); padding:8px 10px; border-radius:4px; user-select:all; word-break:break-all; margin-bottom:12px;">' + escapeHtml(lic.license_key) + '</code>' +
        '<div style="font-size:0.875rem; color:var(--ink-soft); line-height:1.7;">' +
          '<div><strong>' + escapeHtml(T.subdomainLabel) + ':</strong> ' + escapeHtml(lic.subdomain) + '.kintone.com</div>' +
          '<div><strong>' + escapeHtml(T.expiresLabel) + ':</strong> ' + escapeHtml(fmtDate(lic.expiresAt)) +
            (active && days != null ? ' · ' + days + ' ' + escapeHtml(T.daysLeft) : '') + '</div>' +
        '</div>';
      grid.appendChild(card);
    });
    container.appendChild(grid);
  }

  /* ====================================================================== BOOT */
  document.addEventListener('DOMContentLoaded', function() {
    var signup = $('#kp-signup-form');
    if (signup) { initSignup(signup); }
    var contact = $('#kp-contact-form');
    if (contact) { initContact(contact); }
    if ($('#kp-login')) { initLogin(); }
    var dash = $('#kp-dashboard');
    if (dash) { initDashboard(dash); }
  });
})();
