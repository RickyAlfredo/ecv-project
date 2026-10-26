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

let session = { loggedIn: false, role: null, userId: null };
let editingUserId = null;
let currentUser = null;
let currentTab = 'data';
let loginMode = 'user';

const $ = id => document.getElementById(id);

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}
const escapeAttr = escapeHtml;

async function init() {
  try {
    const res = await fetch('/api/session');
    session = await res.json();
  } catch (e) { console.error(e); }

  if (session.loggedIn) {
    editingUserId = session.role === 'master' ? 'user1' : session.userId;
    showAdmin();
  } else {
    showLogin();
  }
}

function showLogin() {
  $('login-view').style.display = '';
  $('admin-view').style.display = 'none';
  $('login-password').value = '';
  $('login-error').textContent = '';
}

async function showAdmin() {
  $('login-view').style.display = 'none';
  $('admin-view').style.display = '';
  $('header-sub').textContent = session.role === 'master'
    ? 'Masuk sebagai Master' : `Masuk sebagai ${editingUserId}`;

  const isMaster = session.role === 'master';
  $('master-user-selector').style.display = isMaster ? '' : 'none';
  if (isMaster) $('master-user-select').value = editingUserId;

  $('admin-identity').innerHTML = isMaster
    ? '<strong>👑 Admin Master</strong>'
    : `<strong>👤 ${escapeHtml(editingUserId)}</strong>`;

  await renderTab();
}

document.querySelectorAll('.login-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    loginMode = btn.dataset.mode;
    document.querySelectorAll('.login-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('user-select-group').style.display = loginMode === 'user' ? '' : 'none';
  });
});

$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  $('login-error').textContent = '';
  const password = $('login-password').value;

  const url = loginMode === 'user' ? '/api/login/user' : '/api/login/master';
  const body = loginMode === 'user'
    ? { userId: $('login-user-id').value, password }
    : { password };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) { $('login-error').textContent = data.error || 'Login gagal'; return; }
    session = { loggedIn: true, role: data.role, userId: data.userId || null };
    editingUserId = data.role === 'master' ? 'user1' : data.userId;
    showAdmin();
  } catch (err) {
    $('login-error').textContent = 'Kesalahan jaringan';
  }
});

$('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  session = { loggedIn: false };
  showLogin();
});

$('master-user-select').addEventListener('change', e => {
  editingUserId = e.target.value;
  renderTab();
});

document.querySelectorAll('.admin-tabs .tab').forEach(btn => {
  btn.addEventListener('click', () => {
    currentTab = btn.dataset.tab;
    document.querySelectorAll('.admin-tabs .tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderTab();
  });
});

async function loadUser() {
  const res = await fetch(`/api/users/${editingUserId}`);
  if (!res.ok) throw new Error('Gagal memuat');
  currentUser = await res.json();
}

async function renderTab() {
  $('admin-content').innerHTML = '<p class="hint">Memuat...</p>';
  try { await loadUser(); }
  catch (e) {
    $('admin-content').innerHTML = '<p class="error-msg">Gagal memuat data pengguna.</p>';
    return;
  }
  if (currentTab === 'data') renderDataForm();
  else if (currentTab === 'files') renderFilesTab();
  else if (currentTab === 'password') renderPasswordTab();
}

function renderDataForm() {
  const u = currentUser, c = u.contact || {};
  
  let avatarPreview = '';
  if (u.avatar) {
    avatarPreview = `<img src="/download/${editingUserId}/${encodeURIComponent(u.avatar)}" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:3px solid var(--border);">`;
  } else {
    avatarPreview = `<div style="width:100px; height:100px; border-radius:50%; background:#cbd5e1; border:3px solid var(--border);"></div>`;
  }

  $('admin-content').innerHTML = `
    <div class="card"><div class="card-body">
      <form id="data-form">
        
        <h4 class="form-section-title">Foto Profil</h4>
        <div class="upload-area" style="margin-bottom:20px; align-items:center;">
          <div style="margin-right: 16px;">
            ${avatarPreview}
          </div>
          <div style="flex:1; min-width:200px;">
            <input type="file" id="avatar-file-input" accept=".png,.jpeg,.jpg">
            <div style="display:flex; gap:10px; margin-top:10px;">
              <button type="button" class="btn btn-primary btn-sm" id="upload-avatar-btn">Unggah Foto</button>
              <button type="button" class="btn btn-danger btn-sm" id="remove-avatar">Hapus Foto</button>
            </div>
            <div id="avatar-status" class="hint" style="margin-top:8px;"></div>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-group"><label>NIM</label>
            <input name="nim" value="${escapeAttr(u.nim)}"></div>
          <div class="form-group"><label>Nama Lengkap</label>
            <input name="name" value="${escapeAttr(u.name)}"></div>
          <div class="form-group"><label>Posisi / Peran</label>
            <input name="role" value="${escapeAttr(u.role)}"></div>
        </div>

        <div class="form-group"><label>Profil Singkat</label>
          <textarea name="profile" rows="4">${escapeHtml(u.profile)}</textarea></div>

        <h4 class="form-section-title">Kontak</h4>
        <div class="form-grid">
          <div class="form-group"><label>Email</label>
            <input name="contact.email" value="${escapeAttr(c.email)}"></div>
          <div class="form-group"><label>Telepon</label>
            <input name="contact.phone" value="${escapeAttr(c.phone)}"></div>
          <div class="form-group"><label>Lokasi</label>
            <input name="contact.location" value="${escapeAttr(c.location)}"></div>
          <div class="form-group"><label>LinkedIn</label>
            <input name="contact.linkedin" value="${escapeAttr(c.linkedin)}"></div>
          <div class="form-group"><label>GitHub</label>
            <input name="contact.github" value="${escapeAttr(c.github)}"></div>
        </div>

        <h4 class="form-section-title">Pendidikan</h4>
        <div id="education-list"></div>
        <button type="button" class="btn-add" id="add-education">+ Tambah Pendidikan</button>

        <h4 class="form-section-title">Pengalaman</h4>
        <div id="experience-list"></div>
        <button type="button" class="btn-add" id="add-experience">+ Tambah Pengalaman</button>

        <h4 class="form-section-title">Keahlian</h4>
        <div class="form-group"><label>Keahlian (pisahkan dengan koma)</label>
          <input name="abilities" value="${escapeAttr((u.abilities||[]).join(', '))}"></div>

        <h4 class="form-section-title">Proyek</h4>
        <div class="form-group"><label>Link Proyek Utama</label>
          <input name="projectLink" value="${escapeAttr(u.projectLink)}"></div>
        <div class="form-group"><label>Proyek Lainnya (satu per baris)</label>
          <textarea name="projects" rows="5">${escapeHtml((u.projects||[]).join('\n'))}</textarea></div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Simpan Perubahan</button>
          <span id="save-status"></span>
        </div>
      </form>
    </div></div>
  `;

  // Avatar upload logic (matching Kelola Berkas style)
  $('upload-avatar-btn').addEventListener('click', async () => {
    const input = $('avatar-file-input');
    const status = $('avatar-status');
    const file = input.files[0];
    
    if (!file) { status.textContent = 'Pilih foto terlebih dahulu.'; status.style.color = '#ef4444'; return; }
    
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!['.png','.jpeg','.jpg'].includes(ext)) {
      status.textContent = 'Hanya format .png, .jpeg, .jpg yang diizinkan.'; status.style.color = '#ef4444'; return;
    }
    if (file.size > 5 * 1024 * 1024) {
      status.textContent = 'Ukuran foto melebihi 5MB.'; status.style.color = '#ef4444'; return;
    }

    status.textContent = 'Mengunggah...'; status.style.color = '';
    const fd = new FormData();
    fd.append('file', file);
    
    try {
      // 1. Upload the file
      const res = await fetch(`/api/files/${editingUserId}`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah');
      
      // 2. Save filename to user profile
      await fetch(`/api/users/${editingUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: data.file.name })
      });
      
      status.textContent = '✓ Foto berhasil diunggah';
      status.style.color = '#22c55e';
      setTimeout(renderTab, 1000); // Re-render to show new image
    } catch (err) {
      status.textContent = '✗ Gagal: ' + err.message;
      status.style.color = '#ef4444';
    }
  });

  $('remove-avatar').addEventListener('click', async () => {
    if (!confirm('Hapus foto profil?')) return;
    currentUser.avatar = '';
    await fetch(`/api/users/${editingUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar: '' })
    });
    renderTab();
  });

  (u.education || []).forEach(addEduRow);
  (u.experience || []).forEach(addExpRow);
  $('add-education').addEventListener('click', () => addEduRow({}));
  $('add-experience').addEventListener('click', () => addExpRow({}));
  $('data-form').addEventListener('submit', saveData);
}

function addEduRow(e) {
  const row = document.createElement('div');
  row.className = 'dynamic-item education-row';
  row.innerHTML = `
    <input class="edu-degree" placeholder="Gelar / Jurusan" value="${escapeAttr(e.degree)}">
    <input class="edu-institution" placeholder="Institusi" value="${escapeAttr(e.institution)}">
    <input class="edu-year" placeholder="Tahun (e.g. 2020 - 2024)" value="${escapeAttr(e.year)}">
    <button type="button" class="remove-btn" title="Hapus">×</button>`;
  row.querySelector('.remove-btn').addEventListener('click', () => row.remove());
  $('education-list').appendChild(row);
}

function addExpRow(e) {
  const row = document.createElement('div');
  row.className = 'dynamic-item experience-row';
  row.innerHTML = `
    <input class="exp-title" placeholder="Posisi / Judul" value="${escapeAttr(e.title)}">
    <input class="exp-company" placeholder="Perusahaan / Organisasi" value="${escapeAttr(e.company)}">
    <input class="exp-period" placeholder="Periode (e.g. 2023 - 2024)" value="${escapeAttr(e.period)}">
    <textarea class="exp-description" placeholder="Deskripsi pekerjaan" rows="2">${escapeHtml(e.description)}</textarea>
    <button type="button" class="remove-btn" title="Hapus">×</button>`;
  row.querySelector('.remove-btn').addEventListener('click', () => row.remove());
  $('experience-list').appendChild(row);
}

async function saveData(e) {
  e.preventDefault();
  const form = e.target, status = $('save-status');
  status.textContent = 'Menyimpan...'; status.style.color = '';

  const education = [...document.querySelectorAll('.education-row')].map(r => ({
    degree: r.querySelector('.edu-degree').value.trim(),
    institution: r.querySelector('.edu-institution').value.trim(),
    year: r.querySelector('.edu-year').value.trim()
  })).filter(e => e.degree || e.institution);

  const experience = [...document.querySelectorAll('.experience-row')].map(r => ({
    title: r.querySelector('.exp-title').value.trim(),
    company: r.querySelector('.exp-company').value.trim(),
    period: r.querySelector('.exp-period').value.trim(),
    description: r.querySelector('.exp-description').value.trim()
  })).filter(e => e.title || e.company);

  const data = {
    nim: form.nim.value.trim(),
    name: form.name.value.trim(),
    role: form.role.value.trim(),
    profile: form.profile.value.trim(),
    contact: {
      email: form['contact.email'].value.trim(),
      phone: form['contact.phone'].value.trim(),
      location: form['contact.location'].value.trim(),
      linkedin: form['contact.linkedin'].value.trim(),
      github: form['contact.github'].value.trim()
    },
    education, experience,
    abilities: form.abilities.value.split(',').map(s => s.trim()).filter(Boolean),
    projectLink: form.projectLink.value.trim(),
    projects: form.projects.value.split('\n').map(s => s.trim()).filter(Boolean)
  };

  try {
    const res = await fetch(`/api/users/${editingUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Gagal menyimpan');
    status.textContent = '✓ Tersimpan';
    status.style.color = '#22c55e';
    setTimeout(() => { status.textContent = ''; }, 2000);
  } catch (err) {
    status.textContent = '✗ ' + err.message;
    status.style.color = '#ef4444';
  }
}

function renderFilesTab() {
  const files = currentUser.files || [];
  $('admin-content').innerHTML = `
    <div class="card"><div class="card-body">
      <h3 class="form-section-title">Unggah Berkas</h3>
      <p class="hint">Hanya format .pdf, .png, .jpeg. Maksimal 5MB.</p>
      <div class="upload-area">
        <input type="file" id="file-input" accept=".pdf,.png,.jpeg,.jpg">
        <button class="btn btn-primary" id="upload-btn">Unggah</button>
      </div>
      <div id="upload-status" class="error-msg"></div>

      <h3 class="form-section-title">Berkas Tersimpan (${files.length})</h3>
      <div class="file-list">
        ${files.length === 0
          ? '<p class="hint">Belum ada berkas.</p>'
          : files.map(f => {
              const isPdf = f.name.toLowerCase().endsWith('.pdf');
              const url = `/download/${editingUserId}/${encodeURIComponent(f.name)}`;
              const size = (f.size / 1024).toFixed(1) + ' KB';
              return `<div class="file-item">
                <span class="file-icon">${isPdf ? '📄' : '🖼️'}</span>
                <span class="file-name">${escapeHtml(f.name)}</span>
                <span class="file-meta">${size}</span>
                <a href="${url}" download="${escapeAttr(f.name)}" class="btn btn-secondary btn-sm">Unduh</a>
                <button class="btn btn-danger btn-sm delete-file-btn" data-filename="${escapeAttr(f.name)}">Hapus</button>
              </div>`;
            }).join('')}
      </div>
    </div></div>`;

  $('upload-btn').addEventListener('click', uploadFile);
  document.querySelectorAll('.delete-file-btn').forEach(b => {
    b.addEventListener('click', () => deleteFile(b.dataset.filename));
  });
}

async function uploadFile() {
  const input = $('file-input'), status = $('upload-status');
  const file = input.files[0];
  if (!file) { status.textContent = 'Pilih berkas terlebih dahulu.'; status.style.color = '#ef4444'; return; }

  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!['.pdf','.png','.jpeg','.jpg'].includes(ext)) {
    status.textContent = 'Tipe berkas tidak diizinkan.'; status.style.color = '#ef4444'; return;
  }
  if (file.size > 5 * 1024 * 1024) {
    status.textContent = 'Ukuran berkas melebihi 5MB.'; status.style.color = '#ef4444'; return;
  }

  status.textContent = 'Mengunggah...'; status.style.color = '';
  const fd = new FormData();
  fd.append('file', file);

  try {
    const res = await fetch(`/api/files/${editingUserId}`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengunggah');
    status.textContent = '✓ Terunggah: ' + data.file.name;
    status.style.color = '#22c55e';
    setTimeout(renderTab, 800);
  } catch (err) {
    status.textContent = '✗ ' + err.message; status.style.color = '#ef4444';
  }
}

async function deleteFile(filename) {
  if (!confirm(`Hapus "${filename}"?`)) return;
  try {
    const res = await fetch(
      `/api/files/${editingUserId}/${encodeURIComponent(filename)}`,
      { method: 'DELETE' }
    );
    if (!res.ok) throw new Error('Gagal menghapus');
    renderTab();
  } catch (err) { alert('Gagal menghapus: ' + err.message); }
}

function renderPasswordTab() {
  if (session.role === 'user') {
    $('admin-content').innerHTML = `
      <div class="card"><div class="card-body">
        <h3 class="form-section-title">Ubah Kata Sandi</h3>
        <form id="pw-form">
          <div class="form-group"><label>Kata Sandi Saat Ini</label>
            <input type="password" id="pw-current" required></div>
          <div class="form-group"><label>Kata Sandi Baru (min 6)</label>
            <input type="password" id="pw-new" required minlength="6"></div>
          <div class="form-group"><label>Konfirmasi Kata Sandi Baru</label>
            <input type="password" id="pw-confirm" required minlength="6"></div>
          <div id="pw-status" class="error-msg"></div>
          <button type="submit" class="btn btn-primary">Ubah Kata Sandi</button>
        </form>
      </div></div>`;
    $('pw-form').addEventListener('submit', changeOwnPassword);
  } else {
    $('admin-content').innerHTML = `
      <div class="card"><div class="card-body">
        <h3 class="form-section-title">Reset Kata Sandi Pengguna</h3>
        <form id="reset-form">
          <div class="form-group"><label>Pilih Pengguna</label>
            <select id="reset-user">
              <option value="user1">User 1</option>
              <option value="user2">User 2</option>
              <option value="user3">User 3</option>
            </select></div>
          <div class="form-group"><label>Kata Sandi Baru (min 6)</label>
            <input type="password" id="reset-pw" required minlength="6"></div>
          <div id="reset-status" class="error-msg"></div>
          <button type="submit" class="btn btn-primary">Reset Kata Sandi Pengguna</button>
        </form>

        <h3 class="form-section-title" style="margin-top:32px">Ubah Kata Sandi Master</h3>
        <form id="master-form">
          <div class="form-group"><label>Kata Sandi Master Saat Ini</label>
            <input type="password" id="master-current" required></div>
          <div class="form-group"><label>Kata Sandi Master Baru (min 6)</label>
            <input type="password" id="master-new" required minlength="6"></div>
          <div id="master-status" class="error-msg"></div>
          <button type="submit" class="btn btn-primary">Ubah Kata Sandi Master</button>
        </form>
      </div></div>`;
    $('reset-form').addEventListener('submit', resetUserPassword);
    $('master-form').addEventListener('submit', changeMasterPassword);
  }
}

async function changeOwnPassword(e) {
  e.preventDefault();
  const status = $('pw-status');
  const current = $('pw-current').value, next = $('pw-new').value, confirm = $('pw-confirm').value;
  if (next !== confirm) { status.textContent = 'Kata sandi baru tidak cocok.'; status.style.color = '#ef4444'; return; }
  status.textContent = ''; 

  try {
    const res = await fetch('/api/password/user', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    status.textContent = '✓ Kata sandi berhasil diubah.'; status.style.color = '#22c55e';
  } catch (err) { status.textContent = '✗ ' + err.message; status.style.color = '#ef4444'; }
}

async function resetUserPassword(e) {
  e.preventDefault();
  const status = $('reset-status');
  const userId = $('reset-user').value, newPw = $('reset-pw').value;
  try {
    const res = await fetch(`/api/password/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: newPw })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    status.textContent = `✓ Kata sandi ${userId} berhasil direset.`; status.style.color = '#22c55e';
  } catch (err) { status.textContent = '✗ ' + err.message; status.style.color = '#ef4444'; }
}

async function changeMasterPassword(e) {
  e.preventDefault();
  const status = $('master-status');
  const current = $('master-current').value, next = $('master-new').value;
  try {
    const res = await fetch('/api/password/master/change', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: current, newPassword: next })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    status.textContent = '✓ Kata sandi Master berhasil diubah.'; status.style.color = '#22c55e';
  } catch (err) { status.textContent = '✗ ' + err.message; status.style.color = '#ef4444'; }
}

init();