/**
 * KinPlug Archive — v3.0
 * Clerk Authentication + API Integration
 * Primary API: Cloud Run (Tokyo) · Fallback: Railway
 */

const CONFIG = {
  CLERK_PUBLISHABLE_KEY: 'pk_test_cHJvdmVuLXBpZ2xldC03MS5jbGVyay5hY2NvdW50cy5kZXYk',
  API_URL: 'https://kinplug-api-165259092767.asia-northeast1.run.app',
  API_FALLBACK: 'https://kinplug-api-production.up.railway.app',
  DEBUG: false
};

function log(...args) { if (CONFIG.DEBUG) console.log('[KinPlug]', ...args); }

// ============================================================
// UTILITIES
// ============================================================
function showLoading(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
}
function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="alert alert-error">${msg}</div>`;
}
function showEmpty(id, title, msg) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="empty-state"><h3>${title}</h3><p>${msg}</p></div>`;
}
function formatDate(d) {
  if (!d) return '—';
  const lang = document.documentElement.lang || 'en';
  return new Date(d).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    const lang = document.documentElement.lang || 'en';
    // Silent copy feedback would be better, but matches legacy behavior
    const flash = document.createElement('div');
    flash.textContent = lang === 'ja' ? 'コピーしました' : 'Copied';
    flash.style.cssText = 'position:fixed;bottom:32px;left:50%;transform:translateX(-50%);background:#14110F;color:#F4EFE6;padding:12px 20px;border-radius:2px;font-family:"JetBrains Mono",monospace;font-size:0.75rem;letter-spacing:0.12em;text-transform:uppercase;z-index:1000;opacity:0;transition:opacity 0.2s';
    document.body.appendChild(flash);
    requestAnimationFrame(() => flash.style.opacity = '1');
    setTimeout(() => { flash.style.opacity = '0'; setTimeout(() => flash.remove(), 300); }, 1400);
  });
}
function getLanguage() { return document.documentElement.lang || 'en'; }

// ============================================================
// CLERK AUTHENTICATION
// ============================================================
let clerkLoaded = false;
let currentUser = null;

async function initClerk() {
  if (!CONFIG.CLERK_PUBLISHABLE_KEY || CONFIG.CLERK_PUBLISHABLE_KEY.includes('YOUR_')) {
    log('Clerk not configured');
    showAuthReady(null);
    return;
  }
  try {
    await window.Clerk.load();
    clerkLoaded = true;
    currentUser = window.Clerk.user;
    log('Clerk loaded', currentUser?.primaryEmailAddress?.emailAddress || '(anon)');
    window.Clerk.addListener(() => {
      currentUser = window.Clerk.user;
      updateAuthUI(currentUser);
    });
    showAuthReady(currentUser);
  } catch (err) {
    console.error('Clerk init error:', err);
    showAuthReady(null);
  }
}

function showAuthReady(user) {
  document.querySelectorAll('.nav-auth').forEach(el => el.classList.add('ready'));
  updateAuthUI(user);
}

function updateAuthUI(user) {
  const authNav = document.getElementById('auth-nav');
  const userNav = document.getElementById('user-nav');
  const userName = document.getElementById('user-name');
  const userAvatar = document.getElementById('user-avatar');

  if (user) {
    if (authNav) authNav.classList.add('hidden');
    if (userNav) userNav.classList.remove('hidden');
    const email = user.primaryEmailAddress?.emailAddress || '';
    const name = user.firstName || email.split('@')[0];
    if (userName) userName.textContent = name;
    if (userAvatar) {
      if (user.imageUrl) {
        userAvatar.innerHTML = `<img src="${user.imageUrl}" alt="${name}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      } else {
        userAvatar.textContent = name.charAt(0).toUpperCase();
      }
    }
    if (document.getElementById('licenses-table')) loadUserLicenses();
  } else {
    if (authNav) authNav.classList.remove('hidden');
    if (userNav) userNav.classList.add('hidden');
  }
}

function signIn() {
  if (clerkLoaded && window.Clerk) {
    window.Clerk.openSignIn({
      afterSignInUrl: window.location.href,
      afterSignUpUrl: window.location.href
    });
  } else {
    window.location.href = '/login.html';
  }
}
function signUp() {
  if (clerkLoaded && window.Clerk) {
    window.Clerk.openSignUp({
      afterSignInUrl: '/dashboard.html',
      afterSignUpUrl: '/dashboard.html'
    });
  } else {
    window.location.href = '/login.html';
  }
}
function signOut() {
  if (clerkLoaded && window.Clerk) {
    window.Clerk.signOut().then(() => { window.location.href = '/'; });
  }
}
function openProfile() {
  if (clerkLoaded && window.Clerk) window.Clerk.openUserProfile();
}

// ============================================================
// API — with automatic fallback to Railway
// ============================================================
async function apiCall(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (currentUser?.primaryEmailAddress) {
    headers['X-User-Email'] = currentUser.primaryEmailAddress.emailAddress;
  }

  const urls = [CONFIG.API_URL, CONFIG.API_FALLBACK];
  let lastErr;
  for (const base of urls) {
    try {
      const res = await fetch(`${base}${endpoint}`, { ...options, headers });
      return await res.json();
    } catch (err) {
      lastErr = err;
      log(`API call failed on ${base}, trying next`);
    }
  }
  throw lastErr;
}

async function loadUserLicenses() {
  const tbody = document.getElementById('licenses-table');
  if (!tbody) return;
  showLoading('licenses-table');
  try {
    const email = currentUser?.primaryEmailAddress?.emailAddress;
    if (!email) {
      const lang = getLanguage();
      showEmpty('licenses-table',
        lang === 'ja' ? 'サインインしてください' : 'Not signed in',
        lang === 'ja' ? 'ライセンスを表示するにはサインインしてください。' : 'Sign in to view your licenses.');
      return;
    }
    const data = await apiCall('/licenses');
    if (!data.licenses || data.licenses.length === 0) {
      const lang = getLanguage();
      showEmpty('licenses-table',
        lang === 'ja' ? 'ライセンスがありません' : 'No licenses yet',
        lang === 'ja' ? '無料トライアルを開始してください。' : 'Start a free trial to get going.');
      return;
    }
    tbody.innerHTML = data.licenses.map(l => `
      <tr>
        <td>${l.product || '—'}</td>
        <td><span class="license-key" onclick="KinPlug.copyToClipboard('${l.license_key}')">${l.license_key}</span></td>
        <td><span class="status-badge ${l.type}">${l.type}</span></td>
        <td><span class="status-badge ${l.status}">${l.status}</span></td>
        <td>${formatDate(l.expiresAt)}</td>
      </tr>`).join('');
    updateDashboardStats(data.licenses);
  } catch (err) {
    console.error('License load failed:', err);
    showError('licenses-table', getLanguage() === 'ja' ? 'ライセンスの読み込みに失敗しました。' : 'Failed to load licenses.');
  }
}

function updateDashboardStats(licenses) {
  const active = licenses.filter(l => l.status === 'active').length;
  const trial = licenses.filter(l => l.type === 'trial' && l.status === 'active').length;
  const expired = licenses.filter(l => l.status === 'expired').length;
  const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  el('stat-active', active);
  el('stat-trial', trial);
  el('stat-expired', expired);
}

async function startTrial(product) {
  const lang = getLanguage();
  if (!currentUser) { signUp(); return; }
  const email = currentUser.primaryEmailAddress?.emailAddress;
  const promptMsg = lang === 'ja'
    ? 'Kintoneサブドメインを入力してください（例：mycompany.kintone.com の場合は「mycompany」）：'
    : 'Enter your Kintone subdomain (e.g., "mycompany" from mycompany.kintone.com):';
  const subdomain = prompt(promptMsg);
  if (!subdomain) return;
  try {
    const data = await apiCall('/trial', {
      method: 'POST',
      body: JSON.stringify({ email, subdomain: subdomain.replace('.kintone.com', '').trim(), product })
    });
    if (data.success) {
      const msg = lang === 'ja'
        ? `🎉 トライアル開始\n\nライセンスキー：\n${data.license_key}\n\n有効期限：${formatDate(data.expiresAt)}\n\nこのキーをプラグイン設定画面で入力してください。`
        : `🎉 Trial started.\n\nLicense key:\n${data.license_key}\n\nExpires: ${formatDate(data.expiresAt)}\n\nEnter this key in the plugin settings.`;
      alert(msg);
      if (document.getElementById('licenses-table')) loadUserLicenses();
    } else {
      alert(`Error: ${data.error || data.message || 'Failed to start trial'}`);
    }
  } catch (err) {
    console.error('Trial start failed:', err);
    alert(lang === 'ja' ? 'トライアル開始に失敗しました。もう一度お試しください。' : 'Failed to start trial. Please try again.');
  }
}

async function notifyMe(product) {
  const lang = getLanguage();
  let email = currentUser?.primaryEmailAddress?.emailAddress;
  if (!email) {
    email = prompt(lang === 'ja' ? 'メールアドレスを入力してください：' : 'Enter your email address:');
    if (!email) return;
  }
  try {
    await apiCall('/signup', {
      method: 'POST',
      body: JSON.stringify({ email, product, type: 'notify' })
    });
    alert(lang === 'ja'
      ? `✅ 登録完了\n\n${product} のリリース時にお知らせします。`
      : `✅ You're on the list.\n\nWe'll notify you when ${product} is available.`);
  } catch (err) {
    console.error('Notify signup failed:', err);
    alert(lang === 'ja' ? '登録に失敗しました。もう一度お試しください。' : 'Failed to sign up. Please try again.');
  }
}

async function loadPlugins() {
  const container = document.getElementById('plugins-list');
  if (!container) return;
  showLoading('plugins-list');
  try {
    const data = await apiCall('/plugins');
    if (!data.plugins || data.plugins.length === 0) {
      showEmpty('plugins-list', 'No plugins available', 'Check back soon.');
      return;
    }
    // Render dynamic plugin list using catalog format
    container.innerHTML = data.plugins.map((p, i) => `
      <a href="/plugins/${p.plugin_id}/" class="cat-item">
        <span class="cat-num">№ ${String(i + 1).padStart(2, '0')}</span>
        <div><div class="cat-name">${p.name}</div></div>
        <div class="cat-desc">${p.description || ''}</div>
        <div class="cat-price">—</div>
        <span class="cat-status cat-status-live">Live</span>
        <span class="cat-arrow">→</span>
      </a>`).join('');
  } catch (err) {
    console.error('Plugin load failed:', err);
    showError('plugins-list', 'Failed to load plugins.');
  }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  log('Init');
  if (window.Clerk) {
    initClerk();
  } else {
    const check = setInterval(() => {
      if (window.Clerk) { clearInterval(check); initClerk(); }
    }, 100);
    setTimeout(() => {
      clearInterval(check);
      if (!window.Clerk) { log('Clerk timeout'); showAuthReady(null); }
    }, 5000);
  }
  if (document.getElementById('plugins-list')) loadPlugins();
});

window.KinPlug = {
  signIn, signUp, signOut, openProfile,
  startTrial, notifyMe, copyToClipboard,
  loadUserLicenses, loadPlugins
};
