/**
 * Fitbit High Score – GitHub Pages frontend.
 * Public view: no login. Fetches profile, leaderboard, and steps from backend public API.
 */
(function () {
  const API = window.API_BASE_URL;

  function api(path) {
    const url = path.startsWith('http') ? path : `${API.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
    return fetch(url);
  }

  function showMessage(text, type) {
    const el = document.getElementById('message');
    el.textContent = text;
    el.className = 'message ' + (type || 'info');
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 5000);
  }

  function loadProfile() {
    const el = document.getElementById('profile-content');
    api('/api/public/profile')
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(j))))
      .then((data) => {
        const u = data.user || {};
        el.innerHTML =
          '<div class="profile-card">' +
          (u.avatar150 ? '<img class="avatar" src="' + u.avatar150 + '" alt="" />' : '') +
          '<div><strong>' + escapeHtml(u.displayName || u.fullName || 'User') + '</strong>' +
          (u.averageDailySteps != null ? '<div class="stat">Avg daily steps <strong>' + Number(u.averageDailySteps).toLocaleString() + '</strong></div>' : '') +
          (u.memberSince ? '<div class="stat">Member since <strong>' + escapeHtml(u.memberSince) + '</strong></div>' : '') +
          '</div></div>';
      })
      .catch((err) => {
        el.innerHTML = '<p class="hint">' + (err && err.error ? escapeHtml(err.error) : 'Could not load profile.') + '</p>';
      });
  }

  function loadLeaderboard() {
    const el = document.getElementById('leaderboard-content');
    api('/api/public/leaderboard')
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(j))))
      .then((data) => {
        const list = data.data || [];
        const included = (data.included || []).reduce((acc, p) => {
          if (p.type === 'person' && p.id) acc[p.id] = p.attributes || {};
          return acc;
        }, {});

        if (list.length === 0) {
          el.innerHTML = '<p class="hint">No leaderboard data yet.</p>';
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
            (avatar ? '<img src="' + escapeHtml(avatar) + '" alt="" />' : '') + '</td><td>' + escapeHtml(name) + '</td><td>' + steps + '</td></tr>';
        });
        rows += '</tbody></table>';
        el.innerHTML = rows;
      })
      .catch((err) => {
        el.innerHTML = '<p class="hint">' + (err && err.error ? escapeHtml(err.error) : 'Could not load leaderboard.') + '</p>';
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
    if (s == null) return '';
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
    const contentEl = document.getElementById('challenge-content');
    contentEl.innerHTML = '<p class="hint">Loading…</p>';
    api('/api/public/steps?startDate=' + encodeURIComponent(start) + '&endDate=' + encodeURIComponent(end))
      .then((r) => (r.ok ? r.json() : r.json().then((j) => Promise.reject(j))))
      .then((data) => {
        const activities = data['activities-steps'] || [];
        const total = activities.reduce((sum, d) => sum + parseInt(d.value || 0, 10), 0);
        contentEl.innerHTML = '<p class="steps-summary">Total steps: <strong>' + total.toLocaleString() + '</strong> (' + activities.length + ' days)</p>';
      })
      .catch((err) => {
        contentEl.innerHTML = '<p class="hint">' + (err && err.error ? escapeHtml(err.error) : 'Could not load steps.') + '</p>';
      });
  });

  setDefaultChallengeDates();
  loadProfile();
  loadLeaderboard();
})();
