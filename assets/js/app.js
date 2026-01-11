/**
 * KinPlug Website JavaScript
 * Clerk Authentication Integration
 */

// ============================================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================================
const CONFIG = {
  // Clerk - Get from https://dashboard.clerk.com → API Keys
  CLERK_PUBLISHABLE_KEY: 'pk_test_dW5jb21tb24tdHVuYS0xMi5jbGVyay5hY2NvdW50cy5kZXYk',
  
  // API
  API_URL: 'https://kinplug-api-production.up.railway.app',
  
  // URLs
  SITE_URL: 'https://kinplug.com',
  
  // Debug mode
  DEBUG: true
};

// ============================================================
// UTILITIES
// ============================================================
function log(...args) {
  if (CONFIG.DEBUG) console.log('[KinPlug]', ...args);
}

function showLoading(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  }
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerHTML = `<div class="alert alert-error">${message}</div>`;
  }
}

function showEmpty(elementId, title, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerHTML = `
      <div class="empty-state">
        <h3>${title}</h3>
        <p>${message}</p>
      </div>
    `;
  }
}

// Format date
function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('Copied to clipboard!');
  });
}

// ============================================================
// CLERK INTEGRATION
// ============================================================
let clerkLoaded = false;
let currentUser = null;

async function initClerk() {
  if (CONFIG.CLERK_PUBLISHABLE_KEY === 'YOUR_CLERK_PUBLISHABLE_KEY' || !CONFIG.CLERK_PUBLISHABLE_KEY) {
    log('⚠️ Clerk not configured - using demo mode');
    updateAuthUI(null);
    return;
  }
  
  try {
    await window.Clerk.load();
    clerkLoaded = true;
    currentUser = window.Clerk.user;
    
    log('Clerk loaded, user:', currentUser ? currentUser.primaryEmailAddress?.emailAddress : 'not signed in');
    
    // Listen for auth changes
    window.Clerk.addListener((event) => {
      log('Clerk event:', event);
      currentUser = window.Clerk.user;
      updateAuthUI(currentUser);
    });
    
    updateAuthUI(currentUser);
    
  } catch (err) {
    console.error('Clerk init error:', err);
  }
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
        userAvatar.innerHTML = `<img src="${user.imageUrl}" alt="${name}" style="width:100%;height:100%;border-radius:50%;">`;
      } else {
        userAvatar.textContent = name.charAt(0).toUpperCase();
      }
    }
    
    // Load user-specific content
    if (document.getElementById('licenses-table')) {
      loadUserLicenses();
    }
    
  } else {
    // User is not logged in
    if (authNav) authNav.classList.remove('hidden');
    if (userNav) userNav.classList.add('hidden');
  }
}

// Sign in
function signIn() {
  if (clerkLoaded && window.Clerk) {
    window.Clerk.openSignIn({
      afterSignInUrl: window.location.href,
      afterSignUpUrl: window.location.href
    });
  } else {
    // Demo mode - redirect to login page
    window.location.href = '/login.html';
  }
}

// Sign up
function signUp() {
  if (clerkLoaded && window.Clerk) {
    window.Clerk.openSignUp({
      afterSignInUrl: window.location.href,
      afterSignUpUrl: window.location.href
    });
  } else {
    window.location.href = '/login.html';
  }
}

// Sign out
function signOut() {
  if (clerkLoaded && window.Clerk) {
    window.Clerk.signOut().then(() => {
      window.location.href = '/';
    });
  }
}

// Open user profile
function openProfile() {
  if (clerkLoaded && window.Clerk) {
    window.Clerk.openUserProfile();
  }
}

// Get auth token for API calls
async function getAuthToken() {
  if (clerkLoaded && window.Clerk && window.Clerk.session) {
    return await window.Clerk.session.getToken();
  }
  return null;
}

// ============================================================
// API CALLS
// ============================================================

async function apiCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  // Send user email for authenticated requests
  if (currentUser && currentUser.primaryEmailAddress) {
    headers['X-User-Email'] = currentUser.primaryEmailAddress.emailAddress;
  }
  
  const response = await fetch(`${CONFIG.API_URL}${endpoint}`, {
    ...options,
    headers
  });
  
  return response.json();
}

// Load user's licenses
async function loadUserLicenses() {
  const tableBody = document.getElementById('licenses-table');
  if (!tableBody) return;
  
  showLoading('licenses-table');
  
  try {
    const email = currentUser?.primaryEmailAddress?.emailAddress;
    if (!email) {
      showEmpty('licenses-table', 'Not logged in', 'Please sign in to view your licenses.');
      return;
    }
    
    const data = await apiCall('/licenses');
    
    if (!data.licenses || data.licenses.length === 0) {
      showEmpty('licenses-table', 'No licenses yet', 'Start a free trial or purchase a license to get started.');
      return;
    }
    
    tableBody.innerHTML = data.licenses.map(license => `
      <tr>
        <td>${license.product || 'Unknown'}</td>
        <td>
          <span class="license-key" onclick="copyToClipboard('${license.license_key}')" title="Click to copy">
            ${license.license_key}
          </span>
        </td>
        <td><span class="status-badge ${license.type}">${license.type}</span></td>
        <td><span class="status-badge ${license.status}">${license.status}</span></td>
        <td>${formatDate(license.expiresAt)}</td>
      </tr>
    `).join('');
    
    // Update stats
    updateDashboardStats(data.licenses);
    
  } catch (err) {
    console.error('Error loading licenses:', err);
    showError('licenses-table', 'Failed to load licenses. Please try again.');
  }
}

// Update dashboard statistics
function updateDashboardStats(licenses) {
  const activeLicenses = licenses.filter(l => l.status === 'active').length;
  const trialLicenses = licenses.filter(l => l.type === 'trial' && l.status === 'active').length;
  const expiredLicenses = licenses.filter(l => l.status === 'expired').length;
  
  const activeEl = document.getElementById('stat-active');
  const trialEl = document.getElementById('stat-trial');
  const expiredEl = document.getElementById('stat-expired');
  
  if (activeEl) activeEl.textContent = activeLicenses;
  if (trialEl) trialEl.textContent = trialLicenses;
  if (expiredEl) expiredEl.textContent = expiredLicenses;
}

// Start a trial
async function startTrial(product) {
  if (!currentUser) {
    signIn();
    return;
  }
  
  const email = currentUser.primaryEmailAddress?.emailAddress;
  const subdomain = prompt('Enter your Kintone subdomain (e.g., "mycompany" from mycompany.kintone.com):');
  
  if (!subdomain) return;
  
  try {
    const data = await apiCall('/trial', {
      method: 'POST',
      body: JSON.stringify({
        email,
        subdomain: subdomain.replace('.kintone.com', ''),
        product
      })
    });
    
    if (data.success) {
      alert(`🎉 Trial started!\n\nYour license key:\n${data.license_key}\n\nExpires: ${formatDate(data.expiresAt)}`);
      
      // Reload licenses
      loadUserLicenses();
    } else {
      alert(`Error: ${data.error || 'Failed to start trial'}`);
    }
  } catch (err) {
    console.error('Error starting trial:', err);
    alert('Failed to start trial. Please try again.');
  }
}

// Load plugins list
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
        <div class="plugin-image">📄</div>
        <div class="plugin-content">
          <h3>${plugin.name}</h3>
          <p>${plugin.description}</p>
          <div class="plugin-meta">
            <span class="plugin-price">From $20/mo</span>
            <span class="plugin-badge ${plugin.status}">${plugin.status}</span>
          </div>
          <div class="mt-20">
            <button class="btn btn-primary" onclick="startTrial('${plugin.plugin_id}')">Start Free Trial</button>
            <a href="/plugins/${plugin.plugin_id}/" class="btn btn-secondary">Learn More</a>
          </div>
        </div>
      </div>
    `).join('');
    
  } catch (err) {
    console.error('Error loading plugins:', err);
    showError('plugins-list', 'Failed to load plugins.');
  }
}

// ============================================================
// PAGE INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  log('Page loaded, initializing...');
  
  // Initialize Clerk when script loads
  if (window.Clerk) {
    initClerk();
  } else {
    // Wait for Clerk script to load
    const checkClerk = setInterval(() => {
      if (window.Clerk) {
        clearInterval(checkClerk);
        initClerk();
      }
    }, 100);
    
    // Timeout after 5 seconds
    setTimeout(() => {
      clearInterval(checkClerk);
      if (!window.Clerk) {
        log('Clerk not loaded, using demo mode');
        updateAuthUI(null);
      }
    }, 5000);
  }
  
  // Load page-specific content
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
  copyToClipboard,
  loadUserLicenses,
  loadPlugins
};
