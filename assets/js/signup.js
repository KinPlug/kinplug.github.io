(function () {
  'use strict';
  var API = 'https://kinplug-api-165259092767.asia-northeast1.run.app';
  var isJa = ((document.documentElement.lang || '').toLowerCase().indexOf('ja') === 0)
             || location.pathname.indexOf('/ja/') === 0;

  var T = isJa ? {
    invalidEmail: '有効なメールアドレスを入力してください。',
    needSub: 'Kintoneサブドメインを入力してください。',
    working: '開始しています…',
    genericErr: 'トライアルの開始中に問題が発生しました。support@kinplug.com までご連絡ください。設定いたします。',
    body: function (sub, dateStr, email) {
      return 'すべてのプラグインの30日間トライアルが ' + sub + '.kintone.com で有効になりました（' + dateStr + ' まで）。設定手順を ' + email + ' に送信しました。';
    }
  } : {
    invalidEmail: 'Please enter a valid email address.',
    needSub: 'Please enter your Kintone subdomain.',
    working: 'Starting…',
    genericErr: "Something went wrong starting your trial. Email support@kinplug.com and we'll set you up.",
    body: function (sub, dateStr, email) {
      return 'Your 30-day trial of every plugin is live on ' + sub + '.kintone.com through ' + dateStr + '. We have emailed setup instructions to ' + email + '.';
    }
  };

  function ready(fn) {
    if (document.readyState !== 'loading') { fn(); }
    else { document.addEventListener('DOMContentLoaded', fn); }
  }

  ready(function () {
    var form = document.getElementById('trialForm');
    if (!form) return;
    var emailEl = document.getElementById('su-email');
    var subEl = document.getElementById('su-subdomain');
    var btn = document.getElementById('su-submit');
    var msg = document.getElementById('su-msg');
    var success = document.getElementById('su-success');
    var successBody = document.getElementById('su-success-body');

    function showErr(text) {
      msg.textContent = text;
      msg.style.display = 'block';
      msg.style.background = '#FDECEC';
      msg.style.color = '#B42318';
      msg.style.border = '1px solid #F5C6C6';
    }
    function clearMsg() { msg.style.display = 'none'; msg.textContent = ''; }

    function normalizeSub(v) {
      return (v || '').trim().toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\.kintone\.com.*$/, '')
        .replace(/\.cybozu\.com.*$/, '')
        .replace(/\/.*$/, '')
        .trim();
    }
    function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
    function fmtDate(iso) {
      try {
        return new Date(iso).toLocaleDateString(isJa ? 'ja-JP' : 'en-US',
          { year: 'numeric', month: 'long', day: 'numeric' });
      } catch (e) { return iso; }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearMsg();
      var email = (emailEl.value || '').trim();
      var sub = normalizeSub(subEl.value);
      if (!validEmail(email)) { showErr(T.invalidEmail); emailEl.focus(); return; }
      if (!sub) { showErr(T.needSub); subEl.focus(); return; }

      var original = btn.innerHTML;
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.textContent = T.working;

      fetch(API + '/trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, subdomain: sub, product: 'all' })
      }).then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      }).then(function (r) {
        if (r.ok && r.data && r.data.success) {
          form.style.display = 'none';
          successBody.textContent = T.body(sub, fmtDate(r.data.expiresAt), email);
          success.style.display = 'block';
          success.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          var m = (r.data && (r.data.message || r.data.error)) ? (r.data.message || r.data.error) : T.genericErr;
          showErr(m);
          btn.disabled = false; btn.style.opacity = '1'; btn.innerHTML = original;
        }
      }).catch(function () {
        showErr(T.genericErr);
        btn.disabled = false; btn.style.opacity = '1'; btn.innerHTML = original;
      });
    });
  });
})();
