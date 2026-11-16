// Token Radar dashboard: renders window.RADAR (written by main.ts) with no
// network. Board rows are pre-token protocols ranked by implied value; the
// "already trading" table is the market's own values, kept apart.
(function () {
  var D = window.RADAR;
  if (!D || !Array.isArray(D.rows)) {
    document.getElementById('rows').innerHTML = '<tr><td colspan="8">No radar data loaded.</td></tr>';
    return;
  }

  function $(id) { return document.getElementById(id); }
  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function pct(n) {
    if (n === null || n === undefined) return '—';
    var s = (n > 0 ? '+' : '') + n.toFixed(1) + '%';
    return '<span class="' + (n > 0 ? 'up' : n < 0 ? 'down' : '') + '">' + s + '</span>';
  }
  function age(n) {
    if (n === null || n === undefined) return '—';
    if (n < 30) return n + 'd';
    if (n < 365) return Math.round(n / 30) + 'mo';
    return (n / 365).toFixed(1) + 'y';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---- header stats -------------------------------------------------------
  $('stats').innerHTML =
    '<div><dt>Board rows</dt><dd>' + D.board_size + '</dd></div>' +
    '<div><dt>Watchlist</dt><dd>' + D.watchlist_size + '</dd></div>' +
    '<div><dt>Early finds</dt><dd>' + D.early_size + '</dd></div>' +
    '<div><dt>Total implied</dt><dd>' + money(D.total_implied_usd) + '</dd></div>';
  $('modelVersion').textContent = 'model ' + D.model_version;
  $('src').textContent = D.source_note;
  $('asof').textContent = D.as_of;
  $('foot').textContent = D.board_size + ' rows, ' + D.watchlist_size + ' watchlist + ' + D.early_size + ' early, ' + D.pre_token_count + ' pre-token protocols in the snapshot';

  // ---- filter controls ----------------------------------------------------
  var cats = {};
  var chains = {};
  D.rows.forEach(function (r) {
    if (r.category) cats[r.category] = 1;
    (r.chains || []).forEach(function (c) { chains[c] = 1; });
  });
  Object.keys(cats).sort().forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c; $('cat').appendChild(o);
  });
  Object.keys(chains).sort().forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c; $('chain').appendChild(o);
  });

  var state = { q: '', cat: '', chain: '', sort: 'implied', watch: false, detail: null };

  function filtered() {
    var rows = D.rows.filter(function (r) {
      if (state.watch && !isWatch(r)) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.q) {
        var q = state.q.toLowerCase();
        if (r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    });
    var by = {
      implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
      age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0); },
      name: function (a, b) { return a.name.localeCompare(b.name); }
    }[state.sort];
    return rows.slice().sort(by);
  }

  // Watchlist membership is carried in the data as watch: true, set by the
  // model from the snapshot's own watchlist. The rank band is only a fallback.
  function isWatch(r) {
    if (typeof r.watch === 'boolean') return r.watch;
    return r.rank <= D.watchlist_size;
  }

  function render() {
    var rows = filtered();
    $('count').textContent = rows.length + ' of ' + D.rows.length + ' rows';
    $('rows').innerHTML = rows.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"' + (state.detail === r.slug ? ' class="sel"' : '') + '>' +
        '<td>' + r.rank + '</td>' +
        '<td><b>' + esc(r.name) + '</b><br><span class="slug">' + esc(r.slug) + '</span> ' +
        (isWatch(r) ? '<span class="pill">watchlist</span>' : '') + '</td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc((r.chains || []).slice(0, 3).join(', ') || '—') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age(r.age_days) + '</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td></tr>';
    }).join('') || '<tr><td colspan="8">No rows match these filters.</td></tr>';
    Array.prototype.forEach.call($('rows').querySelectorAll('tr[data-slug]'), function (tr) {
      tr.addEventListener('click', function () { openDetail(tr.getAttribute('data-slug')); });
    });
  }

  // ---- detail view ----------------------------------------------------------
  function bar(label, value, max, text) {
    var w = Math.max(4, Math.min(100, (value / max) * 100));
    return '<div class="bar-row"><div class="lab"><span>' + label + '</span><b>' + text + '</b></div>' +
      '<div class="bar"><i style="width:' + w.toFixed(0) + '%"></i></div></div>';
  }
  function openDetail(slug) {
    var r = null;
    D.rows.forEach(function (x) { if (x.slug === slug) r = x; });
    if (!r) return;
    state.detail = slug;
    $('detail').hidden = false;
    $('dName').textContent = '#' + r.rank + '  ' + r.name;
    $('dStats').innerHTML =
      '<div><dt>Implied value</dt><dd>' + money(r.implied_value_usd) + '</dd></div>' +
      '<div><dt>TVL</dt><dd>' + money(r.tvl_usd) + '</dd></div>' +
      '<div><dt>7-day change</dt><dd>' + (r.change_7d === null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</dd></div>' +
      '<div><dt>Age</dt><dd>' + age(r.age_days) + '</dd></div>' +
      '<div><dt>Chains</dt><dd>' + esc((r.chains || []).join(', ') || '—') + '</dd></div>' +
      '<div><dt>Category</dt><dd>' + esc(r.category || '—') + '</dd></div>';
    var base = r.tvl_usd * D.model.base_multiple;
    $('dBars').innerHTML =
      bar('Base — TVL × 0.30', base, D.rows[0].tvl_usd * D.model.base_multiple, money(base)) +
      bar('Growth ×' + r.growth_multiplier.toFixed(2), r.growth_multiplier, 2.2, '×' + r.growth_multiplier.toFixed(2)) +
      bar('Maturity ×' + r.maturity_multiplier.toFixed(2), r.maturity_multiplier, 1.2, '×' + r.maturity_multiplier.toFixed(2)) +
      bar('Breadth ×' + r.breadth_multiplier.toFixed(2), r.breadth_multiplier, 1.2, '×' + r.breadth_multiplier.toFixed(2) + ' · ' + (r.chains || []).length + ' chain(s)');
    $('dSteps').innerHTML = (r.farm_steps || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    render();
    $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('dClose').addEventListener('click', function () {
    state.detail = null;
    $('detail').hidden = true;
    render();
  });

  // ---- live table -----------------------------------------------------------
  $('liveRows').innerHTML = (D.live || []).map(function (r) {
    return '<tr><td><b>' + esc(r.name) + '</b><br><span class="slug">' + esc(r.slug) + '</span></td>' +
      '<td>' + esc(r.category || '—') + '</td>' +
      '<td class="num">' + money(r.tvl_usd) + '</td>' +
      '<td class="num"><b>' + money(r.mcap_usd) + '</b></td>' +
      '<td class="num">' + pct(r.change_7d) + '</td></tr>';
  }).join('');

  // ---- events ---------------------------------------------------------------
  $('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  $('cat').addEventListener('change', function (e) { state.cat = e.target.value; render(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; render(); });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });
  $('watch').addEventListener('change', function (e) { state.watch = e.target.checked; render(); });

  // ---- hash state: #detail=<slug>, #cat=<category>, #q=<search> for deep links
  var hash = (location.hash || '').replace(/^#/, '');
  hash.split('&').forEach(function (part) {
    var kv = part.split('=');
    if (kv[0] === 'cat' && kv[1]) { state.cat = decodeURIComponent(kv[1]); $('cat').value = state.cat; }
    if (kv[0] === 'q' && kv[1]) { state.q = decodeURIComponent(kv[1]); $('q').value = state.q; }
    if (kv[0] === 'detail' && kv[1]) { state.detail = decodeURIComponent(kv[1]); }
  });

  render();
  if (state.detail) openDetail(state.detail);
})();
