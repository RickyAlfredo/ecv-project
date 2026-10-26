let currentUsers = {};
let activeUser = 'user1';

// ===== THEME LOGIC =====
const themeToggle = document.getElementById('theme-toggle');
const currentTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', currentTheme);
themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';

themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
});

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    if (!res.ok) throw new Error('Server returned ' + res.status);
    currentUsers = await res.json();
    
    const firstId = Object.keys(currentUsers)[0];
    if (firstId) activeUser = firstId;
    
    renderTabButtons();
    renderCard(activeUser);
  } catch (e) {
    document.getElementById('card-container').innerHTML =
      `<p class="error-msg">Gagal memuat data: ${e.message}. Pastikan server berjalan (<code>npm start</code>).</p>`;
  }
}

function renderTabButtons() {
  const container = document.getElementById('main-tabs');
  container.innerHTML = '';
  Object.entries(currentUsers).forEach(([id, u]) => {
    const btn = document.createElement('button');
    btn.className = 'tab' + (id === activeUser ? ' active' : '');
    btn.textContent = u.name || id;
    btn.dataset.user = id;
    btn.addEventListener('click', () => {
      activeUser = id;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      renderCard(id);
    });
    container.appendChild(btn);
  });
}

function renderCard(userId) {
  const u = currentUsers[userId];
  if (!u) return;
  const container = document.getElementById('card-container');
  const c = u.contact || {};

  const hue = Math.floor(Math.random() * 360);
  const accentColor = `hsl(${hue}, 70%, 85%)`;
  const accentBorder = `hsl(${hue}, 70%, 65%)`;

  // Avatar HTML logic
  let avatarHtml = '';
  if (u.avatar) {
    avatarHtml = `<img src="/download/${userId}/${encodeURIComponent(u.avatar)}" alt="Avatar" class="avatar-img" onerror="this.style.display='none'">`;
  } else {
    avatarHtml = `<div class="avatar-circle" style="background: linear-gradient(135deg, ${accentColor} 0%, ${accentBorder} 100%);"></div>`;
  }

  const profileHtml = `
    <div class="profile-sidebar card" style="border-top: 4px solid ${accentBorder};">
      <div class="profile-avatar">
        ${avatarHtml}
      </div>
      <h2 class="profile-name">${escapeHtml(u.name)}</h2>
      <p class="profile-role">${escapeHtml(u.role)}</p>
      ${u.nim ? `<p class="profile-nim">NIM: ${escapeHtml(u.nim)}</p>` : ''}
      
      <div class="profile-section">
        <h3>Kontak</h3>
        ${c.email    ? `<a href="mailto:${escapeHtml(c.email)}" class="contact-item">✉ ${escapeHtml(c.email)}</a>` : ''}
        ${c.phone    ? `<span class="contact-item">📞 ${escapeHtml(c.phone)}</span>` : ''}
        ${c.location ? `<span class="contact-item">📍 ${escapeHtml(c.location)}</span>` : ''}
        ${c.linkedin ? `<a href="${escapeHtml(c.linkedin)}" target="_blank" rel="noopener" class="contact-item">💼 LinkedIn</a>` : ''}
        ${c.github   ? `<a href="${escapeHtml(c.github)}" target="_blank" rel="noopener" class="contact-item">🐙 GitHub</a>` : ''}
      </div>
    </div>
  `;

  const mainContentHtml = `
    <div class="main-content">
      ${u.profile ? `
        <div class="card info-card" style="border-left: 4px solid ${accentColor};">
          <h3>Profil</h3>
          <p class="profile-text">${escapeHtml(u.profile).replace(/\n/g,'<br>')}</p>
        </div>
      ` : ''}

      ${u.education?.length ? `
        <div class="card info-card" style="border-left: 4px solid ${accentColor};">
          <h3>Pendidikan</h3>
          <div class="timeline">
            ${u.education.map(e => `
              <div class="timeline-item">
                <div class="timeline-title">${escapeHtml(e.degree || '')}</div>
                <div class="timeline-sub">${escapeHtml(e.institution || '')}${e.year ? ` · ${escapeHtml(e.year)}` : ''}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${u.experience?.length ? `
        <div class="card info-card" style="border-left: 4px solid ${accentColor};">
          <h3>Pengalaman</h3>
          <div class="timeline">
            ${u.experience.map(e => `
              <div class="timeline-item">
                <div class="timeline-title">${escapeHtml(e.title || '')}</div>
                <div class="timeline-sub">${escapeHtml(e.company || '')}${e.period ? ` · ${escapeHtml(e.period)}` : ''}</div>
                ${e.description ? `<div class="timeline-desc">${escapeHtml(e.description)}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${u.abilities?.length ? `
        <div class="card info-card" style="border-left: 4px solid ${accentColor};">
          <h3>Keahlian</h3>
          <div class="abilities">
            ${u.abilities.map(a => `<span class="ability-tag" style="background: ${accentColor}; color: #1e293b;">${escapeHtml(a)}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      ${u.files?.length ? `
        <div class="card info-card" style="border-left: 4px solid ${accentColor};">
          <h3>Berkas</h3>
          <div class="download-group">
            ${u.files.map(f => {
              const url = `/download/${userId}/${encodeURIComponent(f.name)}`;
              const isPdf = f.name.toLowerCase().endsWith('.pdf');
              return `<a class="btn btn-primary" href="${url}" download="${escapeHtml(f.name)}" style="background: ${accentBorder};">${isPdf ? '📄' : '🖼️'} ${escapeHtml(f.name)}</a>`;
            }).join('')}
          </div>
        </div>
      ` : ''}

      ${u.projectLink ? `
        <div class="card info-card" style="border-left: 4px solid ${accentColor};">
          <h3>Proyek Utama</h3>
          <a class="project-link" href="${escapeHtml(u.projectLink)}" target="_blank" rel="noopener">${escapeHtml(u.projectLink)}</a>
        </div>
      ` : ''}

      ${u.projects?.length ? `
        <div class="card info-card" style="border-left: 4px solid ${accentColor};">
          <h3>Proyek Lainnya</h3>
          <ul class="project-list">
            ${u.projects.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `;

  container.innerHTML = `
    <div class="dashboard-layout">
      ${profileHtml}
      ${mainContentHtml}
    </div>
  `;
}

// Secret trigger (capstone12)
(function () {
  const SECRET = atob("Y2Fwc3RvbmUxMg=="); 
  const LEN = SECRET.length;
  let pressed = [];
  document.addEventListener('keydown', e => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
    if (e.key.length === 1) {
      pressed.push(e.key.toLowerCase());
      if (pressed.length > LEN) pressed.shift();
      if (pressed.join('') === SECRET) window.location.href = '/secret.html';
    }
  });
})();

loadUsers();