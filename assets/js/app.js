/**
 * KinPlug Website JavaScript
 * Clerk Authentication + API Integration
 * v1.3.0 - Fixed auth flash issue
 */

const CONFIG = {
  CLERK_PUBLISHABLE_KEY: 'pk_test_cHJvdmVuLXBpZ2xldC03MS5jbGVyay5hY2NvdW50cy5kZXYk',
  API_URL: 'https://kinplug-api-production.up.railway.app',
  DEBUG: false
};

function log(...args) {
  if (CONFIG.DEBUG) console.log('[KinPlug]', ...args);
}

// ============================================================
// UTILITIES
// ============================================================

function showLoading(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) el.innerHTML = `<div class="alert alert-error">${message}</div>`;
}

function showEmpty(elementId, title, message) {
  const el = document.getElementById(elementId);
  if (el) el.innerHTML = `<div class="empty-state"><h3>${title}</h3><p>${message}</p></div>`;
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const lang = document.documentElement.lang || 'en';
  return new Date(dateString).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    const lang = document.documentElement.lang || 'en';
    alert(lang === 'ja' ? 'クリップボードにコピーしました！' : 'Copied to clipboard!');
  });
}

function getLanguage() {
  return document.documentElement.lang || 'en';
}

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
    log('Clerk loaded, user:', currentUser?.primaryEmailAddress?.emailAddress || 'not signed in');
    
    // Listen for auth changes
    window.Clerk.addListener(() => {
      currentUser = window.Clerk.user;
      updateAuthUI(currentUser);
    });
    
    // Show auth UI now that we know the state
    showAuthReady(currentUser);
  } catch (err) {
    console.error('Clerk init error:', err);
    showAuthReady(null);
  }
}

// Show auth section after Clerk determines state (prevents flash)
function showAuthReady(user) {
  const navAuth = document.querySelector('.nav-auth');
  if (navAuth) {
    navAuth.classList.add('ready');
  }
  updateAuthUI(user);
}

function updateAuthUI(user) {
  const authNav = document.getElementById('auth-nav');
  const userNav = document.getElementById('user-nav');
  const userName = document.getElementById('user-name');
  const userAvatar = document.getElementById('user-avatar');
  
  if (user) {
    // User is logged in
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
    
    // Load licenses if on dashboard
    if (document.getElementById('licenses-table')) {
      loadUserLicenses();
    }
  } else {
    // User is logged out
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
    window.Clerk.signOut().then(() => {
      window.location.href = '/';
    });
  }
}

function openProfile() {
  if (clerkLoaded && window.Clerk) {
    window.Clerk.openUserProfile();
  }
}

// ============================================================
// API CALLS
// ============================================================

async function apiCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (currentUser?.primaryEmailAddress) {
    headers['X-User-Email'] = currentUser.primaryEmailAddress.emailAddress;
  }
  
  const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
    ...options,
    headers
  });
  
  return response.json();
}

async function loadUserLicenses() {
  const tableBody = document.getElementById('licenses-table');
  if (!tableBody) return;
  
  showLoading('licenses-table');
  
  try {
    const email = currentUser?.primaryEmailAddress?.emailAddress;
    if (!email) {
      const lang = getLanguage();
      showEmpty('licenses-table', 
        lang === 'ja' ? 'ログインしてください' : 'Not logged in',
        lang === 'ja' ? 'ライセンスを表示するにはログインが必要です。' : 'Please sign in to view your licenses.'
      );
      return;
    }
    
    const data = await apiCall('/licenses');
    
    if (!data.licenses || data.licenses.length === 0) {
      const lang = getLanguage();
      showEmpty('licenses-table',
        lang === 'ja' ? 'ライセンスがありません' : 'No licenses yet',
        lang === 'ja' ? '無料トライアルを開始してください。' : 'Start a free trial or purchase a license to get started.'
      );
      return;
    }
    
    tableBody.innerHTML = data.licenses.map(license => `
      <tr>
        <td>${license.product || 'Unknown'}</td>
        <td>
          <span class="license-key" onclick="KinPlug.copyToClipboard('${license.license_key}')" title="Click to copy" style="cursor:pointer;font-family:monospace;font-size:0.85rem;">
            ${license.license_key}
          </span>
        </td>
        <td><span class="status-badge ${license.type}">${license.type}</span></td>
        <td><span class="status-badge ${license.status}">${license.status}</span></td>
        <td>${formatDate(license.expiresAt)}</td>
      </tr>
    `).join('');
    
    updateDashboardStats(data.licenses);
  } catch (err) {
    console.error('Error loading licenses:', err);
    showError('licenses-table', getLanguage() === 'ja' ? 'ライセンスの読み込みに失敗しました。' : 'Failed to load licenses. Please try again.');
  }
}

function updateDashboardStats(licenses) {
  const active = licenses.filter(l => l.status === 'active').length;
  const trial = licenses.filter(l => l.type === 'trial' && l.status === 'active').length;
  const expired = licenses.filter(l => l.status === 'expired').length;
  
  const activeEl = document.getElementById('stat-active');
  const trialEl = document.getElementById('stat-trial');
  const expiredEl = document.getElementById('stat-expired');
  
  if (activeEl) activeEl.textContent = active;
  if (trialEl) trialEl.textContent = trial;
  if (expiredEl) expiredEl.textContent = expired;
}

async function startTrial(product) {
  const lang = getLanguage();
  
  if (!currentUser) {
    signUp();
    return;
  }
  
  const email = currentUser.primaryEmailAddress?.emailAddress;
  const promptMsg = lang === 'ja' 
    ? 'kintoneサブドメインを入力してください（例：mycompany.kintone.com の場合は mycompany）：'
    : 'Enter your Kintone subdomain (e.g., "mycompany" from mycompany.kintone.com):';
  
  const subdomain = prompt(promptMsg);
  if (!subdomain) return;
  
  try {
    const data = await apiCall('/trial', {
      method: 'POST',
      body: JSON.stringify({
        email,
        subdomain: subdomain.replace('.kintone.com', '').trim(),
        product
      })
    });
    
    if (data.success) {
      const successMsg = lang === 'ja'
        ? `🎉 トライアル開始！\n\nライセンスキー：\n${data.license_key}\n\n有効期限：${formatDate(data.expiresAt)}\n\nこのキーをプラグイン設定画面で入力してください。`
        : `🎉 Trial started!\n\nYour license key:\n${data.license_key}\n\nExpires: ${formatDate(data.expiresAt)}\n\nEnter this key in the plugin settings.`;
      
      alert(successMsg);
      
      if (document.getElementById('licenses-table')) {
        loadUserLicenses();
      }
    } else {
      alert(`Error: ${data.error || data.message || 'Failed to start trial'}`);
    }
  } catch (err) {
    console.error('Error starting trial:', err);
    alert(lang === 'ja' ? 'トライアル開始に失敗しました。もう一度お試しください。' : 'Failed to start trial. Please try again.');
  }
}

async function notifyMe(product) {
  const lang = getLanguage();
  
  let email = currentUser?.primaryEmailAddress?.emailAddress;
  
  if (!email) {
    const promptMsg = lang === 'ja'
      ? 'メールアドレスを入力してください：'
      : 'Enter your email address:';
    email = prompt(promptMsg);
    if (!email) return;
  }
  
  try {
    const data = await apiCall('/signup', {
      method: 'POST',
      body: JSON.stringify({
        email,
        product,
        type: 'notify'
      })
    });
    
    const successMsg = lang === 'ja'
      ? `✅ 登録完了！\n\n${product}のリリース時にお知らせします。`
      : `✅ You're on the list!\n\nWe'll notify you when ${product} is available.`;
    
    alert(successMsg);
  } catch (err) {
    console.error('Error signing up for notification:', err);
    const errorMsg = lang === 'ja'
      ? '登録に失敗しました。もう一度お試しください。'
      : 'Failed to sign up. Please try again.';
    alert(errorMsg);
  }
}

async function loadPlugins() {
  const container = document.getElementById('plugins-list');
  if (!container) return;
  
  showLoading('plugins-list');
  
  try {
    const data = await apiCall('/plugins');
    
    if (!data.plugins || data.plugins.length === 0) {
      showEmpty('plugins-list', 'No plugins available', 'Check back soon!');
      return;
    }
    
    container.innerHTML = data.plugins.map(plugin => `
      <div class="plugin-card">
        <div class="plugin-icon">📄</div>
        <h3>${plugin.name}</h3>
        <p>${plugin.description || ''}</p>
        <div class="plugin-actions">
          <button class="btn btn-primary" onclick="KinPlug.startTrial('${plugin.plugin_id}')">Start Free Trial</button>
          <a href="/plugins/${plugin.plugin_id}/" class="btn btn-text">Learn More →</a>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading plugins:', err);
    showError('plugins-list', 'Failed to load plugins.');
  }
}

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  log('Page loaded, initializing...');
  
  // Initialize Clerk
  if (window.Clerk) {
    initClerk();
  } else {
    const checkClerk = setInterval(() => {
      if (window.Clerk) {
        clearInterval(checkClerk);
        initClerk();
      }
    }, 100);
    
    // Timeout after 5 seconds - show logged out state
    setTimeout(() => {
      clearInterval(checkClerk);
      if (!window.Clerk) {
        log('Clerk not loaded after timeout');
        showAuthReady(null);
      }
    }, 5000);
  }
  
  // Load plugins if on plugins page
  if (document.getElementById('plugins-list')) {
    loadPlugins();
  }
});

// ============================================================
// GLOBAL EXPORTS
// ============================================================

window.KinPlug = {
  signIn,
  signUp,
  signOut,
  openProfile,
  startTrial,
  notifyMe,
  copyToClipboard,
  loadUserLicenses,
  loadPlugins
};
