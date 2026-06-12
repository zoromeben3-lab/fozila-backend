// ═══════════════════════════════════════════════════════
//  FOZILA — Client API partagé entre toutes les pages
//  Toutes les données viennent du backend Node.js
// ═══════════════════════════════════════════════════════

const FOZILA = {
API: window.location.hostname === 'localhost' 
  ? '/api' 
  : 'https://fozila-backend.onrender.com/api',
  _cache: { albums: null, singles: null, announcements: null },

  // ── APPEL API GÉNÉRIQUE ──
  async api(method, endpoint, body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    const token = this.getToken();
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body)  opts.body = JSON.stringify(body);
    const res  = await fetch(this.API + endpoint, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    return data;
  },

  // ── SESSION ──
  getToken() { return localStorage.getItem('fozila_token') || null; },
  getUser()  { try { return JSON.parse(localStorage.getItem('fozila_user')); } catch { return null; } },
  setSession(token, user) {
    localStorage.setItem('fozila_token', token);
    localStorage.setItem('fozila_user', JSON.stringify(user));
  },
  logout() {
    localStorage.removeItem('fozila_token');
    localStorage.removeItem('fozila_user');
    window.location.href = 'index.html';
  },

  // ── ALBUMS ──
  async getAlbums(params = {}) {
    const qs   = new URLSearchParams(params).toString();
    const data = await this.api('GET', `/albums${qs ? '?' + qs : ''}`);
    this._cache.albums = data;
    return data;
  },
  async getAlbum(id) { return await this.api('GET', `/albums/${id}`); },

  // ── SINGLES ──
  async getSingles(params = {}) {
    const qs   = new URLSearchParams(params).toString();
    const data = await this.api('GET', `/singles${qs ? '?' + qs : ''}`);
    this._cache.singles = data;
    return data;
  },
  async getSingle(id) { return await this.api('GET', `/singles/${id}`); },

  // ── ACHATS ──
  async purchase(item_id, item_type, pay_method, pay_ref) {
    return await this.api('POST', '/purchases', { item_id, item_type, pay_method, pay_ref });
  },
  async getMyPurchases() { return await this.api('GET', '/purchases/my'); },
  async hasPurchased(item_id, item_type) {
    try { return (await this.api('GET', `/purchases/has/${item_type}/${item_id}`)).owned; }
    catch { return false; }
  },
  async getDownloadToken(item_id, item_type) {
    try { return (await this.api('GET', `/purchases/has/${item_type}/${item_id}`)).download_token; }
    catch { return null; }
  },

  // ── TÉLÉCHARGEMENT ──
  download(token) {
    if (!token) { this.toast('Token manquant', 'error'); return; }
    window.location.href = `/api/download/${token}`;
  },

  // ── ANNONCES ──
  async getAnnouncements() {
    if (this._cache.announcements) return this._cache.announcements;
    try {
      const data = await this.api('GET', '/announcements');
      this._cache.announcements = data;
      return data;
    } catch { return []; }
  },

  // ── RECHERCHE ──
  async searchItems(query) {
    if (!query.trim()) return { albums: [], singles: [] };
    const [albums, singles] = await Promise.all([
      this.api('GET', `/albums?q=${encodeURIComponent(query)}`).catch(() => []),
      this.api('GET', `/singles?q=${encodeURIComponent(query)}`).catch(() => []),
    ]);
    return { albums, singles };
  },

  // ── UTILS ──
  fmt(n) { return Number(n).toLocaleString('fr-FR') + ' FCFA'; },

  // Convertir un chemin relatif en URL absolue vers le backend
  mediaUrl(path) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const base = window.location.hostname === 'localhost'
      ? ''
      : 'https://fozila-backend.onrender.com';
    return base + path;
  },
  timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return "À l'instant";
    if (m < 60) return `Il y a ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Il y a ${h}h`;
    return new Date(iso).toLocaleDateString('fr-FR');
  },

  // ── TOAST ──
  toast(msg, type = 'success') {
    let t = document.getElementById('fozila-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'fozila-toast';
      t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:#0f0f0f;border:1px solid #333;color:#f0f0f0;padding:13px 20px;border-radius:10px;font-size:14px;font-family:DM Sans,sans-serif;transform:translateY(80px);opacity:0;transition:all 0.3s;pointer-events:none;box-shadow:0 8px 32px rgba(0,0,0,0.5);max-width:320px;';
      document.body.appendChild(t);
    }
    const colors = { success: '#22c55e', error: '#ef4444', info: '#A78BFA' };
    t.style.borderColor = colors[type] || '#333';
    t.style.color       = colors[type] || '#f0f0f0';
    t.textContent       = msg;
    t.style.transform   = 'translateY(0)';
    t.style.opacity     = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.transform = 'translateY(80px)'; t.style.opacity = '0'; }, 3500);
  },

  // ── NAV ──
  injectNav(activePage) {
    const user = this.getUser();
    const nav  = document.getElementById('main-nav');
    if (!nav) return;
    nav.innerHTML = `
      <a href="index.html" class="logo"><em>Fozila</em></a>
      <ul class="nav-links">
        <li><a href="index.html"   ${activePage==='home'    ?'class="active"':''}>Accueil</a></li>
        <li><a href="albums.html"  ${activePage==='albums'  ?'class="active"':''}>Albums</a></li>
        <li><a href="singles.html" ${activePage==='singles' ?'class="active"':''}>Singles</a></li>
        <li><a href="index.html#comment-ca-marche">Comment ça marche</a></li>
      </ul>
      <div class="nav-center">
        <div class="nav-search-wrap">
          <span class="search-icon">🔍</span>
          <input type="text" class="nav-search-input" placeholder="Rechercher albums, singles…"
            oninput="FOZILA._liveSearch(this.value)"
            onfocus="document.getElementById('search-dropdown').style.display='block'"
            onblur="setTimeout(()=>document.getElementById('search-dropdown').style.display='none',200)">
          <div id="search-dropdown" class="search-dropdown" style="display:none;"></div>
        </div>
      </div>
      <div class="nav-actions">
        ${user ? `
          <a href="dashboard.html" class="btn-ghost ${activePage==='dashboard'?'active':''}">👤 Mon espace</a>
          ${user.isAdmin ? `<a href="admin.html" class="btn-primary">⚙️ Admin</a>` : ''}
          <button class="btn-ghost" onclick="FOZILA.logout()">Sortir</button>
        ` : `
          <a href="auth.html" class="btn-ghost">Connexion</a>
          <a href="auth.html?mode=register" class="btn-primary">S'inscrire</a>
        `}
      </div>
      <button class="hamburger" id="hamburger-btn" onclick="FOZILA._toggleMenu()">
        <span></span><span></span><span></span>
      </button>
      <div class="mobile-menu" id="mobile-menu">
        <a href="index.html"   class="mobile-link">Accueil</a>
        <a href="albums.html"  class="mobile-link">Albums</a>
        <a href="singles.html" class="mobile-link">Singles</a>
        <a href="index.html#comment-ca-marche" class="mobile-link">Comment ça marche</a>
        <hr style="border-color:rgba(255,255,255,0.07);margin:8px 0;">
        ${user ? `
          <a href="dashboard.html" class="mobile-link">👤 Mon espace</a>
          ${user.isAdmin ? `<a href="admin.html" class="mobile-link" style="color:#A78BFA;">⚙️ Admin</a>` : ''}
          <button class="mobile-link" onclick="FOZILA.logout()" style="background:none;border:none;color:#ef4444;text-align:left;font-family:inherit;font-size:14px;cursor:pointer;padding:10px 0;">Déconnexion</button>
        ` : `
          <a href="auth.html" class="mobile-link">Connexion</a>
          <a href="auth.html?mode=register" class="mobile-link" style="color:#A78BFA;">S'inscrire</a>
        `}
      </div>
    `;
  },

  _toggleMenu() {
    document.getElementById('mobile-menu').classList.toggle('open');
    document.getElementById('hamburger-btn').classList.toggle('open');
  },

  async _liveSearch(q) {
    const dd = document.getElementById('search-dropdown');
    if (!q.trim()) { dd.innerHTML = ''; return; }
    try {
      const r   = await this.searchItems(q);
      const all = [
        ...r.albums.map(a  => ({ ...a, _type:'album',  _url:`album-detail.html?id=${a.id}` })),
        ...r.singles.map(s => ({ ...s, _type:'single', _url:`singles.html?id=${s.id}` })),
      ].slice(0, 6);
      if (!all.length) { dd.innerHTML = '<div class="sd-empty">Aucun résultat</div>'; return; }
      dd.innerHTML = all.map(item => `
        <a href="${item._url}" class="sd-item">
          <div class="sd-art" style="background:${item.grad}">${item.emoji}</div>
          <div class="sd-info">
            <div class="sd-title">${item.title}</div>
            <div class="sd-meta">${item._type==='album'?'💿 Album':'🎵 Single'} · ${item.genre}</div>
          </div>
          <div class="sd-price">${FOZILA.fmt(item.price)}</div>
        </a>
      `).join('');
    } catch { dd.innerHTML = '<div class="sd-empty">Erreur de recherche</div>'; }
  },

  // ── ANNOUNCE BAR ──
  async injectAnnounce() {
    const bar = document.getElementById('announce-bar');
    if (!bar) return;
    const list = await this.getAnnouncements();
    if (!list.length) { bar.style.display = 'none'; return; }
    const doubled = [...list, ...list];
    bar.innerHTML = `
      <div class="announce-track">
        ${doubled.map(a => `<span class="announce-item"><span class="dot"></span>${a}</span>`).join('')}
      </div>
      <button class="announce-close" onclick="this.parentElement.style.display='none'">✕</button>
    `;
  },

  // ── VISITEURS (local) ──
  getVisitors() {
    let v = parseInt(localStorage.getItem('fozila_visitors') || '0');
    if (!v) { v = 1247; localStorage.setItem('fozila_visitors', v); }
    return v;
  },
  trackVisit() {
    const v = this.getVisitors() + 1;
    localStorage.setItem('fozila_visitors', v);
    return v;
  },
};

FOZILA.trackVisit();
