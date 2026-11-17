(() => {
  'use strict';

  /* =========================================================
     Constantes e estado
     ========================================================= */
  const GAME_COLORS = {
    fifa: '#3ddc84',
    rocket_league: '#4f8cff',
    clash_royale: '#ff6b6b',
    minecraft: '#c49a6c',
    fall_guys: '#ff7ac6',
    gang_beasts: '#ff9f43',
    plato: '#a78bfa',
  };
  const SWATCHES = ['#1ef2c2', '#f5c84c', '#ff7ac6', '#5ea8ff', '#ff9f43', '#b794ff', '#ff6b6b', '#a3e635'];
  const KEY_STORE = 'dg_admin_key';
  const mqMobile = window.matchMedia('(max-width: 760px)');

  const S = {
    cfg: null,
    stats: null,
    matches: [],
    view: null,
    game: null,
    chartTab: 'evolucao',
    filters: { q: '', game: '', result: '' },
    firstPaint: true,
  };
  const charts = [];

  /* =========================================================
     Utilidades
     ========================================================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (id, cls = '') => `<svg class="ico ${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const gameOf = (slug) => S.cfg.games.find((g) => g.slug === slug);
  const P = (id) => S.cfg.players.find((p) => p.id === id) || { id, name: `Jogador ${id}`, color: id === 1 ? '#1ef2c2' : '#f5c84c' };
  const pname = (id) => esc(P(id).name);
  const statsOf = (id) => S.stats.players.find((p) => p.id === id);
  const gstats = (slug) => S.stats.by_game.find((g) => g.slug === slug);

  const storage = {
    get() { try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; } },
    set(v) { try { v ? localStorage.setItem(KEY_STORE, v) : localStorage.removeItem(KEY_STORE); } catch { /* sem storage */ } },
  };

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0] || '?').slice(0, 2).toUpperCase();
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  const fmtDate = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  const fmtDateTime = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  const fmtMin = (m) => (!m ? '—' : m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m}min`);
  const fmtNum = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

  const gicon = (slug, size = '') => `<span class="gicon ${size}" style="--gc:${GAME_COLORS[slug] || '#1ef2c2'}">${icon('g-' + slug)}</span>`;
  const avatar = (id, size = '') => `<span class="avatar ${size}" style="--pc:${P(id).color}">${esc(initials(P(id).name))}</span>`;

  function ring(pct, size = '') {
    const r = 15.9;
    const c = 2 * Math.PI * r;
    const arc = pct > 0 ? `<circle class="arc" cx="18" cy="18" r="${r}" stroke-dasharray="${(c * pct) / 100} ${c}"/>` : '';
    return `<span class="ring ${size} ${pct < 50 ? 'is-low' : ''}"><svg viewBox="0 0 36 36"><circle class="track" cx="18" cy="18" r="${r}"/>${arc}</svg><span class="num">${pct}%</span></span>`;
  }

  function resultTag(m) {
    if (m.winner == null) return `<span class="tag tag-draw">Empate</span>`;
    return `<span class="tag tag-p${m.winner}">${icon('i-trophy')}${pname(m.winner)}</span>`;
  }

  function scoreHtml(m) {
    return `<span class="score num"><span class="c-p1">${m.player1_score}</span><span class="sep">:</span><span class="c-p2">${m.player2_score}</span></span>`;
  }

  /* =========================================================
     API
     ========================================================= */
  async function api(path, { method = 'GET', body, admin = false } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (admin && storage.get()) headers['X-Admin-Key'] = storage.get();
    const res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    let data = null;
    try { data = await res.json(); } catch { /* corpo vazio */ }
    if (!res.ok) {
      let msg = `Erro ${res.status}`;
      if (data && typeof data.detail === 'string') msg = data.detail;
      else if (data && Array.isArray(data.detail)) msg = data.detail.map((d) => d.msg).join(' · ');
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async function loadAll() {
    const [cfg, stats, matches] = await Promise.all([api('/api/config'), api('/api/stats'), api('/api/matches')]);
    S.cfg = cfg;
    S.stats = stats;
    S.matches = matches;
    applyTheme();
  }

  function applyTheme() {
    const root = document.documentElement.style;
    root.setProperty('--p1', P(1).color);
    root.setProperty('--p2', P(2).color);
    document.title = `${S.cfg.name} · ${S.cfg.prize}`;
    $('#brandName').textContent = S.cfg.name.toUpperCase();
    $('#footerBrand').textContent = S.cfg.name.toUpperCase();
    $('#footerMode').textContent = S.cfg.mode === 'local' ? 'Modo local · sem Supabase' : 'Online · Supabase';
  }

  /* =========================================================
     Gráficos
     ========================================================= */
  function destroyCharts() {
    while (charts.length) charts.pop().destroy();
  }

  function chartBase() {
    const grid = '#1f1f1f';
    const tick = '#6b6b6b';
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false, // gráfico funcional: sem animação, leitura imediata
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0c0c0c',
          borderColor: '#333',
          borderWidth: 1,
          titleColor: '#ececec',
          bodyColor: '#cfcfcf',
          padding: 10,
          cornerRadius: 6,
          boxWidth: 8,
          boxHeight: 8,
          boxPadding: 4,
          titleFont: { size: 11, weight: '500' },
          bodyFont: { size: 11 },
        },
      },
      scales: {
        x: { grid: { color: grid, drawTicks: false }, border: { display: false }, ticks: { color: tick, font: { size: 10 }, maxRotation: 0, autoSkipPadding: 14, padding: 8 } },
        y: { position: 'right', grid: { color: grid, drawTicks: false }, border: { display: false }, ticks: { color: tick, font: { size: 10 }, precision: 0, padding: 8 }, beginAtZero: true },
      },
    };
  }

  function mountChart(canvas, config) {
    if (!canvas || !window.Chart) return;
    charts.push(new window.Chart(canvas, config));
  }

  function mountMainChart() {
    const canvas = $('#mainChart');
    if (!canvas) return;
    const existing = charts.findIndex((c) => c.canvas === canvas);
    if (existing >= 0) charts.splice(existing, 1)[0].destroy();
    const tl = S.stats.timeline;
    if (!tl.length) return;
    const c1 = P(1).color;
    const c2 = P(2).color;
    const base = chartBase();
    const titleFor = (i) => {
      const t = tl[i];
      return t ? `#${i + 1} · ${gameOf(t.game).name} · ${fmtDate(t.played_at)}` : 'Início';
    };

    if (S.chartTab === 'evolucao') {
      base.plugins.tooltip.callbacks = {
        title: (items) => titleFor(items[0].dataIndex - 1),
        label: (item) => ` ${item.dataset.label}: ${item.raw} pts`,
      };
      mountChart(canvas, {
        type: 'line',
        data: {
          labels: ['0', ...tl.map((_, i) => `#${i + 1}`)],
          datasets: [
            { label: P(1).name, data: [0, ...tl.map((t) => t.p1)], borderColor: c1, backgroundColor: hexA(c1, 0.07), fill: 'origin', borderWidth: 2, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: c1 },
            { label: P(2).name, data: [0, ...tl.map((t) => t.p2)], borderColor: c2, backgroundColor: hexA(c2, 0.05), fill: 'origin', borderWidth: 2, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: c2 },
          ],
        },
        options: base,
      });
    } else if (S.chartTab === 'vantagem') {
      const lead = tl.map((t) => t.p1 - t.p2);
      base.plugins.tooltip.callbacks = {
        title: (items) => titleFor(items[0].dataIndex),
        label: (item) => {
          const v = item.raw;
          if (v === 0) return ' Empatados em pontos';
          return ` ${v > 0 ? P(1).name : P(2).name} na frente por ${Math.abs(v)} pts`;
        },
      };
      base.plugins.tooltip.displayColors = false;
      base.scales.y.beginAtZero = true;
      base.scales.y.ticks.callback = (v) => Math.abs(v);
      base.scales.y.grid.color = (ctx) => (ctx.tick && ctx.tick.value === 0 ? '#3a3a3a' : '#1f1f1f');
      mountChart(canvas, {
        type: 'bar',
        data: {
          labels: tl.map((_, i) => `#${i + 1}`),
          datasets: [{
            data: lead,
            backgroundColor: lead.map((v) => (v > 0 ? c1 : v < 0 ? c2 : '#555')),
            borderRadius: 2,
            barPercentage: 0.62,
            categoryPercentage: 0.9,
            minBarLength: 2,
          }],
        },
        options: base,
      });
    } else {
      const bg = S.stats.by_game;
      base.plugins.tooltip.callbacks = { title: (items) => gameOf(bg[items[0].dataIndex].slug).name };
      mountChart(canvas, {
        type: 'bar',
        data: {
          labels: bg.map((g) => gameOf(g.slug).short),
          datasets: [
            { label: `Vitórias ${P(1).name}`, data: bg.map((g) => g.p1_wins), backgroundColor: c1, borderRadius: 3, barPercentage: 0.8, categoryPercentage: 0.6, maxBarThickness: 22 },
            { label: 'Empates', data: bg.map((g) => g.draws), backgroundColor: '#4a4a4a', borderRadius: 3, barPercentage: 0.8, categoryPercentage: 0.6, maxBarThickness: 22 },
            { label: `Vitórias ${P(2).name}`, data: bg.map((g) => g.p2_wins), backgroundColor: c2, borderRadius: 3, barPercentage: 0.8, categoryPercentage: 0.6, maxBarThickness: 22 },
          ],
        },
        options: base,
      });
    }
  }

  function mountDonut() {
    const canvas = $('#donutChart');
    if (!canvas) return;
    const a = statsOf(1);
    const b = statsOf(2);
    const empty = S.stats.total_matches === 0;
    mountChart(canvas, {
      type: 'doughnut',
      data: {
        labels: [`Vitórias ${P(1).name}`, 'Empates', `Vitórias ${P(2).name}`],
        datasets: [{
          data: empty ? [1] : [a.wins, a.draws, b.wins],
          backgroundColor: empty ? ['#262626'] : [P(1).color, '#4a4a4a', P(2).color],
          borderWidth: 0,
          spacing: empty ? 0 : 3,
          borderRadius: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        cutout: '80%',
        plugins: { legend: { display: false }, tooltip: { enabled: !empty, ...chartBase().plugins.tooltip } },
      },
    });
  }

  function mountGameChart(slug) {
    const canvas = $('#gameChart');
    if (!canvas) return;
    const list = S.matches.filter((m) => m.game === slug).slice(0, 20).reverse();
    if (!list.length) return;
    const g = gameOf(slug);
    const base = chartBase();
    base.plugins.tooltip.callbacks = {
      title: (items) => {
        const m = list[items[0].dataIndex];
        return `${fmtDateTime(m.played_at)}${m.details?.mode ? ' · ' + m.details.mode : ''}`;
      },
      label: (item) => ` ${item.dataset.label}: ${item.raw} ${g.score_label.toLowerCase()}`,
    };
    mountChart(canvas, {
      type: 'bar',
      data: {
        labels: list.map((m) => fmtDate(m.played_at)),
        datasets: [
          { label: P(1).name, data: list.map((m) => m.player1_score), backgroundColor: P(1).color, borderRadius: 3, barPercentage: 0.85, categoryPercentage: 0.6, minBarLength: 2, maxBarThickness: 26 },
          { label: P(2).name, data: list.map((m) => m.player2_score), backgroundColor: P(2).color, borderRadius: 3, barPercentage: 0.85, categoryPercentage: 0.6, minBarLength: 2, maxBarThickness: 26 },
        ],
      },
      options: base,
    });
  }

  /* =========================================================
     Views — Dashboard
     ========================================================= */
  function countdownParts() {
    if (!S.cfg.end_date) return null;
    const end = new Date(S.cfg.end_date.length <= 10 ? S.cfg.end_date + 'T23:59:59' : S.cfg.end_date);
    const ms = end - new Date();
    if (Number.isNaN(ms)) return null;
    if (ms <= 0) return { done: true };
    const d = Math.floor(ms / 864e5);
    const h = Math.floor((ms % 864e5) / 36e5);
    const m = Math.floor((ms % 36e5) / 6e4);
    return { d, h, m };
  }

  function countdownHtml() {
    const c = countdownParts();
    if (!c) return '';
    if (c.done) return `<span class="tag tag-draw">Campeonato encerrado</span>`;
    return `<div class="countdown" data-countdown>
      <div class="cd-box"><b class="num">${c.d}</b><small>dias</small></div>
      <div class="cd-box"><b class="num">${String(c.h).padStart(2, '0')}</b><small>horas</small></div>
      <div class="cd-box"><b class="num">${String(c.m).padStart(2, '0')}</b><small>min</small></div>
    </div>`;
  }

  function heroCard() {
    const { cfg } = S;
    const fmtD = (d) => new Date(d.length <= 10 ? d + 'T12:00:00' : d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '');
    const range = cfg.start_date && cfg.end_date
      ? `${fmtD(cfg.start_date)} → ${fmtD(cfg.end_date)}`
      : cfg.end_date ? `Até ${fmtD(cfg.end_date)}` : 'Sem data de término';
    return `
      <div class="card hero">
        <div>
          <span class="tag tag-outline tag-live">Temporada ativa</span>
          <h1 class="hero-title" style="margin-top:14px">Campeonato ${esc(cfg.name)}</h1>
          <p>Dois jogadores, ${cfg.games.length} jogos, um prêmio. Vitória vale ${cfg.rules.win} pontos e empate vale ${cfg.rules.draw}. Quem terminar com mais pontos leva o ${esc(cfg.prize)}.</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          ${countdownHtml()}
          <div class="hero-meta"><span>${icon('i-cal', 'ico-sm')}${range}</span></div>
        </div>
      </div>`;
  }

  function prizeBanner() {
    const { leader, gap } = S.stats;
    const foot = S.stats.total_matches === 0
      ? 'Nenhuma partida ainda. Que comecem os jogos.'
      : leader
        ? `Hoje quem leva: <b class="c-p${leader}">${pname(leader)}</b> · +${gap} pts`
        : 'Empatados em pontos. Tudo em aberto.';
    return `
      <div class="prize" role="img" aria-label="Prêmio: ${esc(S.cfg.prize)}">
        <svg class="prize-art" viewBox="0 0 600 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <linearGradient id="pz-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#1d0b2e"/><stop offset=".42" stop-color="#9b2a78"/><stop offset=".72" stop-color="#ff7a4f"/><stop offset="1" stop-color="#ffc56b"/>
            </linearGradient>
            <linearGradient id="pz-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a0"/><stop offset="1" stop-color="#ff4f9a"/></linearGradient>
            <linearGradient id="pz-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#127e8a"/><stop offset="1" stop-color="#062a33"/></linearGradient>
            <clipPath id="pz-sunclip"><circle cx="420" cy="150" r="74"/></clipPath>
            <g id="pz-palm" fill="#16071d">
              <path d="M0 0 C4 -40 14 -80 40 -115" stroke="#16071d" stroke-width="7" fill="none" stroke-linecap="round"/>
              <path d="M40 -115 Q15 -132 -12 -120 Q15 -124 40 -112Z"/>
              <path d="M40 -115 Q65 -135 95 -125 Q65 -126 40 -112Z"/>
              <path d="M40 -115 Q48 -142 72 -154 Q52 -136 42 -113Z"/>
              <path d="M40 -115 Q25 -142 0 -148 Q24 -134 38 -113Z"/>
              <path d="M40 -115 Q20 -108 5 -85 Q22 -104 41 -112Z"/>
              <path d="M40 -115 Q62 -108 80 -88 Q60 -104 39 -112Z"/>
            </g>
          </defs>
          <rect width="600" height="220" fill="url(#pz-sky)"/>
          <g clip-path="url(#pz-sunclip)">
            <rect x="340" y="70" width="160" height="160" fill="url(#pz-sun)"/>
            <rect x="340" y="150" width="160" height="3" fill="#b8337a"/>
            <rect x="340" y="160" width="160" height="5" fill="#c43a72"/>
            <rect x="340" y="172" width="160" height="7" fill="#d4466a"/>
          </g>
          <path d="M0 176V150h14v-18h12v26h10v-38h14v38h10v-22h18v22h8v-50h16v50h12v-28h14v28h18v-16h10v16h22v-34h12v34h18v-12h34v12h26V176z" fill="#3a1140" opacity=".9"/>
          <rect y="174" width="600" height="46" fill="url(#pz-sea)"/>
          <path d="M360 186h120M384 196h72M404 206h32" stroke="#ffd27a" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>
          <use href="#pz-palm" transform="translate(505 222)"/>
          <use href="#pz-palm" transform="translate(560 226) scale(.72)"/>
          <use href="#pz-palm" transform="translate(300 224) scale(.55) scale(-1 1)"/>
        </svg>
        <div class="prize-body">
          <span class="prize-kicker">${icon('i-trophy')}Prêmio do campeão</span>
          <div>
            <div class="prize-name">${esc(S.cfg.prize)}</div>
            <div class="prize-foot">${foot}</div>
          </div>
        </div>
      </div>`;
  }

  function tickerHtml() {
    const list = S.matches.slice(0, 12);
    if (!list.length) return '';
    return `<div class="ticker" aria-label="Últimos resultados">${list.map((m) => {
      const g = gameOf(m.game);
      const cls = m.winner == null ? 'is-draw' : `is-p${m.winner}`;
      const sc = `<span class="num">${m.player1_score}-${m.player2_score}</span>`;
      const sub = m.winner == null ? `Empate · ${sc}` : `${esc(P(m.winner).nickname || P(m.winner).name)} venceu · ${sc}`;
      const tag = m.winner == null
        ? `<span class="tag tag-draw">Empate</span>`
        : `<span class="tag tag-p${m.winner}">${icon('i-trophy')}Win</span>`;
      return `<button class="tick ${cls}" data-match="${m.id}">
        ${gicon(m.game, 'gicon-sm')}
        <div class="tick-main"><div class="tick-title">${esc(g.name)}</div><div class="tick-sub">${sub}</div></div>
        ${tag}
      </button>`;
    }).join('')}</div>`;
  }

  function streakText(s) {
    if (!s.type) return '—';
    const map = { W: ['vitória', 'vitórias'], L: ['derrota', 'derrotas'], D: ['empate', 'empates'] };
    return plural(s.count, ...map[s.type]);
  }

  function playerCard(p) {
    const st = S.stats;
    const total = st.players[0].points + st.players[1].points;
    const share = total ? Math.round((p.points / total) * 100) : 0;
    const pips = [...p.form, ...Array(5 - p.form.length).fill('')].map((r) => `<span class="pip ${r}" title="${{ W: 'Vitória', L: 'Derrota', D: 'Empate' }[r] || 'Sem partida'}"></span>`).join('');
    return `
      <article class="card pcard card-p${p.id}">
        ${st.leader === p.id ? `<span class="tag tag-p${p.id} pcard-badge">${icon('i-crown')}Líder</span>` : ''}
        <div class="pcard-head">
          ${avatar(p.id)}
          <div style="min-width:0">
            <h3 class="pcard-name">${esc(p.name)}</h3>
            <div class="pcard-nick">${p.nickname ? esc(p.nickname) + ' · ' : ''}Jogador ${p.id}</div>
          </div>
        </div>
        <div class="pcard-level"><span>Pontos</span><span class="big c-p${p.id} num">${p.points} PTS</span></div>
        <div class="xp"><span>Domínio:</span><div class="bar bar-p${p.id}"><i style="--w:${share}%"></i></div><span class="num">${share}%</span></div>
        <div class="form"><span class="muted" style="font-size:11px;margin-right:6px">Últimas 5</span>${pips}<span class="muted" style="font-size:11px;margin-left:auto">${streakText(p.streak)}</span></div>
        <div class="boxes">
          <div class="box"><div class="box-label">Vitórias</div><div class="box-value num c-green">${p.wins}</div></div>
          <div class="box"><div class="box-label">Derrotas</div><div class="box-value num c-red">${p.losses}</div></div>
          <div class="box"><div class="box-label">Empates</div><div class="box-value num">${p.draws}</div></div>
        </div>
        <div class="boxes">
          <div class="box"><div class="box-label">Placar feito</div><div class="box-value num">${p.score_for}</div></div>
          <div class="box"><div class="box-label">Melhor seq.</div><div class="box-value num">${p.best_streak}V</div></div>
          <div class="box box-ring">${ring(p.win_rate)}</div>
        </div>
      </article>`;
  }

  function versusHtml() {
    const [a, b] = S.stats.players;
    const { leader, gap, total_matches } = S.stats;
    return `
      <div class="versus">
        <div class="versus-score num"><span class="c-p1">${a.wins}</span><span class="dim"> : </span><span class="c-p2">${b.wins}</span></div>
        <div class="versus-x">${icon('i-swords')}</div>
        <div>
          <div class="versus-gap">${leader ? `<span class="c-p${leader}">${pname(leader)}</span> +${gap} pts` : 'Empatados'}</div>
          <div class="muted" style="font-size:11px">${plural(total_matches, 'partida', 'partidas')}</div>
        </div>
      </div>`;
  }

  function chartCard() {
    const tabs = [['evolucao', 'Evolução'], ['vantagem', 'Vantagem'], ['jogos', 'Por jogo']];
    const empty = !S.stats.timeline.length;
    return `
      <div class="card chart-card">
        <div class="chart-toolbar">
          <div class="tabs-line" role="tablist">
            ${tabs.map(([k, l]) => `<button class="tab-line ${S.chartTab === k ? 'is-active' : ''}" role="tab" aria-selected="${S.chartTab === k}" data-chart="${k}">${l}</button>`).join('')}
          </div>
          <div class="chart-legend">
            <span class="c-p1"><i></i>${pname(1)}</span>
            <span class="c-p2"><i></i>${pname(2)}</span>
          </div>
        </div>
        <div class="chart-body">
          <canvas id="mainChart" aria-label="Gráfico do campeonato"></canvas>
          ${empty ? `<div class="chart-empty"><div>${icon('i-chart', 'ico-lg')}<div style="margin-top:8px">Registre a primeira partida<br>para ver os gráficos</div></div></div>` : ''}
        </div>
      </div>`;
  }

  function summaryCard() {
    const st = S.stats;
    const [a, b] = st.players;
    const most = st.most_played ? gameOf(st.most_played).name : '—';
    const big = st.biggest_win
      ? `<span class="c-p${st.biggest_win.winner}">${st.biggest_win.score}</span> <span class="muted">${gameOf(st.biggest_win.game).short}</span>`
      : '—';
    return `
      <div class="card summary">
        <div>
          <div class="muted" style="font-size:12px;margin-bottom:6px">Partidas disputadas</div>
          <div class="big-number num">${st.total_matches}</div>
        </div>
        <div class="boxes boxes-2">
          <div class="box box-left"><div class="box-label">Tempo jogado</div><div class="box-value num">${fmtMin(st.total_minutes)}</div></div>
          <div class="box box-left"><div class="box-label">Jogos usados</div><div class="box-value num">${st.games_played}/${S.cfg.games.length}</div></div>
          <div class="box box-left"><div class="box-label">Mais jogado</div><div class="box-value">${esc(most)}</div></div>
          <div class="box box-left"><div class="box-label">Maior vitória</div><div class="box-value num">${big}</div></div>
        </div>
        <div>
          <div class="progress-label"><span>Disputa de pontos</span><span class="num"><span class="c-p1">${a.points}</span> – <span class="c-p2">${b.points}</span></span></div>
          <div class="duel-bar"><i class="a" style="flex-grow:${a.points}"></i><i class="b" style="flex-grow:${b.points}"></i></div>
        </div>
        <div class="donut-wrap">
          <canvas id="donutChart" aria-label="Distribuição de resultados"></canvas>
          <div class="donut-center"><div><div class="big-number num" style="font-size:24px">${a.draws}</div><div class="muted" style="font-size:11px">empates</div></div></div>
        </div>
      </div>`;
  }

  function duelMini(x, y) {
    const t = x + y;
    const pct = t ? Math.round((x / t) * 100) : 0;
    return `<div style="display:flex;align-items:center;gap:8px;min-width:110px">
      <div class="duel-bar" style="flex:1">${t ? `<i class="a" style="flex-grow:${x}"></i><i class="b" style="flex-grow:${y}"></i>` : ''}</div>
      <span class="num muted" style="font-size:11px;width:32px;text-align:right">${t ? pct + '%' : '—'}</span>
    </div>`;
  }

  function leaderTag(l) {
    return l ? `<span class="tag tag-p${l}">${icon('i-crown')}${pname(l)}</span>` : `<span class="tag tag-outline">Empate</span>`;
  }

  function gamesTable() {
    const rows = S.stats.by_game;
    const table = `
      <div class="table-wrap collapse">
        <table class="table">
          <thead><tr>
            <th>Jogo</th><th class="c">Partidas</th><th class="c">Vitórias</th><th class="c">Empates</th>
            <th class="c">Placar total</th><th class="c">Média</th><th>Domínio ${pname(1)}</th><th>Líder</th><th class="c">Última</th>
          </tr></thead>
          <tbody>
            ${rows.map((g) => {
              const meta = gameOf(g.slug);
              return `<tr data-href="#/jogos/${g.slug}">
                <td><div class="cell-game">${gicon(g.slug, 'gicon-sm')}<div>${esc(meta.name)}<small>${esc(meta.score_label)}</small></div></div></td>
                <td class="c num">${g.matches}</td>
                <td class="c num"><span class="c-p1">${g.p1_wins}</span> <span class="dim">/</span> <span class="c-p2">${g.p2_wins}</span></td>
                <td class="c num">${g.draws}</td>
                <td class="c num"><span class="c-p1">${g.p1_score}</span> <span class="dim">/</span> <span class="c-p2">${g.p2_score}</span></td>
                <td class="c num muted">${fmtNum(g.p1_avg)} / ${fmtNum(g.p2_avg)}</td>
                <td>${duelMini(g.p1_wins, g.p2_wins)}</td>
                <td>${g.matches ? leaderTag(g.leader) : '<span class="dim">—</span>'}</td>
                <td class="c muted">${g.last_played ? fmtDate(g.last_played) : '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    const cards = `
      <div class="mlist">
        ${rows.map((g) => {
          const meta = gameOf(g.slug);
          return `<a class="mcard" href="#/jogos/${g.slug}">
            <div class="mcard-top">${gicon(g.slug, 'gicon-sm')}<div class="grow"><div>${esc(meta.name)}</div><div class="mcard-label">${plural(g.matches, 'partida', 'partidas')}</div></div>${g.matches ? leaderTag(g.leader) : ''}</div>
            <div class="mcard-row">
              <div><div class="mcard-label">Vitórias</div><div class="num"><span class="c-p1">${g.p1_wins}</span> / <span class="c-p2">${g.p2_wins}</span></div></div>
              <div><div class="mcard-label">Empates</div><div class="num">${g.draws}</div></div>
              <div style="text-align:right"><div class="mcard-label">${esc(meta.score_label)}</div><div class="num"><span class="c-p1">${g.p1_score}</span> / <span class="c-p2">${g.p2_score}</span></div></div>
            </div>
            ${duelMini(g.p1_wins, g.p2_wins)}
          </a>`;
        }).join('')}
      </div>`;
    return table + cards;
  }

  function viewDashboard() {
    const [a, b] = S.stats.players;
    return `
      <div class="${S.firstPaint ? 'stagger' : ''}">
        <section class="grid row-hero">${heroCard()}${prizeBanner()}</section>
        ${tickerHtml()}
        <section class="section">
          <div class="section-head">
            <h2 class="h-title">Placar geral</h2>
            <span class="muted">Vitória ${S.cfg.rules.win} pts · Empate ${S.cfg.rules.draw} pt</span>
          </div>
          <div class="grid row-versus">${playerCard(a)}${versusHtml()}${playerCard(b)}</div>
        </section>
        <section class="section grid row-charts">${chartCard()}${summaryCard()}</section>
        <section class="section">
          <div class="section-head">
            <div class="tabs-line"><span class="tab-line is-active">Estatísticas por jogo</span></div>
            <a href="#/jogos" class="btn btn-ghost">${icon('i-pad', 'ico-sm')}Ver jogos</a>
          </div>
          ${gamesTable()}
        </section>
      </div>`;
  }

  /* =========================================================
     Views — Partidas
     ========================================================= */
  function filteredMatches() {
    const { q, game, result } = S.filters;
    const needle = q.trim().toLowerCase();
    return S.matches.filter((m) => {
      if (game && m.game !== game) return false;
      if (result !== '') {
        const r = m.winner == null ? '0' : String(m.winner);
        if (r !== result) return false;
      }
      if (needle) {
        const hay = [gameOf(m.game).name, m.details?.mode, m.notes, m.winner ? P(m.winner).name : 'empate'].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }

  function emptyState(title, text) {
    return `<div class="empty">${icon('i-flag', 'ico-lg')}<div class="h-sub">${title}</div><div>${text}</div>
      <button class="btn btn-mint" data-action="open-register">${icon('i-plus', 'ico-sm')}Registrar partida</button></div>`;
  }

  function matchListHtml(list) {
    if (!list.length) {
      return S.matches.length
        ? `<div class="empty">${icon('i-search', 'ico-lg')}<div class="h-sub">Nada encontrado</div><div>Ajuste a busca ou os filtros.</div></div>`
        : emptyState('Nenhuma partida ainda', 'Registre o primeiro duelo para começar o placar.');
    }
    const table = `
      <div class="table-wrap collapse">
        <table class="table">
          <thead><tr><th>Resultado</th><th>Jogo</th><th class="c">Placar</th><th class="c">Duração</th><th>Data</th><th class="r"></th></tr></thead>
          <tbody>
            ${list.map((m) => {
              const g = gameOf(m.game);
              return `<tr data-match="${m.id}">
                <td>${resultTag(m)}</td>
                <td><div class="cell-game">${gicon(m.game, 'gicon-sm')}<div>${esc(g.name)}<small>${m.details?.mode ? esc(m.details.mode) : esc(g.score_label)}</small></div></div></td>
                <td class="c">${scoreHtml(m)}</td>
                <td class="c muted num">${fmtMin(m.duration_minutes)}</td>
                <td class="muted num">${fmtDateTime(m.played_at)}</td>
                <td class="r dim">${icon('i-chev-r', 'ico-sm')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    const cards = `
      <div class="mlist">
        ${list.map((m) => {
          const g = gameOf(m.game);
          return `<button class="mcard" data-match="${m.id}">
            <div class="mcard-top">${gicon(m.game, 'gicon-sm')}<div class="grow"><div>${esc(g.name)}</div><div class="mcard-label">${m.details?.mode ? esc(m.details.mode) : fmtDateTime(m.played_at)}</div></div>${scoreHtml(m)}</div>
            <div class="mcard-row">${resultTag(m)}<span class="mcard-label num">${fmtDateTime(m.played_at)}${m.duration_minutes ? ' · ' + fmtMin(m.duration_minutes) : ''}</span></div>
          </button>`;
        }).join('')}
      </div>`;
    return table + cards;
  }

  function viewPartidas() {
    const f = S.filters;
    const list = filteredMatches();
    return `
      <section>
        <div class="section-head">
          <div class="tabs-line"><span class="tab-line is-active">Histórico de partidas</span></div>
          <span class="muted" id="matchCount">${list.length} de ${S.matches.length}</span>
        </div>
        <div class="toolbar">
          <label class="field field-search">${icon('i-search', 'ico-sm')}<input id="fQ" type="search" placeholder="Buscar por jogo, modo, nota..." value="${esc(f.q)}" autocomplete="off"></label>
          <div class="select-wrap">
            <label class="field">${icon('i-pad', 'ico-sm')}<select id="fGame" aria-label="Filtrar por jogo">
              <option value="">Todos os jogos</option>
              ${S.cfg.games.map((g) => `<option value="${g.slug}" ${f.game === g.slug ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}
            </select></label>${icon('i-chev-d')}
          </div>
          <div class="select-wrap">
            <label class="field">${icon('i-filter', 'ico-sm')}<select id="fResult" aria-label="Filtrar por resultado">
              <option value="">Todos resultados</option>
              <option value="1" ${f.result === '1' ? 'selected' : ''}>Vitórias de ${pname(1)}</option>
              <option value="2" ${f.result === '2' ? 'selected' : ''}>Vitórias de ${pname(2)}</option>
              <option value="0" ${f.result === '0' ? 'selected' : ''}>Empates</option>
            </select></label>${icon('i-chev-d')}
          </div>
        </div>
        <div id="matchList" style="margin-top:16px">${matchListHtml(list)}</div>
      </section>`;
  }

  function refreshMatchList() {
    const list = filteredMatches();
    $('#matchList').innerHTML = matchListHtml(list);
    $('#matchCount').textContent = `${list.length} de ${S.matches.length}`;
  }

  /* =========================================================
     Views — Jogos
     ========================================================= */
  const LOWER_BETTER = (g, key) => !!(g.stats.find((s) => s.key === key) || {}).lower;

  function cmpRow(label, a, b, { unit = '', lower = false } = {}) {
    const hasA = a != null;
    const hasB = b != null;
    const va = hasA ? a : 0;
    const vb = hasB ? b : 0;
    let tint = '';
    if (hasA && hasB && va !== vb) {
      const p1Better = lower ? va < vb : va > vb;
      tint = p1Better ? 'cmp-tint-p1' : 'cmp-tint-p2';
    }
    const ga = va + vb === 0 ? 1 : va;
    const gb = va + vb === 0 ? 1 : vb;
    return `<div class="cmp ${tint}">
      <div class="cmp-head"><span class="cmp-label">${esc(label)}</span>${lower ? '<span class="dim" style="font-size:10px">menor é melhor</span>' : ''}</div>
      <div class="cmp-vals num"><span class="c-p1">${hasA ? fmtNum(va) + unit : '—'}</span><span class="c-p2">${hasB ? fmtNum(vb) + unit : '—'}</span></div>
      <div class="cmp-bar"><i class="a" style="flex-grow:${ga}"></i><i class="b" style="flex-grow:${gb}"></i></div>
    </div>`;
  }

  function viewJogos() {
    const slug = S.game;
    const g = gameOf(slug);
    const gs = gstats(slug);
    const gm = S.matches.filter((m) => m.game === slug);
    const strip = `<div class="game-strip" role="tablist" aria-label="Jogos">${S.cfg.games.map((x) => {
      const n = gstats(x.slug).matches;
      return `<a class="gtile ${x.slug === slug ? 'is-active' : ''}" href="#/jogos/${x.slug}" role="tab" aria-selected="${x.slug === slug}">
        ${gicon(x.slug)}<span class="gtile-name">${esc(x.name)}</span><span class="gtile-meta">${plural(n, 'partida', 'partidas')}</span>
      </a>`;
    }).join('')}</div>`;

    const compare = [
      cmpRow(`Média de ${g.score_label.toLowerCase()}`, gs.matches ? gs.p1_avg : null, gs.matches ? gs.p2_avg : null),
      cmpRow('Taxa de vitória', gs.matches ? gs.p1_win_rate : null, gs.matches ? gs.p2_win_rate : null, { unit: '%' }),
      ...g.stats.map((s) => cmpRow(s.label, gs.stats_avg.p1[s.key], gs.stats_avg.p2[s.key], { unit: s.unit === '%' ? '%' : '', lower: LOWER_BETTER(g, s.key) })),
    ].join('');

    const big = gs.biggest_win ? `<span class="c-p${gs.biggest_win.winner}">${gs.biggest_win.score}</span>` : '—';

    return `
      ${strip}
      <section class="section grid" style="gap:16px">
        <div class="card game-hero">
          ${gicon(slug, 'gicon-xl')}
          <div style="min-width:0">
            <span class="tag tag-outline">Placar em ${esc(g.score_label.toLowerCase())}</span>
            <h2 class="game-hero-title" style="margin-top:10px">${esc(g.name)}</h2>
            <div class="muted">${plural(gs.matches, 'partida', 'partidas')}${gs.last_played ? ' · última em ' + fmtDate(gs.last_played) : ''}</div>
          </div>
        </div>

        <div class="arena">
          <div class="arena-inner">
            <div class="fighter p1">${avatar(1, 'avatar-md')}<div style="min-width:0"><div class="fighter-name">${pname(1)}</div><div class="fighter-sub">${plural(gs.p1_wins, 'vitória', 'vitórias')}</div></div><div class="fighter-wins num c-p1">${gs.p1_wins}</div></div>
            <div class="versus" style="min-width:90px">
              <div class="versus-x">${icon('i-swords')}</div>
              <div>${gs.matches ? leaderTag(gs.leader) : '<span class="tag tag-outline">Sem partidas</span>'}</div>
              <div class="muted" style="font-size:11px">${plural(gs.draws, 'empate', 'empates')}</div>
            </div>
            <div class="fighter p2">${avatar(2, 'avatar-md')}<div style="min-width:0"><div class="fighter-name">${pname(2)}</div><div class="fighter-sub">${plural(gs.p2_wins, 'vitória', 'vitórias')}</div></div><div class="fighter-wins num c-p2">${gs.p2_wins}</div></div>
          </div>
        </div>

        <div class="boxes boxes-4">
          <div class="box box-left"><div class="box-label">Partidas</div><div class="box-value num">${gs.matches}</div></div>
          <div class="box box-left"><div class="box-label">${esc(g.score_label)} no total</div><div class="box-value num"><span class="c-p1">${gs.p1_score}</span> / <span class="c-p2">${gs.p2_score}</span></div></div>
          <div class="box box-left"><div class="box-label">Maior vitória</div><div class="box-value num">${big}</div></div>
          <div class="box box-left"><div class="box-label">Tempo jogado</div><div class="box-value num">${fmtMin(gs.minutes)}</div></div>
        </div>

        <div class="grid row-2">
          <div class="card chart-card">
            <div class="chart-toolbar">
              <h3 class="h-sub">${esc(g.score_label)} por partida</h3>
              <div class="chart-legend"><span class="c-p1"><i></i>${pname(1)}</span><span class="c-p2"><i></i>${pname(2)}</span></div>
            </div>
            <div class="chart-body chart-body-sm">
              <canvas id="gameChart" aria-label="Placar por partida"></canvas>
              ${gm.length ? '' : `<div class="chart-empty"><div>Sem partidas de ${esc(g.name)}</div></div>`}
            </div>
          </div>
          <div class="card">
            <div class="section-head" style="margin-bottom:12px"><h3 class="h-sub">Comparativo</h3><span class="muted" style="font-size:11px">médias por partida</span></div>
            <div class="compare">${compare}</div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-head"><div class="tabs-line"><span class="tab-line is-active">Partidas de ${esc(g.name)}</span></div></div>
        ${gm.length ? matchListHtml(gm) : emptyState(`Nenhuma partida de ${esc(g.name)}`, 'Bora jogar a primeira?')}
      </section>`;
  }

  /* =========================================================
     Render / Router
     ========================================================= */
  function parseHash() {
    const [v, arg] = location.hash.replace(/^#\/?/, '').split('/');
    return { view: ['dashboard', 'partidas', 'jogos'].includes(v) ? v : 'dashboard', arg };
  }

  function render() {
    destroyCharts();
    const { view, arg } = parseHash();
    const changed = view !== S.view;
    S.view = view;
    if (view === 'jogos') {
      if (arg && gameOf(arg)) S.game = arg;
      if (!S.game) {
        const played = S.stats.by_game.filter((g) => g.matches).sort((a, b) => b.matches - a.matches)[0];
        S.game = played ? played.slug : S.cfg.games[0].slug;
      }
    }
    const el = $('#view');
    el.innerHTML = view === 'dashboard' ? viewDashboard() : view === 'partidas' ? viewPartidas() : viewJogos();
    if (!S.firstPaint && changed) {
      el.classList.remove('view-enter');
      void el.offsetWidth;
      el.classList.add('view-enter');
    }
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === view));
    document.querySelectorAll('[data-nav]').forEach((a) => (a.dataset.nav === view ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));

    if (view === 'dashboard') { mountMainChart(); mountDonut(); }
    if (view === 'jogos') {
      mountGameChart(S.game);
      const active = $('.gtile.is-active');
      if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    if (changed && !S.firstPaint) window.scrollTo({ top: 0 });
    S.firstPaint = false;
  }

  async function refresh() {
    const [cfg, stats, matches] = await Promise.all([api('/api/config'), api('/api/stats'), api('/api/matches')]);
    S.cfg = cfg; S.stats = stats; S.matches = matches;
    applyTheme();
    render();
  }

  /* =========================================================
     Modal / Bottom sheet
     ========================================================= */
  const modalRoot = $('#modalRoot');
  let lastFocus = null;

  function openModal(inner, { size = '', onClose } = {}) {
    closeModal(true);
    lastFocus = document.activeElement;
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    bd.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true"><div class="sheet-handle" aria-hidden="true"></div>${inner}</div>`;
    bd._onClose = onClose;
    modalRoot.appendChild(bd);
    bd.addEventListener('click', (e) => { if (e.target === bd) closeModal(); });
    void bd.offsetWidth; // garante o estado inicial antes da transição
    bd.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    enableSheetDrag(bd);
    const first = bd.querySelector('[autofocus]');
    if (first && !mqMobile.matches) first.focus({ preventScroll: true });
    return bd.querySelector('.modal');
  }

  function closeModal(instant = false) {
    const bd = modalRoot.querySelector('.modal-backdrop:not(.is-closing)');
    if (!bd) return;
    const cb = bd._onClose;
    bd._onClose = null;
    document.body.style.overflow = '';
    if (instant) { bd.remove(); cb?.(); return; }
    const modal = bd.querySelector('.modal');
    modal.style.transition = '';
    modal.style.transform = '';
    bd.classList.add('is-closing');
    bd.classList.remove('is-open');
    const done = () => bd.remove();
    modal.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 320);
    cb?.();
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }

  // Arrastar para baixo fecha o sheet (celular). Um "flick" rápido também fecha.
  function enableSheetDrag(bd) {
    const modal = bd.querySelector('.modal');
    const handleZone = modal.querySelector('.sheet-handle');
    const head = modal.querySelector('.modal-head');
    let startY = 0, dy = 0, t0 = 0, dragging = false, pid = null;

    const onDown = (e) => {
      if (!mqMobile.matches || dragging) return;
      if (e.target.closest('button, input, select, textarea, a')) return;
      dragging = true; pid = e.pointerId; startY = e.clientY; dy = 0; t0 = performance.now();
      modal.style.transition = 'none';
      e.currentTarget.setPointerCapture(pid);
    };
    const onMove = (e) => {
      if (!dragging || e.pointerId !== pid) return;
      const raw = e.clientY - startY;
      dy = raw < 0 ? raw / 6 : raw; // atrito ao puxar para cima
      modal.style.transform = `translateY(${dy}px)`;
    };
    const onUp = (e) => {
      if (!dragging || e.pointerId !== pid) return;
      dragging = false;
      const velocity = Math.abs(dy) / Math.max(1, performance.now() - t0);
      if (dy > 120 || (dy > 10 && velocity > 0.11)) {
        closeModal();
      } else {
        modal.style.transition = '';
        modal.style.transform = '';
      }
    };
    [handleZone, head].forEach((el) => {
      if (!el) return;
      el.style.touchAction = 'none';
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
    });
  }

  function modalHead(title, leading = '') {
    return `<div class="modal-head"><div style="display:flex;align-items:center;gap:12px;min-width:0">${leading}<h2 class="h-title" style="font-size:15px">${title}</h2></div>
      <button class="icon-btn" data-action="close-modal" aria-label="Fechar">${icon('i-x')}</button></div>`;
  }

  /* =========================================================
     Toast
     ========================================================= */
  function toast(msg, type = 'ok') {
    const el = document.createElement('div');
    el.className = `toast is-${type}`;
    el.innerHTML = `${icon(type === 'ok' ? 'i-check' : 'i-x')}<span>${esc(msg)}</span>`;
    $('#toastRoot').appendChild(el);
    const leave = () => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 180); };
    let timer = setTimeout(leave, 3200);
    document.addEventListener('visibilitychange', function pause() {
      if (!document.contains(el)) return document.removeEventListener('visibilitychange', pause);
      clearTimeout(timer);
      if (!document.hidden) timer = setTimeout(leave, 2000);
    });
  }

  /* =========================================================
     Admin (senha)
     ========================================================= */
  async function ensureAdmin() {
    if (!S.cfg.admin_required || storage.get()) return true;
    return askKey();
  }

  function askKey() {
    return new Promise((resolve) => {
      let ok = false;
      const modal = openModal(`
        ${modalHead('Área do admin', `<span class="gicon gicon-sm" style="--gc:var(--mint)">${icon('i-key')}</span>`)}
        <form class="modal-body" id="keyForm">
          <p class="muted" style="margin:0">Só quem tem a senha (ADMIN_KEY) pode registrar ou apagar partidas. Ela fica salva neste aparelho.</p>
          <div><label class="label" for="keyInput">Senha de admin</label>
          <input class="input" id="keyInput" type="password" autocomplete="current-password" required autofocus></div>
          <div class="c-red" id="keyErr" style="min-height:1em;font-size:12px"></div>
          <button class="btn btn-mint btn-block" type="submit">Entrar</button>
        </form>`, { size: 'modal-sm', onClose: () => resolve(ok) });
      $('#keyForm', modal).addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.submitter;
        btn.disabled = true;
        storage.set($('#keyInput', modal).value.trim());
        try {
          await api('/api/auth/check', { method: 'POST', admin: true });
          ok = true;
          closeModal(true);
        } catch (err) {
          storage.set('');
          $('#keyErr', modal).textContent = err.status === 401 ? 'Senha incorreta.' : err.message;
          btn.disabled = false;
        }
      });
    });
  }

  function handleAdminError(err) {
    if (err.status === 401) {
      storage.set('');
      toast('Senha de admin inválida. Tente de novo.', 'err');
    } else {
      toast(err.message, 'err');
    }
  }

  /* =========================================================
     Registrar partida
     ========================================================= */
  function nowLocalInput() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  async function openRegister(preset) {
    if (!(await ensureAdmin())) return;
    const R = { game: preset || (S.view === 'jogos' ? S.game : S.cfg.games[0].slug), s1: 0, s2: 0, winner: 'auto' };

    const modal = openModal(`
      ${modalHead('Registrar partida', `<span class="gicon gicon-sm" style="--gc:var(--mint)">${icon('i-plus')}</span>`)}
      <form class="modal-body" id="regForm" novalidate>
        <div>
          <span class="label">Jogo</span>
          <div class="game-pick" role="radiogroup">
            ${S.cfg.games.map((g) => `<button type="button" class="game-opt" role="radio" data-game="${g.slug}">${gicon(g.slug, 'gicon-sm')}<span>${esc(g.name)}</span></button>`).join('')}
          </div>
        </div>
        <div>
          <span class="label" id="scoreLabel">Placar</span>
          <div class="score-input">
            ${[1, 2].map((id) => `
              <div class="score-side">
                <div class="score-side-name">${avatar(id, 'avatar-sm')}<span>${pname(id)}</span></div>
                <div class="stepper p${id}">
                  <button type="button" data-step="${id}" data-d="-1" aria-label="Diminuir">−</button>
                  <input type="number" inputmode="numeric" min="0" max="999" value="0" id="s${id}" aria-label="Placar de ${pname(id)}">
                  <button type="button" data-step="${id}" data-d="1" aria-label="Aumentar">+</button>
                </div>
              </div>${id === 1 ? '<div class="score-x">X</div>' : ''}`).join('')}
          </div>
        </div>
        <div>
          <span class="label">Vencedor</span>
          <div class="winner-seg" role="radiogroup">
            <button type="button" data-win="auto" id="winAuto">Auto</button>
            <button type="button" data-win="1">${pname(1)}</button>
            <button type="button" data-win="0">Empate</button>
            <button type="button" data-win="2">${pname(2)}</button>
          </div>
        </div>
        <div id="regExtras"></div>
        <div class="form-row">
          <div><label class="label" for="rDur">Duração (min)</label><input class="input" id="rDur" type="number" inputmode="numeric" min="0" max="1440" placeholder="15"></div>
          <div><label class="label" for="rDate">Data e hora</label><input class="input" id="rDate" type="datetime-local" value="${nowLocalInput()}"></div>
        </div>
        <div><label class="label" for="rNotes">Observações</label><textarea class="input" id="rNotes" maxlength="500" placeholder="Golaço de bicicleta no último minuto..."></textarea></div>
      </form>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-action="close-modal">Cancelar</button>
        <button class="btn btn-mint" id="regSave">${icon('i-check', 'ico-sm')}Salvar partida</button>
      </div>`);

    const form = $('#regForm', modal);

    const autoWinner = () => (R.s1 > R.s2 ? 1 : R.s2 > R.s1 ? 2 : 0);
    const paintWinner = () => {
      modal.querySelectorAll('[data-win]').forEach((b) => b.classList.toggle('is-active', b.dataset.win === String(R.winner)));
      const a = autoWinner();
      $('#winAuto', modal).textContent = `Auto · ${a === 0 ? 'Empate' : P(a).nickname || initials(P(a).name)}`;
    };
    const paintGame = () => {
      const g = gameOf(R.game);
      modal.querySelectorAll('[data-game]').forEach((b) => {
        const on = b.dataset.game === R.game;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-checked', on);
      });
      $('#scoreLabel', modal).textContent = `Placar · ${g.score_label}`;
      const stats = g.stats.length ? `
        <div style="margin-top:16px">
          <span class="label">Estatísticas da partida <span class="dim">(opcional)</span></span>
          <div class="stat-grid">
            <span></span><span class="hdr c-p1">${pname(1)}</span><span class="hdr c-p2">${pname(2)}</span>
            ${g.stats.map((s) => `
              <span class="lbl">${esc(s.label)}${s.unit ? ` <span class="dim">(${esc(s.unit)})</span>` : ''}</span>
              <input class="input" type="number" inputmode="decimal" step="any" min="0" data-stat="p1.${s.key}" aria-label="${esc(s.label)} ${pname(1)}">
              <input class="input" type="number" inputmode="decimal" step="any" min="0" data-stat="p2.${s.key}" aria-label="${esc(s.label)} ${pname(2)}">`).join('')}
          </div>
        </div>` : '';
      $('#regExtras', modal).innerHTML = `
        <label class="label" for="rMode">${esc(g.mode_label)} <span class="dim">(opcional)</span></label>
        <input class="input" id="rMode" maxlength="80" placeholder="${esc(g.mode_placeholder)}">
        ${stats}`;
    };

    const setScore = (id, v) => {
      const n = Math.max(0, Math.min(999, Number.isFinite(v) ? Math.round(v) : 0));
      R['s' + id] = n;
      $('#s' + id, modal).value = n;
      paintWinner();
    };

    modal.addEventListener('click', (e) => {
      const g = e.target.closest('[data-game]');
      if (g) { R.game = g.dataset.game; paintGame(); return; }
      const st = e.target.closest('[data-step]');
      if (st) { const id = +st.dataset.step; setScore(id, R['s' + id] + +st.dataset.d); return; }
      const w = e.target.closest('[data-win]');
      if (w) { R.winner = w.dataset.win === 'auto' ? 'auto' : +w.dataset.win; paintWinner(); }
    });
    [1, 2].forEach((id) => {
      const inp = $('#s' + id, modal);
      inp.addEventListener('input', () => { R['s' + id] = Math.max(0, parseInt(inp.value, 10) || 0); paintWinner(); });
      inp.addEventListener('blur', () => setScore(id, R['s' + id]));
      inp.addEventListener('focus', () => inp.select());
    });

    const save = async () => {
      const btn = $('#regSave', modal);
      const details = { mode: $('#rMode', modal).value, p1: {}, p2: {} };
      modal.querySelectorAll('[data-stat]').forEach((inp) => {
        if (inp.value === '') return;
        const [side, key] = inp.dataset.stat.split('.');
        details[side][key] = Number(inp.value);
      });
      const dateVal = $('#rDate', modal).value;
      const dur = $('#rDur', modal).value;
      const body = {
        game: R.game,
        player1_score: R.s1,
        player2_score: R.s2,
        winner: R.winner === 'auto' ? null : R.winner,
        duration_minutes: dur === '' ? null : parseInt(dur, 10),
        notes: $('#rNotes', modal).value || null,
        details,
        played_at: dateVal ? new Date(dateVal).toISOString() : null,
      };
      btn.disabled = true;
      try {
        await api('/api/matches', { method: 'POST', body, admin: true });
        closeModal();
        const w = body.winner ?? autoWinner();
        toast(w ? `Partida salva · vitória de ${P(w).name}` : 'Partida salva · empate');
        await refresh();
      } catch (err) {
        btn.disabled = false;
        handleAdminError(err);
        if (err.status === 401) closeModal();
      }
    };
    $('#regSave', modal).addEventListener('click', save);
    form.addEventListener('submit', (e) => { e.preventDefault(); save(); });

    paintGame();
    paintWinner();
  }

  /* =========================================================
     Detalhe da partida
     ========================================================= */
  function openMatch(id) {
    const m = S.matches.find((x) => x.id === id);
    if (!m) return;
    const g = gameOf(m.game);
    const d = m.details || {};
    const statRows = g.stats
      .filter((s) => d.p1?.[s.key] != null || d.p2?.[s.key] != null)
      .map((s) => cmpRow(s.label, d.p1?.[s.key], d.p2?.[s.key], { unit: s.unit === '%' ? '%' : '', lower: !!s.lower }))
      .join('');
    const side = (pid, val) => `<div class="side">${avatar(pid, 'avatar-md')}<div class="val num c-p${pid}">${val}</div><div class="name">${pname(pid)}</div></div>`;

    const modal = openModal(`
      ${modalHead(esc(g.name), gicon(m.game, 'gicon-sm'))}
      <div class="modal-body">
        <div class="detail-score">
          ${side(1, m.player1_score)}
          <div style="display:flex;flex-direction:column;align-items:center;gap:10px">${resultTag(m)}<span class="dim display">${esc(g.score_label)}</span></div>
          ${side(2, m.player2_score)}
        </div>
        <div class="kv">
          <div class="box box-left"><div class="box-label">${esc(g.mode_label)}</div><div class="box-value">${d.mode ? esc(d.mode) : '—'}</div></div>
          <div class="box box-left"><div class="box-label">Duração</div><div class="box-value num">${fmtMin(m.duration_minutes)}</div></div>
          <div class="box box-left"><div class="box-label">Data</div><div class="box-value num">${fmtDateTime(m.played_at)}</div></div>
        </div>
        ${statRows ? `<div><span class="label">Estatísticas</span><div class="compare">${statRows}</div></div>` : ''}
        ${m.notes ? `<div><span class="label">Observações</span><div class="note">${esc(m.notes)}</div></div>` : ''}
      </div>
      <div class="modal-foot">
        <button class="btn btn-danger" id="delMatch">${icon('i-trash', 'ico-sm')}Apagar</button>
        <button class="btn btn-ghost" data-action="close-modal">Fechar</button>
      </div>`);

    const del = $('#delMatch', modal);
    let armed = false;
    del.addEventListener('click', async () => {
      if (!armed) {
        armed = true;
        del.innerHTML = `${icon('i-trash', 'ico-sm')}Toque de novo para apagar`;
        setTimeout(() => {
          if (!document.contains(del)) return;
          armed = false;
          del.innerHTML = `${icon('i-trash', 'ico-sm')}Apagar`;
        }, 3000);
        return;
      }
      closeModal(true);
      if (!(await ensureAdmin())) return;
      try {
        await api(`/api/matches/${m.id}`, { method: 'DELETE', admin: true });
        toast('Partida apagada');
        await refresh();
      } catch (err) { handleAdminError(err); }
    });
  }

  /* =========================================================
     Jogadores
     ========================================================= */
  async function openSettings() {
    const draft = S.cfg.players.map((p) => ({ id: p.id, name: p.name, nickname: p.nickname || '', color: p.color }));
    const block = (p) => `
      <div class="card card-flat" style="display:grid;gap:14px" data-pblock="${p.id}">
        <div class="pcard-head"><span class="avatar avatar-md" data-preview="${p.id}" style="--pc:${p.color}">${esc(initials(p.name))}</span><span class="h-sub">Jogador ${p.id}</span></div>
        <div class="form-row">
          <div><label class="label" for="pn${p.id}">Nome</label><input class="input" id="pn${p.id}" maxlength="24" value="${esc(p.name)}" data-field="name"></div>
          <div><label class="label" for="pk${p.id}">Apelido</label><input class="input" id="pk${p.id}" maxlength="12" value="${esc(p.nickname)}" data-field="nickname"></div>
        </div>
        <div><span class="label">Cor</span><div class="swatches">${SWATCHES.map((c) => `<button type="button" class="swatch ${c === p.color ? 'is-active' : ''}" style="--c:${c}" data-color="${c}" aria-label="Cor ${c}"></button>`).join('')}</div></div>
      </div>`;

    const modal = openModal(`
      ${modalHead('Jogadores', `<span class="gicon gicon-sm" style="--gc:var(--mint)">${icon('i-sliders')}</span>`)}
      <div class="modal-body">${draft.map(block).join('')}
        ${storage.get() ? `<button class="btn btn-ghost" data-action="logout">${icon('i-key', 'ico-sm')}Esquecer senha neste aparelho</button>` : ''}
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-action="close-modal">Cancelar</button>
        <button class="btn btn-mint" id="savePlayers">${icon('i-check', 'ico-sm')}Salvar</button>
      </div>`);

    modal.addEventListener('input', (e) => {
      const blk = e.target.closest('[data-pblock]');
      if (!blk || !e.target.dataset.field) return;
      const p = draft.find((x) => x.id === +blk.dataset.pblock);
      p[e.target.dataset.field] = e.target.value;
      $(`[data-preview="${p.id}"]`, modal).textContent = initials(p.name);
    });
    modal.addEventListener('click', (e) => {
      const sw = e.target.closest('[data-color]');
      if (sw) {
        const blk = sw.closest('[data-pblock]');
        const p = draft.find((x) => x.id === +blk.dataset.pblock);
        p.color = sw.dataset.color;
        blk.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('is-active', s === sw));
        $(`[data-preview="${p.id}"]`, modal).style.setProperty('--pc', p.color);
      }
      if (e.target.closest('[data-action="logout"]')) {
        storage.set('');
        e.target.closest('[data-action="logout"]').remove();
        toast('Senha esquecida neste aparelho');
      }
    });

    $('#savePlayers', modal).addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      if (draft.some((p) => !p.name.trim())) return toast('Os dois jogadores precisam de nome.', 'err');
      closeModal(true);
      if (!(await ensureAdmin())) return;
      btn.disabled = true;
      try {
        for (const p of draft) {
          await api(`/api/players/${p.id}`, { method: 'PUT', admin: true, body: { name: p.name.trim(), nickname: p.nickname.trim() || null, color: p.color } });
        }
        toast('Jogadores atualizados');
        await refresh();
      } catch (err) { handleAdminError(err); }
    });
  }

  /* =========================================================
     Eventos globais
     ========================================================= */
  document.addEventListener('click', (e) => {
    const t = e.target;
    const action = t.closest('[data-action]');
    if (action) {
      const a = action.dataset.action;
      if (a === 'open-register') { e.preventDefault(); openRegister(); return; }
      if (a === 'open-settings') { e.preventDefault(); openSettings(); return; }
      if (a === 'close-modal') { e.preventDefault(); closeModal(); return; }
    }
    if (t.closest('.modal')) return;
    const match = t.closest('[data-match]');
    if (match) { openMatch(+match.dataset.match); return; }
    const chart = t.closest('[data-chart]');
    if (chart) {
      S.chartTab = chart.dataset.chart;
      document.querySelectorAll('[data-chart]').forEach((b) => {
        const on = b.dataset.chart === S.chartTab;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', on);
      });
      mountMainChart();
      return;
    }
    const row = t.closest('[data-href]');
    if (row) location.hash = row.dataset.href;
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'fQ') { S.filters.q = e.target.value; refreshMatchList(); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'fGame') { S.filters.game = e.target.value; refreshMatchList(); }
    if (e.target.id === 'fResult') { S.filters.result = e.target.value; refreshMatchList(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
  window.addEventListener('hashchange', render);

  // Atualiza o contador regressivo sem re-renderizar a página
  setInterval(() => {
    const el = $('[data-countdown]');
    if (!el) return;
    const c = countdownParts();
    if (!c || c.done) return;
    const b = el.querySelectorAll('b');
    b[0].textContent = c.d;
    b[1].textContent = String(c.h).padStart(2, '0');
    b[2].textContent = String(c.m).padStart(2, '0');
  }, 30000);

  /* =========================================================
     Boot
     ========================================================= */
  if (window.Chart) {
    window.Chart.defaults.font.family = '"JetBrains Mono", ui-monospace, monospace';
    window.Chart.defaults.color = '#8b8b8b';
  }

  (async function boot() {
    try {
      await loadAll();
      render();
    } catch (err) {
      $('#view').innerHTML = `<div class="empty" style="margin-top:40px">${icon('i-x', 'ico-lg')}
        <div class="h-sub">Não foi possível carregar</div><div>${esc(err.message)}</div>
        <button class="btn btn-outline" onclick="location.reload()">Tentar de novo</button></div>`;
    }
  })();
})();
