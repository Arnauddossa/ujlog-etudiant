// ==================== UJLOG ÉTUDIANT — script.js ====================
// Stockage global : JSONBin.io  |  Fichiers : Cloudinary

// ===== ⚙️ CONFIGURATION =====
const CONFIG = {
    cloudName:     'dt24o2j8d',
    uploadPreset:  'Ujlog_preset',
    jsonbinKey:    '$2a$10$sgbdvN94VScpYJR401b2HO/Dq8.hZkrBVHtUkItQWSR/f1tIkrhyi',
    jsonbinBin:    '69e39e3eaaba88219712046e',
    adminPassword: 'Mikamise'
};

// ===== STATE =====
let etat = {
    cm:      { filtreAnnee: 'all', filtreMatiere: 'all', page: 1, limit: 6 },
    td:      { filtreAnnee: 'all', filtreMatiere: 'all', page: 1, limit: 6 },
    examens: { filtreSession: null, page: 1, limit: 6 }
};

let ressources = { cm: [], td: [], examens: [] };
let isAdmin = false;
let pendingUpload = false;

// ===== JSONBIN — LIRE =====
async function chargerDepuisJsonBin() {
    try {
        showLoader(true);
        const res = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.jsonbinBin}/latest`, {
            headers: {
                'X-Master-Key': CONFIG.jsonbinKey,
                'X-Access-Key': CONFIG.jsonbinKey
            }
        });
        if (!res.ok) throw new Error('Erreur lecture JSONBin');
        const data = await res.json();
        ressources = data.record || { cm: [], td: [], examens: [] };
        ressources.cm      = ressources.cm      || [];
        ressources.td      = ressources.td      || [];
        ressources.examens = ressources.examens || [];
    } catch (e) {
        console.error(e);
        showToast('Impossible de charger les ressources. Vérifie ta connexion.', 'error');
        ressources = { cm: [], td: [], examens: [] };
    } finally {
        showLoader(false);
    }
}

// ===== JSONBIN — SAUVEGARDER =====
async function sauvegarderSurJsonBin() {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.jsonbinBin}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': CONFIG.jsonbinKey
        },
        body: JSON.stringify(ressources)
    });
    if (!res.ok) throw new Error('Erreur sauvegarde JSONBin (code ' + res.status + ')');
}

// ===== LOADER GLOBAL =====
function showLoader(visible) {
    let loader = document.getElementById('globalLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'globalLoader';
        loader.innerHTML = `<div class="gl-inner"><div class="spinner"></div><p>Chargement des ressources…</p></div>`;
        document.body.appendChild(loader);
        const s = document.createElement('style');
        s.textContent = `
            #globalLoader{position:fixed;inset:0;background:rgba(255,255,255,.9);backdrop-filter:blur(6px);
            z-index:9000;display:flex;align-items:center;justify-content:center;}
            .gl-inner{text-align:center;color:var(--green);}
            .gl-inner p{margin-top:.8rem;font-weight:600;font-size:.95rem;color:var(--green);}
        `;
        document.head.appendChild(s);
    }
    loader.style.display = visible ? 'flex' : 'none';
}

// ===== AUTH ADMIN =====
function initAdminLogin() {
    const form = document.getElementById('adminLoginForm');
    if (!form) return;
    form.addEventListener('submit', e => {
        e.preventDefault();
        const pwd = document.getElementById('adminPassword').value;
        if (pwd === CONFIG.adminPassword) {
            isAdmin = true;
            closeModal('adminLogin');
            updateUIAdmin();
            showToast('Accès admin accordé ! 🔓', 'success');
            if (pendingUpload) { pendingUpload = false; openModal('upload'); }
        } else {
            showToast('Mot de passe incorrect.', 'error');
            document.getElementById('adminPassword').value = '';
            const inp = document.getElementById('adminPassword');
            if (inp) { inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 500); }
        }
    });
}

function updateUIAdmin() {
    const btnAdd   = document.getElementById('btnAddResource');
    const btnAdmin = document.getElementById('btnAdminAccess');
    if (isAdmin) {
        if (btnAdd)   btnAdd.style.display   = 'inline-flex';
        if (btnAdmin) btnAdmin.style.display = 'none';
    } else {
        if (btnAdd)   btnAdd.style.display   = 'none';
        if (btnAdmin) btnAdmin.style.display = 'inline-flex';
    }
}

// ===== UTILITAIRES =====
function matiereLabel(m) { return m === 'histoire' ? 'Histoire' : 'Géographie'; }
function sessionLabel(s)  { return s === 'session1' ? 'Session 1' : 'Session 2'; }

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function typeBadge(type) {
    const map = {
        cm:     { cls: 'badge-cm',     label: 'CM',     icon: 'fa-chalkboard-teacher' },
        td:     { cls: 'badge-td',     label: 'TD',     icon: 'fa-pencil-ruler' },
        examen: { cls: 'badge-examen', label: 'Examen', icon: 'fa-file-alt' }
    };
    const t = map[type] || map.cm;
    return `<span class="card-type-badge ${t.cls}"><i class="fas ${t.icon}"></i> ${t.label}</span>`;
}

// ===== RENDER CARD =====
function renderCard(item, type) {
    const session = (type === 'examen' && item.session)
        ? `<span class="card-tag"><i class="fas fa-layer-group"></i> ${sessionLabel(item.session)}</span>` : '';
    const deleteBtn = isAdmin
        ? `<button class="btn-card-delete" title="Supprimer" onclick="supprimerRessource('${item.id}','${type}')">
               <i class="fas fa-trash-alt"></i>
           </button>` : '';
    return `
    <div class="card" data-id="${item.id}">
        <div class="card-top-row">
            ${typeBadge(type)}
            ${deleteBtn}
        </div>
        <h3>${escapeHtml(item.titre)}</h3>
        <div class="card-meta">
            <span class="card-tag"><i class="fas fa-book"></i> ${matiereLabel(item.matiere)}</span>
            <span class="card-tag"><i class="fas fa-calendar-alt"></i> ${item.annee}</span>
            ${session}
        </div>
        <button class="btn-card-dl" onclick="telecharger('${escapeHtml(item.url)}')">
            <i class="fas fa-download"></i> Télécharger
        </button>
    </div>`;
}

function telecharger(url) {
    if (!url || url === '#') { showToast('Fichier non disponible.', 'error'); return; }
    window.open(url, '_blank');
}

// ===== SUPPRIMER =====
window.supprimerRessource = async function(id, type) {
    if (!isAdmin) return;
    if (!confirm('Supprimer cette ressource ? Cette action est irréversible.')) return;
    const key = type === 'examen' ? 'examens' : type;
    ressources[key] = ressources[key].filter(r => r.id !== id);
    try {
        await sauvegarderSurJsonBin();
        afficherTout();
        majStats();
        showToast('Ressource supprimée avec succès.', 'success');
    } catch {
        showToast('Erreur lors de la suppression.', 'error');
    }
};

// ===== AFFICHAGE =====
function afficherCM() {
    const grid = document.getElementById('cm-grid');
    if (!grid) return;
    let liste = ressources.cm || [];
    if (etat.cm.filtreAnnee   !== 'all') liste = liste.filter(r => r.annee   === etat.cm.filtreAnnee);
    if (etat.cm.filtreMatiere !== 'all') liste = liste.filter(r => r.matiere === etat.cm.filtreMatiere);
    renderGrid(grid, liste, 'cm', etat.cm);
    majBtnLoadMore('cm-load-more', liste, etat.cm);
}

function afficherTD() {
    const grid = document.getElementById('td-grid');
    if (!grid) return;
    let liste = ressources.td || [];
    if (etat.td.filtreAnnee   !== 'all') liste = liste.filter(r => r.annee   === etat.td.filtreAnnee);
    if (etat.td.filtreMatiere !== 'all') liste = liste.filter(r => r.matiere === etat.td.filtreMatiere);
    renderGrid(grid, liste, 'td', etat.td);
    majBtnLoadMore('td-load-more', liste, etat.td);
}

function afficherExamens() {
    const grid = document.getElementById('examens-grid');
    if (!grid) return;
    let liste = ressources.examens || [];
    if (etat.examens.filtreSession) liste = liste.filter(r => r.session === etat.examens.filtreSession);
    renderGrid(grid, liste, 'examen', etat.examens);
    majBtnLoadMore('examens-load-more', liste, etat.examens);
}

function afficherTout() { afficherCM(); afficherTD(); afficherExamens(); }

function renderGrid(grid, liste, type, st) {
    const paginated = liste.slice(0, st.page * st.limit);
    if (paginated.length === 0) {
        grid.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-folder-open"></i>
            <p>Aucune ressource disponible pour l'instant.</p>
            ${isAdmin ? '<p style="margin-top:.5rem;font-size:.83rem;color:var(--green);">Utilisez <strong>+ Ajouter</strong> pour publier.</p>' : ''}
        </div>`;
    } else {
        grid.innerHTML = paginated.map(item => renderCard(item, type)).join('');
    }
}

function majBtnLoadMore(btnId, liste, st) {
    const btn = document.getElementById(btnId);
    if (btn) btn.style.display = liste.length > st.page * st.limit ? 'inline-flex' : 'none';
}

// ===== FILTRES =====
function initFiltres() {
    bindFilter('cm-year',    v => { etat.cm.filtreAnnee   = v; etat.cm.page = 1; afficherCM(); });
    bindFilter('cm-subject', v => { etat.cm.filtreMatiere = v; etat.cm.page = 1; afficherCM(); });
    bindFilter('td-year',    v => { etat.td.filtreAnnee   = v; etat.td.page = 1; afficherTD(); });
    bindFilter('td-subject', v => { etat.td.filtreMatiere = v; etat.td.page = 1; afficherTD(); });
}

function bindFilter(id, cb) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', e => cb(e.target.value));
}

window.resetFilters = function(type) {
    if (type === 'cm') {
        setVal('cm-year','all'); setVal('cm-subject','all');
        etat.cm.filtreAnnee = 'all'; etat.cm.filtreMatiere = 'all'; etat.cm.page = 1;
        afficherCM();
    } else {
        setVal('td-year','all'); setVal('td-subject','all');
        etat.td.filtreAnnee = 'all'; etat.td.filtreMatiere = 'all'; etat.td.page = 1;
        afficherTD();
    }
};

function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }

window.filterExam = function(session) {
    etat.examens.filtreSession = session;
    etat.examens.page = 1;
    afficherExamens();
    ['cat-all','cat-session1','cat-session2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.removeAttribute('data-active');
    });
    const aId = session === null ? 'cat-all' : (session === 'session1' ? 'cat-session1' : 'cat-session2');
    const active = document.getElementById(aId);
    if (active) active.setAttribute('data-active','true');
};

window.loadMore = function(type) {
    if      (type === 'cm') { etat.cm.page++;      afficherCM(); }
    else if (type === 'td') { etat.td.page++;      afficherTD(); }
    else                    { etat.examens.page++;  afficherExamens(); }
};

// ===== STATS =====
function majStats() {
    animateCount('statCM',     (ressources.cm      || []).length);
    animateCount('statTD',     (ressources.td      || []).length);
    animateCount('statExamen', (ressources.examens || []).length);
}

function animateCount(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    let start = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const timer = setInterval(() => {
        start = Math.min(start + step, target);
        el.textContent = start;
        if (start >= target) clearInterval(timer);
    }, 40);
}

// ===== RECHERCHE =====
function initSearch() {
    const input    = document.getElementById('searchInput');
    const clear    = document.getElementById('searchClear');
    const dropdown = document.getElementById('searchDropdown');
    if (!input) return;

    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        if (clear) clear.style.display = q ? 'block' : 'none';
        if (!q) { dropdown.style.display = 'none'; return; }

        const all = [
            ...(ressources.cm      || []).map(r => ({ ...r, _type: 'cm'     })),
            ...(ressources.td      || []).map(r => ({ ...r, _type: 'td'     })),
            ...(ressources.examens || []).map(r => ({ ...r, _type: 'examen' }))
        ];
        const results = all.filter(r =>
            r.titre.toLowerCase().includes(q) ||
            matiereLabel(r.matiere).toLowerCase().includes(q)
        ).slice(0, 6);

        dropdown.innerHTML = results.length === 0
            ? `<div class="search-empty"><i class="fas fa-search"></i> Aucun résultat pour "<strong>${escapeHtml(q)}</strong>"</div>`
            : results.map(r => `
                <div class="search-result-item" onclick="goToSection('${r._type}')">
                    <div class="search-result-icon"><i class="fas fa-file-alt"></i></div>
                    <div class="search-result-meta">
                        <strong>${escapeHtml(r.titre)}</strong>
                        <span>${matiereLabel(r.matiere)} · ${r.annee} · ${r._type.toUpperCase()}</span>
                    </div>
                </div>`).join('');
        dropdown.style.display = 'block';
    });

    if (clear) clear.addEventListener('click', () => {
        input.value = ''; clear.style.display = 'none'; dropdown.style.display = 'none';
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('.search-bar-wrap')) dropdown.style.display = 'none';
    });
}

function goToSection(type) {
    const map = { cm: '#cm', td: '#td', examen: '#examens' };
    const el = document.querySelector(map[type]);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    const dropdown = document.getElementById('searchDropdown');
    if (dropdown) dropdown.style.display = 'none';
}

// ===== MODALS =====
window.openModal = function(type) {
    const m = document.getElementById(type + 'Modal');
    if (m) { m.style.display = 'flex'; setTimeout(() => m.classList.add('open'), 10); }
};
window.closeModal = function(type) {
    const m = document.getElementById(type + 'Modal');
    if (m) { m.classList.remove('open'); setTimeout(() => m.style.display = 'none', 200); }
};
window.openUploadModal = function() {
    if (!isAdmin) { pendingUpload = true; openModal('adminLogin'); }
    else openModal('upload');
};
window.addEventListener('click', e => {
    if (e.target.classList.contains('modal')) {
        const id = e.target.id.replace('Modal', '');
        closeModal(id);
    }
});

// ===== UPLOAD =====
function initUploadForm() {
    const typeSelect   = document.getElementById('uploadType');
    const sessionGroup = document.getElementById('sessionGroup');
    if (typeSelect && sessionGroup) {
        typeSelect.addEventListener('change', () => {
            sessionGroup.style.display = typeSelect.value === 'examen' ? 'flex' : 'none';
        });
    }

    const dz         = document.getElementById('fileDropZone');
    const fileInput  = document.getElementById('uploadFichier');
    const fileChosen = document.getElementById('fileChosen');
    if (dz && fileInput) {
        fileInput.addEventListener('change', () => {
            const f = fileInput.files[0];
            if (f && fileChosen) fileChosen.textContent = '✓ ' + f.name;
        });
        ['dragenter','dragover'].forEach(ev =>
            dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag-over'); }));
        ['dragleave','drop'].forEach(ev =>
            dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag-over'); }));
        dz.addEventListener('drop', e => {
            const file = e.dataTransfer.files[0];
            if (file) {
                const dt = new DataTransfer(); dt.items.add(file);
                fileInput.files = dt.files;
                if (fileChosen) fileChosen.textContent = '✓ ' + file.name;
            }
        });
    }

    const form = document.getElementById('uploadForm');
    if (!form) return;

    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (!isAdmin) { showToast('Accès refusé.', 'error'); return; }

        const type    = document.getElementById('uploadType').value;
        const titre   = document.getElementById('uploadTitre').value.trim();
        const matiere = document.getElementById('uploadMatiere').value;
        const annee   = document.getElementById('uploadAnnee').value;
        const session = type === 'examen' ? document.getElementById('uploadSession').value : null;
        const fichier = fileInput ? fileInput.files[0] : null;

        if (!fichier) { showToast('Sélectionne un fichier.', 'error'); return; }
        if (!titre)   { showToast('Ajoute un titre.', 'error'); return; }

        const progress = document.getElementById('uploadProgress');
        if (progress) progress.style.display = 'block';
        form.style.display = 'none';

        try {
            // 1. Upload Cloudinary
            const result = await uploadToCloudinary(fichier);

            // 2. Construire ressource
            const newRes = {
                id:      type + '_' + Date.now(),
                titre, matiere, annee,
                fichier: fichier.name,
                url:     result.url,
                date:    new Date().toISOString()
            };
            if (session) newRes.session = session;

            // 3. Ajouter
            if      (type === 'examen') ressources.examens.push(newRes);
            else if (type === 'td')     ressources.td.push(newRes);
            else                        ressources.cm.push(newRes);

            // 4. Sauvegarder sur JSONBin → visible par TOUT LE MONDE
            await sauvegarderSurJsonBin();

            // 5. Rafraîchir
            afficherTout();
            majStats();
            closeModal('upload');
            showToast('Fichier publié ! Visible par tout le monde 🌍', 'success');
            form.reset();
            if (fileChosen) fileChosen.textContent = '';

        } catch (err) {
            console.error(err);
            showToast('Erreur : ' + err.message, 'error');
        } finally {
            if (progress) progress.style.display = 'none';
            form.style.display = 'block';
        }
    });
}

// ===== CLOUDINARY =====
async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CONFIG.uploadPreset);
    const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CONFIG.cloudName}/raw/upload`,
        { method: 'POST', body: formData }
    );
    if (!res.ok) throw new Error('Upload Cloudinary échoué (code ' + res.status + ')');
    const data = await res.json();
    return { url: data.secure_url, publicId: data.public_id };
}

// ===== CONTACT =====
function initContact() {
    const form = document.getElementById('contactForm');
    if (!form) return;
    form.addEventListener('submit', e => {
        e.preventDefault();
        showToast('Message envoyé ! Nous vous répondrons bientôt. 📬', 'success');
        form.reset();
    });
}

// ===== TOAST =====
let toastTimer = null;
function showToast(msg, type = 'info') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast ' + (type === 'success' ? 'success' : type === 'error' ? 'error' : '');
    t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3800);
}

// ===== NAVBAR SCROLL =====
function initNavbarScroll() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 30);
    }, { passive: true });
}

// ===== MOBILE MENU =====
function initMobileMenu() {
    const toggle = document.getElementById('menuToggle');
    const menu   = document.getElementById('navMenu');
    if (!toggle || !menu) return;
    toggle.addEventListener('click', () => {
        const open = menu.classList.toggle('mobile-open');
        toggle.classList.toggle('open', open);
    });
    menu.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => {
        menu.classList.remove('mobile-open');
        toggle.classList.remove('open');
    }));
}

// ===== SCROLL SPY =====
function initScrollSpy() {
    const sections = document.querySelectorAll('section[id]');
    const links    = document.querySelectorAll('.nav-link');
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(s => { if (window.scrollY >= s.offsetTop - 120) current = s.id; });
        links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + current));
    }, { passive: true });
}

// ===== INJECT MODAL ADMIN =====
function injecterModalAdmin() {
    if (document.getElementById('adminLoginModal')) return;
    const modal = document.createElement('div');
    modal.id = 'adminLoginModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:380px;">
            <button class="modal-close" onclick="closeModal('adminLogin')" aria-label="Fermer">&times;</button>
            <div class="modal-header">
                <i class="fas fa-shield-alt modal-icon"></i>
                <h2>Accès Administrateur</h2>
                <p style="font-size:.88rem;color:var(--text-muted);margin-top:.3rem;">Entrez le mot de passe pour publier des ressources.</p>
            </div>
            <form id="adminLoginForm" novalidate>
                <div class="form-group">
                    <label for="adminPassword">Mot de passe admin</label>
                    <div class="input-wrap">
                        <i class="fas fa-lock"></i>
                        <input type="password" id="adminPassword" placeholder="••••••••" required autocomplete="current-password">
                        <button type="button" class="toggle-pwd" onclick="togglePwd('adminPassword')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
                <button type="submit" class="btn-submit">
                    <i class="fas fa-unlock-alt"></i> Accéder
                </button>
            </form>
        </div>`;
    document.body.appendChild(modal);
    initAdminLogin();
}

window.togglePwd = function(id) {
    const inp = document.getElementById(id);
    if (!inp) return;
    const icon = inp.parentElement.querySelector('.toggle-pwd i');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    if (icon) icon.className = inp.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
};

// ===== INJECT BOUTON ADMIN NAVBAR =====
function injecterBoutonAdmin() {
    const navActions = document.querySelector('.nav-actions');
    if (!navActions || document.getElementById('btnAdminAccess')) return;

    // Retirer les boutons login/register (non utilisés dans ce mode)
    navActions.querySelectorAll('.btn-outline, .btn-solid').forEach(b => b.remove());

    const btnAdmin = document.createElement('button');
    btnAdmin.id        = 'btnAdminAccess';
    btnAdmin.className = 'btn-nav btn-outline';
    btnAdmin.innerHTML = '<i class="fas fa-lock"></i> Admin';
    btnAdmin.onclick   = () => openModal('adminLogin');
    navActions.prepend(btnAdmin);
}

// ===== INJECT STYLES EXTRA =====
function injecterStyles() {
    const s = document.createElement('style');
    s.textContent = `
        .card-top-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: .25rem;
        }
        .btn-card-delete {
            background: #fee2e2;
            color: #dc2626;
            border: none;
            border-radius: 6px;
            padding: .3rem .55rem;
            font-size: .78rem;
            cursor: pointer;
            transition: all .2s;
            flex-shrink: 0;
        }
        .btn-card-delete:hover {
            background: #dc2626;
            color: #fff;
        }
        @keyframes shake {
            0%,100%{transform:translateX(0)}
            20%{transform:translateX(-6px)}
            40%{transform:translateX(6px)}
            60%{transform:translateX(-4px)}
            80%{transform:translateX(4px)}
        }
        .shake { animation: shake .4s ease; border-color: #dc2626 !important; }
    `;
    document.head.appendChild(s);
}

// ===== INITIALISATION =====
document.addEventListener('DOMContentLoaded', async () => {
    injecterStyles();
    injecterBoutonAdmin();
    injecterModalAdmin();

    // Charger depuis JSONBin — base commune visible par tout le monde
    await chargerDepuisJsonBin();

    afficherTout();
    majStats();
    initFiltres();
    initUploadForm();
    initSearch();
    initContact();
    initNavbarScroll();
    initMobileMenu();
    initScrollSpy();
    updateUIAdmin();
});
