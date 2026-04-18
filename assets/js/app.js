/* kinplug — minimal JS. Mobile nav toggle + lang persist. */

(function() {
  'use strict';

  // Mobile nav toggle
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.querySelector('.nav-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', function() {
      menu.classList.toggle('open');
    });
  }

  // Remember language preference so cross-links respect user choice
  var lang = document.documentElement.getAttribute('lang');
  if (lang === 'ja' || lang === 'en') {
    try { localStorage.setItem('kp-lang', lang); } catch(e) {}
  }

  // Add active state to current page nav link
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
