// ==================== UJLOG ÉTUDIANT — script.js ====================

const CONFIG = {
    cloudName:     'dt24o2j8d',
    uploadPreset:  'Ujlog_preset',
    jsonbinKey:    '$2a$10$sgbdvN94VScpYJR401b2HO/Dq8.hZkrBVHtUkItQWSR/f1tIkrhyi',
    jsonbinBin:    '69e39e3eaaba88219712046e',
    adminPassword: 'Mikamise'
};

// ===== STATE =====
// Chaque section a : semestre (1|2), session (null|session1|session2), matiere, annee, page
const SECTIONS = ['cm','td','examens','resultats_td','resultats_exam'];

let etat = {};
SECTIONS.forEach(s => {
    etat[s] = { semestre:'1', session:null, matiere:'all', annee:'all', page:1, limit:6 };
});

let ressources = { cm:[], td:[], examens:[], resultats_td:[], resultats_exam:[] };
let isAdmin = false;
let pendingUpload = false;
let currentResultType = 'fichier'; // 'fichier' | 'tableau'

// ===== JSONBIN =====
async function chargerDepuisJsonBin() {
    try {
        showLoader(true);
        const res = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.jsonbinBin}/latest`, {
            headers: {
                'X-Master-Key': CONFIG.jsonbinKey,
                'X-Access-Key': CONFIG.jsonbinKey
            }
        });
        if (!res.ok) throw new Error('Erreur lecture JSONBin ' + res.status);
        const data = await res.json();
        const r = data.record || {};
        ressources.cm           = r.cm           || [];
        ressources.td           = r.td           || [];
        ressources.examens      = r.examens      || [];
        ressources.resultats_td = r.resultats_td || [];
        ressources.resultats_exam = r.resultats_exam || [];
    } catch(e) {
        console.error(e);
        showToast('Impossible de charger les ressources.', 'error');
    } finally {
        showLoader(false);
    }
}

async function sauvegarderSurJsonBin() {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.jsonbinBin}`, {
        method:'PUT',
        headers:{ 'Content-Type':'application/json', 'X-Master-Key':CONFIG.jsonbinKey },
        body: JSON.stringify(ressources)
    });
    if (!res.ok) throw new Error('Erreur sauvegarde JSONBin ' + res.status);
}

// ===== LOADER =====
function showLoader(v) {
    let el = document.getElementById('globalLoader');
    if (!el) {
        el = document.createElement('div'); el.id = 'globalLoader';
        el.innerHTML = `<div style="text-align:center;color:var(--green)"><div class="spinner"></div><p style="margin-top:.8rem;font-weight:600">Chargement…</p></div>`;
        Object.assign(el.style, {
            position:'fixed',inset:'0',background:'rgba(255,255,255,.9)',
            backdropFilter:'blur(6px)',zIndex:'9000',
            display:'flex',alignItems:'center',justifyContent:'center'
        });
        document.body.appendChild(el);
    }
    el.style.display = v ? 'flex' : 'none';
}

// ===== ADMIN =====
function initAdminLogin() {
    const form = document.getElementById('adminLoginForm');
    if (!form) return;
    form.addEventListener('submit', e => {
        e.preventDefault();
        const pwd = document.getElementById('adminPwd').value;
        if (pwd === CONFIG.adminPassword) {
            isAdmin = true;
            closeModal('adminLogin');
            updateUIAdmin();
            afficherTout();
            showToast('Accès admin accordé ! 🔓', 'success');
            if (pendingUpload) { pendingUpload = false; openModal('upload'); }
        } else {
            showToast('Mot de passe incorrect.', 'error');
            document.getElementById('adminPwd').value = '';
            const inp = document.getElementById('adminPwd');
            inp.classList.add('shake');
            setTimeout(() => inp.classList.remove('shake'), 500);
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
function semestreLabel(s) { return 'Semestre ' + s; }

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function typeBadge(type) {
    const map = {
        cm:           { cls:'badge-cm',     label:'CM',          icon:'fa-chalkboard-teacher' },
        td:           { cls:'badge-td',     label:'TD',          icon:'fa-pencil-ruler' },
        examens:      { cls:'badge-examens',label:'Examen',      icon:'fa-file-alt' },
        resultats_td: { cls:'badge-res-td', label:'Résultat TD', icon:'fa-chart-bar' },
        resultats_exam:{ cls:'badge-res-ex',label:'Résultat Ex', icon:'fa-poll' }
    };
    const t = map[type] || map.cm;
    return `<span class="card-type-badge ${t.cls}"><i class="fas ${t.icon}"></i> ${t.label}</span>`;
}

// ===== RENDER CARD =====
function renderCard(item, type) {
    const delBtn = isAdmin
        ? `<button class="btn-card-delete" onclick="supprimerRessource('${item.id}','${type}')"><i class="fas fa-trash-alt"></i></button>`
        : '';

    const sessionTag = item.session
        ? `<span class="card-tag"><i class="fas fa-layer-group"></i> ${sessionLabel(item.session)}</span>` : '';

    // Tableau de notes intégré
    if (item.tableau && item.tableau.length > 0) {
        const rows = item.tableau.map(r => `
            <tr>
                <td>${escapeHtml(r.nom)}</td>
                <td><strong>${r.note}</strong>/20</td>
                <td class="${r.mention==='Admis'?'mention-admis':'mention-aj'}">${escapeHtml(r.mention)}</td>
            </tr>`).join('');
        return `
        <div class="card" data-id="${item.id}">
            <div class="card-top-row">${typeBadge(type)}${delBtn}</div>
            <h3>${escapeHtml(item.titre)}</h3>
            <div class="card-meta">
                <span class="card-tag"><i class="fas fa-book"></i> ${matiereLabel(item.matiere)}</span>
                <span class="card-tag"><i class="fas fa-layer-group"></i> ${semestreLabel(item.semestre)}</span>
                <span class="card-tag"><i class="fas fa-calendar-alt"></i> ${item.annee}</span>
                ${sessionTag}
            </div>
            <table class="notes-table">
                <thead><tr><th>Nom</th><th>Note</th><th>Mention</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
    }

    // Carte fichier normal
    return `
    <div class="card" data-id="${item.id}">
        <div class="card-top-row">${typeBadge(type)}${delBtn}</div>
        <h3>${escapeHtml(item.titre)}</h3>
        <div class="card-meta">
            <span class="card-tag"><i class="fas fa-book"></i> ${matiereLabel(item.matiere)}</span>
            <span class="card-tag"><i class="fas fa-layer-group"></i> ${semestreLabel(item.semestre)}</span>
            <span class="card-tag"><i class="fas fa-calendar-alt"></i> ${item.annee}</span>
            ${sessionTag}
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
    if (!confirm('Supprimer cette ressource ?')) return;
    ressources[type] = ressources[type].filter(r => r.id !== id);
    try {
        await sauvegarderSurJsonBin();
        afficherSection(type);
        majStats();
        showToast('Supprimé avec succès.', 'success');
    } catch { showToast('Erreur lors de la suppression.', 'error'); }
};

// ===== AFFICHAGE =====
function filtrerListe(type) {
    const st = etat[type];
    let liste = ressources[type] || [];
    liste = liste.filter(r => String(r.semestre) === String(st.semestre));
    if (st.session)         liste = liste.filter(r => r.session === st.session);
    if (st.matiere !== 'all') liste = liste.filter(r => r.matiere === st.matiere);
    if (st.annee   !== 'all') liste = liste.filter(r => r.annee   === st.annee);
    return liste;
}

function afficherSection(type) {
    const grid = document.getElementById(type + '-grid');
    if (!grid) return;
    const st = etat[type];
    const liste = filtrerListe(type);
    const paginated = liste.slice(0, st.page * st.limit);

    if (paginated.length === 0) {
        grid.innerHTML = `<div class="empty-state">
            <i class="fas fa-folder-open"></i>
            <p>Aucune ressource pour ce semestre${st.session ? ' / '+sessionLabel(st.session) : ''}.</p>
            ${isAdmin ? '<p style="margin-top:.4rem;font-size:.82rem;color:var(--green);">Utilisez <strong>+ Ajouter</strong> pour publier.</p>' : ''}
        </div>`;
    } else {
        grid.innerHTML = paginated.map(item => renderCard(item, type)).join('');
    }

    const btn = document.getElementById(type + '-load-more');
    if (btn) btn.style.display = liste.length > st.page * st.limit ? 'inline-flex' : 'none';
}

function afficherTout() { SECTIONS.forEach(s => afficherSection(s)); }

// ===== SEMESTRES & SESSIONS =====
window.setSemestre = function(type, num, btn) {
    etat[type].semestre = String(num);
    etat[type].page = 1;
    // Update active tab
    const tabs = btn.parentElement.querySelectorAll('.sem-tab');
    tabs.forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    afficherSection(type);
};

window.setSession = function(type, session, btn) {
    etat[type].session = session;
    etat[type].page = 1;
    const tabs = btn.parentElement.querySelectorAll('.session-tab');
    tabs.forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    afficherSection(type);
};

// ===== FILTRES =====
function initFiltres() {
    SECTIONS.forEach(type => {
        bindFilter(type+'-subject', v => { etat[type].matiere = v; etat[type].page = 1; afficherSection(type); });
        bindFilter(type+'-year',    v => { etat[type].annee   = v; etat[type].page = 1; afficherSection(type); });
    });
}

function bindFilter(id, cb) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', e => cb(e.target.value));
}

window.resetFilters = function(type) {
    const s = document.getElementById(type+'-subject');
    const y = document.getElementById(type+'-year');
    if (s) s.value = 'all';
    if (y) y.value = 'all';
    etat[type].matiere = 'all';
    etat[type].annee   = 'all';
    etat[type].page    = 1;
    afficherSection(type);
};

window.loadMore = function(type) {
    etat[type].page++;
    afficherSection(type);
};

// ===== STATS =====
function majStats() {
    const total = (ressources.resultats_td || []).length + (ressources.resultats_exam || []).length;
    animCount('statCM',       (ressources.cm || []).length);
    animCount('statTD',       (ressources.td || []).length);
    animCount('statExamen',   (ressources.examens || []).length);
    animCount('statResultats', total);
}

function animCount(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    let v = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const t = setInterval(() => { v = Math.min(v + step, target); el.textContent = v; if (v >= target) clearInterval(t); }, 40);
}

// ===== RECHERCHE =====
function initSearch() {
    const input = document.getElementById('searchInput');
    const clear = document.getElementById('searchClear');
    const drop  = document.getElementById('searchDropdown');
    if (!input) return;

    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        if (clear) clear.style.display = q ? 'block' : 'none';
        if (!q) { drop.style.display = 'none'; return; }

        const all = SECTIONS.flatMap(type =>
            (ressources[type] || []).map(r => ({ ...r, _type: type }))
        );
        const results = all.filter(r =>
            r.titre.toLowerCase().includes(q) ||
            matiereLabel(r.matiere).toLowerCase().includes(q)
        ).slice(0, 7);

        drop.innerHTML = results.length === 0
            ? `<div class="search-empty">Aucun résultat pour "<strong>${escapeHtml(q)}</strong>"</div>`
            : results.map(r => `
                <div class="search-result-item" onclick="goToSection('${r._type}')">
                    <div class="search-result-icon"><i class="fas fa-file-alt"></i></div>
                    <div class="search-result-meta">
                        <strong>${escapeHtml(r.titre)}</strong>
                        <span>${matiereLabel(r.matiere)} · S${r.semestre} · ${r.annee}</span>
                    </div>
                </div>`).join('');
        drop.style.display = 'block';
    });

    if (clear) clear.addEventListener('click', () => {
        input.value = ''; clear.style.display = 'none'; drop.style.display = 'none';
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('.search-bar-wrap')) drop.style.display = 'none';
    });
}

function goToSection(type) {
    const map = { cm:'#cm', td:'#td', examens:'#examens', resultats_td:'#resultats-td', resultats_exam:'#resultats-exam' };
    const el = document.querySelector(map[type]);
    if (el) el.scrollIntoView({ behavior:'smooth' });
    const drop = document.getElementById('searchDropdown');
    if (drop) drop.style.display = 'none';
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
        const id = e.target.id.replace('Modal','');
        closeModal(id);
    }
});

// ===== TYPE RÉSULTAT =====
window.setResultType = function(type) {
    currentResultType = type;
    document.getElementById('btnTypeFichier').classList.toggle('active', type === 'fichier');
    document.getElementById('btnTypeTableau').classList.toggle('active', type === 'tableau');
    document.getElementById('fileGroup').style.display    = type === 'fichier' ? 'block' : 'none';
    document.getElementById('tableauGroup').style.display = type === 'tableau' ? 'block' : 'none';
};

// ===== TABLEAU DE NOTES =====
window.ajouterLigne = function() {
    const container = document.getElementById('tableauRows');
    const div = document.createElement('div');
    div.className = 'tableau-row';
    div.innerHTML = `
        <input type="text" placeholder="Nom Prénom" class="t-nom">
        <input type="number" placeholder="Note" min="0" max="20" step="0.25" class="t-note">
        <select class="t-mention">
            <option value="">—</option>
            <option value="Admis">Admis</option>
            <option value="Ajourné">Ajourné</option>
        </select>
        <button type="button" class="btn-row-del" onclick="supprimerLigne(this)"><i class="fas fa-times"></i></button>`;
    container.appendChild(div);
};

window.supprimerLigne = function(btn) {
    const rows = document.querySelectorAll('#tableauRows .tableau-row');
    if (rows.length > 1) btn.closest('.tableau-row').remove();
};

function collecterTableau() {
    const rows = document.querySelectorAll('#tableauRows .tableau-row');
    const data = [];
    rows.forEach(row => {
        const nom  = row.querySelector('.t-nom').value.trim();
        const note = row.querySelector('.t-note').value;
        const mention = row.querySelector('.t-mention').value;
        if (nom && note !== '') data.push({ nom, note: parseFloat(note), mention });
    });
    return data;
}

// ===== UPLOAD FORM =====
function initUploadForm() {
    const typeSelect   = document.getElementById('uploadType');
    const sessionGroup = document.getElementById('sessionGroupUpload');
    const resultGroup  = document.getElementById('resultTypeGroup');

    if (typeSelect) {
        typeSelect.addEventListener('change', () => {
            const v = typeSelect.value;
            const needsSession = (v === 'examens' || v === 'resultats_exam');
            const isResult     = (v === 'resultats_td' || v === 'resultats_exam');
            if (sessionGroup) sessionGroup.style.display = needsSession ? 'block' : 'none';
            if (resultGroup)  resultGroup.style.display  = isResult ? 'block' : 'none';
            if (!isResult) {
                document.getElementById('fileGroup').style.display    = 'block';
                document.getElementById('tableauGroup').style.display = 'none';
                currentResultType = 'fichier';
            }
        });
    }

    // Drag & drop
    const dz        = document.getElementById('fileDropZone');
    const fileInput = document.getElementById('uploadFichier');
    const fileChosen= document.getElementById('fileChosen');
    if (dz && fileInput) {
        fileInput.addEventListener('change', () => {
            const f = fileInput.files[0];
            if (f && fileChosen) fileChosen.textContent = '✓ ' + f.name;
        });
        ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag-over'); }));
        ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag-over'); }));
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

        const type     = document.getElementById('uploadType').value;
        const semestre = document.getElementById('uploadSemestre').value;
        const titre    = document.getElementById('uploadTitre').value.trim();
        const matiere  = document.getElementById('uploadMatiere').value;
        const annee    = document.getElementById('uploadAnnee').value;
        const session  = (type === 'examens' || type === 'resultats_exam')
            ? document.getElementById('uploadSession').value : null;

        if (!titre) { showToast('Ajoute un titre.', 'error'); return; }

        const isResult = (type === 'resultats_td' || type === 'resultats_exam');
        const progress = document.getElementById('uploadProgress');
        progress.style.display = 'block';
        form.style.display = 'none';

        try {
            const newRes = {
                id:       type + '_' + Date.now(),
                titre, matiere, annee, semestre,
                date:     new Date().toISOString()
            };
            if (session) newRes.session = session;

            if (isResult && currentResultType === 'tableau') {
                // Tableau de notes
                const tableau = collecterTableau();
                if (tableau.length === 0) { showToast('Ajoute au moins un étudiant.', 'e
