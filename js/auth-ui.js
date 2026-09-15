/**
 * ============================================================
 * CephasGM GameZone — Auth UI
 * ============================================================
 * Auto-injects a user badge + Sign Out button into the top-right
 * corner of any page when a user is logged in.
 *
 * Also handles:
 *   • Optional page-level auth guard (add data-requires-auth to <body>)
 *   • Optional guest-only guard (add data-guest-only to <body>)
 *
 * Include AFTER js/api.js
 * ============================================================
 */

(function () {
  'use strict';

  function init() {
    if (!window.CephasGM || !window.CephasGM.api) return;

    var api = window.CephasGM.api;
    var isLoggedIn = api.isLoggedIn();
    var user = api.getUser();

    /* ---------------- Page guards ---------------- */
    var body = document.body;

    if (body.hasAttribute('data-requires-auth') && !isLoggedIn) {
      window.location.href = 'signin.html';
      return;
    }

    if (body.hasAttribute('data-guest-only') && isLoggedIn) {
      window.location.href = 'dashboard.html';
      return;
    }

    /* ---------------- User badge ---------------- */
    if (isLoggedIn && user) {
      injectUserBadge(user, api);
    }
  }

  function injectUserBadge(user, api) {
    if (document.getElementById('cg-user-badge')) return;

    var initial = (user.fullName || user.email || user.phone || 'U')
      .charAt(0)
      .toUpperCase();

    var displayName = user.fullName || 'Player';
    var displayContact = user.email || user.phone || '';

    var badge = document.createElement('div');
    badge.id = 'cg-user-badge';
    badge.style.cssText = [
      'position:fixed',
      'top:84px',
      'right:16px',
      'z-index:999',
      'display:flex',
      'align-items:center',
      'gap:10px',
      'padding:8px 8px 8px 12px',
      'background:rgba(10,10,18,0.92)',
      'backdrop-filter:blur(18px)',
      '-webkit-backdrop-filter:blur(18px)',
      'border:1px solid rgba(255,255,255,0.08)',
      'border-radius:999px',
      'font-family:Inter,-apple-system,sans-serif',
      'color:#fff',
      'box-shadow:0 8px 24px rgba(0,0,0,0.5)',
      'animation:cg-slide-in 0.4s ease',
    ].join(';');

    var style = document.createElement('style');
    style.textContent = [
      '@keyframes cg-slide-in {',
      '  from { opacity: 0; transform: translateY(-10px); }',
      '  to   { opacity: 1; transform: translateY(0); }',
      '}',
      '@media (max-width: 640px) {',
      '  #cg-user-badge { top:76px !important; right:8px !important; padding:6px !important; }',
      '  #cg-user-badge .cg-user-text { display: none !important; }',
      '}',
    ].join('\n');
    document.head.appendChild(style);

    badge.innerHTML =
      '<div style="width:30px;height:30px;border-radius:50%;' +
      'background:linear-gradient(135deg,#0055ff,#542bff);' +
      'display:flex;align-items:center;justify-content:center;' +
      'font-weight:800;font-size:12px;flex-shrink:0;">' + initial + '</div>' +
      '<div class="cg-user-text" style="display:flex;flex-direction:column;line-height:1.1;max-width:140px;">' +
      '<span style="font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(displayName) + '</span>' +
      '<span style="font-size:10px;color:rgba(255,255,255,0.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(displayContact) + '</span>' +
      '</div>' +
      '<button id="cg-signout" style="' +
      'padding:6px 14px;border-radius:999px;' +
      'background:rgba(255,0,68,0.15);' +
      'border:1px solid rgba(255,0,68,0.3);' +
      'color:#ff8098;font-size:11px;font-weight:700;' +
      'cursor:pointer;transition:all .2s;white-space:nowrap;' +
      'font-family:inherit;' +
      '">Sign Out</button>';

    document.body.appendChild(badge);

    /* Hover effect */
    var btn = document.getElementById('cg-signout');
    btn.addEventListener('mouseenter', function () {
      btn.style.background = 'rgba(255,0,68,0.25)';
      btn.style.borderColor = 'rgba(255,0,68,0.5)';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.background = 'rgba(255,0,68,0.15)';
      btn.style.borderColor = 'rgba(255,0,68,0.3)';
    });

    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = 'Signing out…';

      /* Fire and forget — clear tokens locally regardless */
      Promise.resolve()
        .then(function () { return api.logout(); })
        .catch(function () { /* ignore */ })
        .then(function () {
          api.clearTokens();
          window.location.href = 'signin.html';
        });
    });
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------------- Run ---------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();