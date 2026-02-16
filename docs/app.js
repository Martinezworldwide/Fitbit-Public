/**
 * Fitbit High Score – GitHub Pages frontend.
 * Calls backend at window.API_BASE_URL (set in config.js) with credentials.
 */
(function () {
  const API = window.API_BASE_URL;

  function api(path, options) {
    const url = path.startsWith('http') ? path : `${API.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
    return fetch(url, { credentials: 'include', ...options });
  }

  function showMessage(text, type) {
    const el = document.getElementById('message');
    el.textContent = text;
    el.className = 'message ' + (type || 'info');
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
  }

  function renderAuth(loggedIn) {
    const area = document.getElementById('auth-area');
    if (loggedIn) {
      area.innerHTML = '<button type="button" class="btn secondary" id="btn-logout">Log out</button>';
      document.getElementById('btn-logout').addEventListener('click', logout);
    } else {
      area.innerHTML = '<a href="' + API + '/auth/fitbit" class="btn">Log in with Fitbit</a>';
    }
  }

  function logout() {
    api('/auth/logout', { method: 'POST' })
      .then(() => {
        document.getElementById('main').classList.add('hidden');
        renderAuth(false);
      })
      .catch(() => renderAuth(false));
  }

  function checkAuth() {
    api('/api/profile')
      .then((r) => {
        if (r.ok) {
          document.getElementById('main').classList.remove('hidden');
          renderAuth(true);
          loadProfile();
          loadLeaderboard();
          setDefaultChallengeDates();
        } else {
          renderAuth(false);
          document.getElementById('main').classList.add('hidden');
        }
      })
      .catch(() => {
        renderAuth(false);
        document.getElementById('main').classList.add('hidden');
      });
  }

  function loadProfile() {
    api('/api/profile')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        const u = data.user || {};
        const html =
          '<div class="profile-card">' +
          (u.avatar150 ? '<img class="avatar" src="' + u.avatar150 + '" alt="" />' : '') +
          '<div><strong>' + (u.displayName || u.fullName || 'User') + '</strong>' +
          (u.averageDailySteps != null ? '<div class="stat">Avg daily steps <strong>' + Number(u.averageDailySteps).toLocaleString() + '</strong></div>' : '') +
          (u.memberSince ? '<div class="stat">Member since <strong>' + u.memberSince + '</strong></div>' : '') +
          '</div></div>';
        document.getElementById('profile-content').innerHTML = html;
      })
      .catch(() => {
        document.getElementById('profile-content').innerHTML = '<p class="hint">Could not load profile.</p>';
      });
  }

  function loadLeaderboard() {
    api('/api/leaderboard')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        const list = data.data || [];
        const included = (data.included || []).reduce((acc, p) => {
          if (p.type === 'person' && p.id) acc[p.id] = p.attributes || {};
          return acc;
        }, {});

        if (list.length === 0) {
          document.getElementById('leaderboard-content').innerHTML =
            '<p class="hint">No leaderboard data. Add friends on Fitbit and ask them to authorize this app.</p>';
          return;
        }

        let rows = '<table class="leaderboard-table"><thead><tr><th class="rank">#</th><th></th><th>Name</th><th>Steps (7 days)</th></tr></thead><tbody>';
        list.forEach((entry) => {
          const attrs = entry.attributes || {};
          const person = included[entry.id] || included[entry.relationships?.user?.data?.id] || {};
          const name = person.name || 'Friend';
          const avatar = person.avatar || '';
          const rank = attrs['step-rank'];
          const steps = attrs['step-summary'] != null ? Number(attrs['step-summary']).toLocaleString() : '–';
          const rankClass = rank <= 3 ? 'rank-' + rank : '';
          rows += '<tr><td class="rank ' + rankClass + '">' + (rank || '–') + '</td><td class="avatar-cell">' +
            (avatar ? '<img src="' + avatar + '" alt="" />' : '') + '</td><td>' + escapeHtml(name) + '</td><td>' + steps + '</td></tr>';
        });
        rows += '</tbody></table>';
        document.getElementById('leaderboard-content').innerHTML = rows;
      })
      .catch(() => {
        document.getElementById('leaderboard-content').innerHTML =
          '<p class="hint">Could not load leaderboard. Ensure you have the social scope and friends who use this app.</p>';
      });
  }

  function setDefaultChallengeDates() {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    document.getElementById('challenge-start').value = formatDate(start);
    document.getElementById('challenge-end').value = formatDate(end);
  }

  function formatDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  document.getElementById('challenge-load').addEventListener('click', () => {
    const start = document.getElementById('challenge-start').value;
    const end = document.getElementById('challenge-end').value;
    if (!start || !end) {
      showMessage('Pick start and end dates.', 'error');
      return;
    }
    api('/api/steps?startDate=' + encodeURIComponent(start) + '&endDate=' + encodeURIComponent(end))
      .then((r) => r.ok ? r.json() : r.json().then((j) => Promise.reject(j)))
      .then((data) => {
        const activities = data['activities-steps'] || [];
        const total = activities.reduce((sum, d) => sum + parseInt(d.value || 0, 10), 0);
        const html = '<p class="steps-summary">Total steps: <strong>' + total.toLocaleString() + '</strong> (' + activities.length + ' days)</p>';
        document.getElementById('challenge-content').innerHTML = html;
      })
      .catch((err) => {
        document.getElementById('challenge-content').innerHTML =
          '<p class="hint">Could not load steps. ' + (err && err.error ? err.error : '') + '</p>';
      });
  });

  // Handle ?logged_in=1 and ?error= from OAuth redirect
  const params = new URLSearchParams(window.location.search);
  if (params.get('logged_in') === '1') {
    history.replaceState({}, '', window.location.pathname);
    checkAuth();
    showMessage('Logged in successfully.', 'success');
  } else if (params.get('error')) {
    history.replaceState({}, '', window.location.pathname);
    showMessage('Login failed: ' + params.get('error'), 'error');
  }

  checkAuth();
})();
