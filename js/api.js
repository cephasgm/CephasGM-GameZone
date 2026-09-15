/**
 * ============================================================
 * CephasGM GameZone — API Client
 * ============================================================
 * Frontend helper for talking to the production backend.
 * Usage from any page:
 *   <script src="js/api.js"></script>
 *   <script>
 *     CephasGM.api.get('/auth/me').then(console.log);
 *   </script>
 * ============================================================
 */

(function () {
  'use strict';

  var API_BASE = 'https://cephasgm-api.onrender.com/api/v1';

  var TOKEN_KEY   = 'cg_access_token';
  var REFRESH_KEY = 'cg_refresh_token';
  var USER_KEY    = 'cg_user';

  /* ---------------- Storage helpers ---------------- */
  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setTokens(access, refresh) {
    if (access) localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  }
  function clearTokens() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  }
  function getUser() {
    try {
      var raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function setUser(user) {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function isLoggedIn() { return !!getToken(); }

  /* ---------------- Core request ---------------- */
  function request(path, options) {
    options = options || {};
    var method  = options.method || 'GET';
    var body    = options.body;
    var headers = options.headers || {};

    headers['Content-Type'] = 'application/json';

    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    var fetchOptions = { method: method, headers: headers };
    if (body) fetchOptions.body = JSON.stringify(body);

    return fetch(API_BASE + path, fetchOptions)
      .then(function (res) {
        return res.json().then(function (json) {
          return { status: res.status, ok: res.ok, json: json };
        });
      })
      .then(function (r) {
        // Auto-refresh if access token expired
        if (r.status === 401 && r.json.code === 'TOKEN_EXPIRED' && !options._retried) {
          return refreshAccessToken().then(function (newTok) {
            if (!newTok) {
              clearTokens();
              throw { status: 401, message: 'Session expired', code: 'SESSION_EXPIRED' };
            }
            var retry = Object.assign({}, options, { _retried: true });
            return request(path, retry);
          });
        }
        if (!r.ok) {
          var err = r.json || {};
          err.status = r.status;
          throw err;
        }
        return r.json;
      });
  }

  function refreshAccessToken() {
    var refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return Promise.resolve(null);

    return fetch(API_BASE + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refreshToken }),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.success && j.data && j.data.accessToken) {
          setTokens(j.data.accessToken, null);
          return j.data.accessToken;
        }
        return null;
      })
      .catch(function () { return null; });
  }

  /* ---------------- Public API ---------------- */
  var api = {
    base: API_BASE,
    getToken: getToken,
    setTokens: setTokens,
    clearTokens: clearTokens,
    getUser: getUser,
    setUser: setUser,
    isLoggedIn: isLoggedIn,

    get:    function (p, o)    { return request(p, Object.assign({}, o, { method: 'GET' })); },
    post:   function (p, b, o) { return request(p, Object.assign({}, o, { method: 'POST',   body: b })); },
    patch:  function (p, b, o) { return request(p, Object.assign({}, o, { method: 'PATCH',  body: b })); },
    put:    function (p, b, o) { return request(p, Object.assign({}, o, { method: 'PUT',    body: b })); },
    delete: function (p, o)    { return request(p, Object.assign({}, o, { method: 'DELETE' })); },

    /* Auth convenience */
    register: function (data) { return api.post('/auth/register', data); },
    login: function (email, password) {
      return api.post('/auth/login', { email: email, password: password })
        .then(function (res) {
          if (res.success && res.data) {
            setTokens(res.data.accessToken, res.data.refreshToken);
            setUser(res.data.user);
          }
          return res;
        });
    },
    logout: function () {
      var rt = localStorage.getItem(REFRESH_KEY);
      return api.post('/auth/logout', { refreshToken: rt })
        .catch(function () {})
        .then(function () { clearTokens(); });
    },
    me: function () {
      return api.get('/auth/me').then(function (res) {
        if (res.success && res.data) setUser(res.data);
        return res;
      });
    },

    /* Convenience */
    wallet:       function ()      { return api.get('/wallet'); },
    transactions: function (page)  { return api.get('/transactions?page=' + (page || 1)); },
    placeBet:     function (data)  { return api.post('/bets', data); },
    myBets:       function (page)  { return api.get('/bets?page=' + (page || 1)); },
  };

  /* ---------------- Global expose ---------------- */
  window.CephasGM = window.CephasGM || {};
  window.CephasGM.api = api;

  window.CephasGM.auth = {
    isLoggedIn: isLoggedIn,
    getUser: getUser,
    requireLogin: function (redirectTo) {
      if (!isLoggedIn()) {
        window.location.href = redirectTo || 'signin.html';
        return false;
      }
      return true;
    },
    redirectIfLoggedIn: function (redirectTo) {
      if (isLoggedIn()) {
        window.location.href = redirectTo || 'dashboard.html';
        return true;
      }
      return false;
    },
  };

  /* ---------------- Small toast ---------------- */
  window.CephasGM.toast = function (message, type) {
    type = type || 'success';
    var bg = type === 'error' ? 'rgba(255,0,68,0.15)' :
             type === 'warning' ? 'rgba(255,204,0,0.15)' :
             'rgba(0,255,136,0.15)';
    var color = type === 'error' ? '#ff97ab' :
                type === 'warning' ? '#ffe07d' :
                '#7dffbe';

    var el = document.createElement('div');
    el.style.cssText =
      'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);' +
      'padding:13px 22px;border-radius:16px;font-size:13px;font-weight:700;' +
      'background:' + bg + ';color:' + color + ';' +
      'backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,0.08);' +
      'z-index:9999;opacity:0;transition:opacity .3s,transform .3s;' +
      'white-space:nowrap;pointer-events:none;';
    el.textContent = message;
    document.body.appendChild(el);

    requestAnimationFrame(function () {
      el.style.opacity = '1';
      el.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(20px)';
      setTimeout(function () { el.remove(); }, 300);
    }, 2400);
  };

  console.log('✅ CephasGM API client loaded — base:', API_BASE);
})();