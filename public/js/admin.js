/* ============================================
   ADMIN.JS — Logique de l'interface admin
   ============================================
   ⚠️ À configurer avant utilisation : remplir
   les valeurs CLOUDINARY_CLOUD et CLOUDINARY_PRESET
   ci-dessous avec les vraies valeurs.
   ============================================ */

(function () {
    'use strict';

    // ============================================
    // CONFIGURATION — À MODIFIER
    // ============================================
    const CLOUDINARY_CLOUD = 'diqycra58';        // ex: "dxxxxxxxx"
    const CLOUDINARY_PRESET = 'mcjohnson_unsigned';   // le preset créé dans Cloudinary
    const CLOUDINARY_FOLDER = 'mcjohnson/projects';   // dossier de destination

    // ============================================
    // ÉTAT GLOBAL DU MODULE
    // ============================================
    const state = {
        token: null,
        coverImage: null,           // { url, publicId }
        galleryImages: [],          // [ { url, publicId, caption } ]
        currentProject: null
    };

    // ============================================
    // INIT
    // ============================================
    document.addEventListener('DOMContentLoaded', function () {
        // Vérifier si déjà connecté (token en sessionStorage)
        const savedToken = sessionStorage.getItem('admin_token');
        const expiresAt = parseInt(sessionStorage.getItem('admin_token_exp') || '0', 10);

        if (savedToken && expiresAt > Date.now()) {
            state.token = savedToken;
            showView('form');
        } else {
            sessionStorage.removeItem('admin_token');
            sessionStorage.removeItem('admin_token_exp');
            showView('login');
        }

        initLoginForm();
        initProjectForm();
        initImageUploads();
        initPreview();
        initLogout();
    });

    // ============================================
    // GESTION DES VUES
    // ============================================
    function showView(name) {
        const views = ['login', 'form', 'preview', 'success'];
        views.forEach(v => {
            const el = document.getElementById('view-' + v);
            if (el) el.hidden = (v !== name);
        });

        // Header actions visibles uniquement quand connecté
        const headerActions = document.getElementById('header-actions');
        if (headerActions) {
            headerActions.hidden = (name === 'login');
        }

        // Scroll en haut
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ============================================
    // LOGIN
    // ============================================
    function initLoginForm() {
        const form = document.getElementById('login-form');
        if (!form) return;

        const errorEl = document.getElementById('login-error');
        const btn = document.getElementById('login-btn');

        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            hideError(errorEl);

            const email = form.email.value.trim();
            const password = form.password.value;

            if (!email || !password) {
                showError(errorEl, 'Email et mot de passe requis');
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Connexion…';

            try {
                const resp = await fetch('/api/admin-auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await resp.json();

                if (!resp.ok || !data.success) {
                    showError(errorEl, data.error || 'Identifiants incorrects');
                    btn.disabled = false;
                    btn.textContent = 'Se connecter';
                    return;
                }

                // Stocker le token
                state.token = data.token;
                sessionStorage.setItem('admin_token', data.token);
                sessionStorage.setItem('admin_token_exp', String(data.expiresAt));

                // Reset du formulaire
                form.reset();

                showView('form');
                showToast('Connecté', 'success');

            } catch (err) {
                console.error(err);
                showError(errorEl, 'Erreur de connexion. Réessayez.');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Se connecter';
            }
        });
    }

    // ============================================
    // LOGOUT
    // ============================================
    function initLogout() {
        const btn = document.getElementById('logout-btn');
        if (!btn) return;

        btn.addEventListener('click', function () {
            if (confirm('Vous déconnecter ?')) {
                sessionStorage.removeItem('admin_token');
                sessionStorage.removeItem('admin_token_exp');
                state.token = null;
                showView('login');
            }
        });
    }

    // ============================================
    // FORMULAIRE PROJET
    // ============================================
    function initProjectForm() {
        const form = document.getElementById('project-form');
        if (!form) return;

        // Auto-génération du slug depuis le titre
        const titleInput = document.getElementById('title');
        const slugInput = document.getElementById('slug');
        let slugManuallyEdited = false;

        titleInput.addEventListener('input', function () {
            if (!slugManuallyEdited) {
                slugInput.value = slugify(titleInput.value);
            }
        });

        slugInput.addEventListener('input', function () {
            slugManuallyEdited = slugInput.value !== '';
        });

        // Compteur description
        const descInput = document.getElementById('description');
        const counter = document.getElementById('desc-counter');
        descInput.addEventListener('input', function () {
            counter.textContent = descInput.value.length;
        });

        // Bouton annuler
        document.getElementById('cancel-btn').addEventListener('click', function () {
            if (confirm('Abandonner les modifications en cours ?')) {
                resetForm();
            }
        });

        // Soumission → prévisualisation
        form.addEventListener('submit', function (e) {
            e.preventDefault();

            const errorEl = document.getElementById('form-error');
            hideError(errorEl);

            const project = collectFormData();
            const errors = validateProject(project);

            if (errors.length > 0) {
                showError(errorEl, errors.join(' · '));
                return;
            }

            state.currentProject = project;
            renderPreview(project);
            showView('preview');
        });
    }

    // ============================================
    // COLLECTE DES DONNÉES DU FORMULAIRE
    // ============================================
    function collectFormData() {
        const form = document.getElementById('project-form');

        // Catégories cochées
        const categories = Array.from(
            form.querySelectorAll('input[name="categories"]:checked')
        ).map(cb => cb.value);

        // Partenaires (split par virgule)
        const partnersRaw = form.partners.value.trim();
        const partners = partnersRaw
            ? partnersRaw.split(',').map(s => s.trim()).filter(Boolean)
            : [];

        // Construction de l'objet projet
        const project = {
            id: form.slug.value.trim(),
            slug: form.slug.value.trim(),
            title: form.title.value.trim(),
            subtitle: form.subtitle.value.trim(),
            categories: categories,
            status: form.status.value,
            year: form.year.value ? parseInt(form.year.value, 10) : null,
            location: form.location.value.trim(),
            client: form.client.value.trim(),
            surface: form.surface.value.trim(),
            role: form.role.value.trim(),
            partners: partners,
            description: form.description.value.trim(),
            cover: state.coverImage ? state.coverImage.url : '',
            gallery: state.galleryImages.map(img => ({
                url: img.url,
                caption: img.caption || ''
            })),
            featured: form.featured.checked,
            order: null // calculé côté serveur
        };

        return project;
    }

    // ============================================
    // VALIDATION CÔTÉ CLIENT
    // ============================================
    function validateProject(p) {
        const errors = [];

        if (!p.title) errors.push('Titre requis');
        if (!p.slug) errors.push('Slug requis');
        if (!/^[a-z0-9-]+$/.test(p.slug)) errors.push('Slug invalide (minuscules, chiffres, tirets)');
        if (!p.subtitle) errors.push('Sous-titre requis');
        if (!p.categories || p.categories.length === 0) errors.push('Au moins une catégorie');
        if (!p.status) errors.push('Statut requis');
        if (!p.description) errors.push('Description requise');
        if (p.description && p.description.length < 50) errors.push('Description trop courte (50 caractères min)');
        if (!p.cover) errors.push('Image de couverture requise');

        return errors;
    }

    // ============================================
    // UPLOAD CLOUDINARY
    // ============================================
    function initImageUploads() {
        initCoverUpload();
        initGalleryUpload();
    }

    // --- Cover ---
    function initCoverUpload() {
        const zone = document.getElementById('cover-upload-zone');
        const input = document.getElementById('cover-input');
        const placeholder = document.getElementById('cover-placeholder');
        const preview = document.getElementById('cover-preview');
        const previewImg = document.getElementById('cover-preview-img');
        const removeBtn = document.getElementById('cover-remove');
        const progress = document.getElementById('cover-progress');

        // Click → ouvre le sélecteur de fichier
        placeholder.addEventListener('click', () => input.click());

        // Drag & drop
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('is-dragging');
        });
        zone.addEventListener('dragleave', () => zone.classList.remove('is-dragging'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('is-dragging');
            const file = e.dataTransfer.files[0];
            if (file) handleCoverFile(file);
        });

        // Sélection fichier
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleCoverFile(file);
        });

        // Retirer
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.coverImage = null;
            previewImg.src = '';
            preview.hidden = true;
            placeholder.hidden = false;
            input.value = '';
        });

        async function handleCoverFile(file) {
            if (!validateImageFile(file)) return;

            placeholder.hidden = true;
            progress.hidden = false;

            try {
                const result = await uploadToCloudinary(file);
                state.coverImage = { url: result.secure_url, publicId: result.public_id };
                previewImg.src = result.secure_url;
                preview.hidden = false;
            } catch (err) {
                console.error(err);
                showToast('Échec du téléversement', 'error');
                placeholder.hidden = false;
            } finally {
                progress.hidden = true;
            }
        }
    }

    // --- Galerie ---
    function initGalleryUpload() {
        const input = document.getElementById('gallery-input');
        const addBtn = document.getElementById('gallery-add-btn');
        const list = document.getElementById('gallery-list');

        addBtn.addEventListener('click', () => input.click());

        input.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            input.value = '';

            // Limite à 10 images au total
            const remaining = 10 - state.galleryImages.length;
            if (files.length > remaining) {
                showToast(`Limite de 10 images. ${remaining} restant(es).`, 'error');
                files.splice(remaining);
            }

            for (const file of files) {
                if (!validateImageFile(file)) continue;
                await addGalleryImage(file);
            }
        });

        async function addGalleryImage(file) {
            const id = 'gallery-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

            // Affiche un placeholder de loading
            const item = document.createElement('div');
            item.className = 'gallery-item gallery-item-loading';
            item.id = id;
            item.textContent = 'Téléversement…';
            list.appendChild(item);

            try {
                const result = await uploadToCloudinary(file);

                const imgData = {
                    id: id,
                    url: result.secure_url,
                    publicId: result.public_id,
                    caption: ''
                };
                state.galleryImages.push(imgData);

                // Remplace le placeholder par l'image
                item.classList.remove('gallery-item-loading');
                item.textContent = '';
                item.innerHTML = `
          <img src="${escapeAttr(result.secure_url)}" alt="">
          <button type="button" class="gallery-item-remove" data-id="${escapeAttr(id)}" aria-label="Retirer">×</button>
          <div class="gallery-item-caption">
            <input type="text" placeholder="Légende (optionnel)" data-id="${escapeAttr(id)}" maxlength="100">
          </div>
        `;
            } catch (err) {
                console.error(err);
                item.remove();
                showToast('Échec du téléversement de "' + file.name + '"', 'error');
            }
        }

        // Délégation : retrait + caption
        list.addEventListener('click', (e) => {
            if (e.target.classList.contains('gallery-item-remove')) {
                const id = e.target.getAttribute('data-id');
                state.galleryImages = state.galleryImages.filter(img => img.id !== id);
                document.getElementById(id).remove();
            }
        });

        list.addEventListener('input', (e) => {
            if (e.target.matches('.gallery-item-caption input')) {
                const id = e.target.getAttribute('data-id');
                const img = state.galleryImages.find(img => img.id === id);
                if (img) img.caption = e.target.value;
            }
        });
    }

    // --- Validation fichier image ---
    function validateImageFile(file) {
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showToast('Format non supporté (JPG, PNG, WebP uniquement)', 'error');
            return false;
        }
        if (file.size > 10 * 1024 * 1024) {
            showToast('Image trop lourde (max 10 Mo)', 'error');
            return false;
        }
        return true;
    }

    // --- Upload effectif vers Cloudinary ---
    async function uploadToCloudinary(file) {
        if (CLOUDINARY_CLOUD === 'TON_CLOUD_NAME') {
            throw new Error('Configuration Cloudinary manquante dans admin.js');
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_PRESET);
        formData.append('folder', CLOUDINARY_FOLDER);

        const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`;
        const resp = await fetch(url, { method: 'POST', body: formData });

        if (!resp.ok) {
            const err = await resp.text();
            console.error('Erreur Cloudinary :', err);
            throw new Error('Échec upload Cloudinary');
        }

        return await resp.json();
    }

    // ============================================
    // PRÉVISUALISATION
    // ============================================
    function initPreview() {
        document.getElementById('back-to-form-btn').addEventListener('click', function () {
            showView('form');
        });

        document.getElementById('publish-btn').addEventListener('click', publishProject);

        document.getElementById('add-another-btn').addEventListener('click', function () {
            resetForm();
            showView('form');
        });
    }

    function renderPreview(project) {
        const container = document.getElementById('preview-project');

        const categoriesLabels = (project.categories || [])
            .map(c => CATEGORY_LABELS[c] || c)
            .join(' · ');

        const statusLabel = STATUS_LABELS[project.status] || project.status;

        const galleryHtml = project.gallery && project.gallery.length > 0
            ? `<div class="preview-gallery">
          ${project.gallery.map(g =>
                `<img src="${escapeAttr(g.url)}" alt="${escapeAttr(g.caption || '')}">`
            ).join('')}
        </div>`
            : '';

        container.innerHTML = `
      <img src="${escapeAttr(project.cover)}" alt="${escapeAttr(project.title)}" class="preview-cover">
      <div class="preview-body">
        <p class="preview-categories">${escapeHtml(categoriesLabels)}</p>
        <h2 class="preview-title">${escapeHtml(project.title)}</h2>
        <p class="preview-subtitle">${escapeHtml(project.subtitle)}</p>

        <dl class="preview-meta">
          <div class="preview-meta-item"><dt>Statut</dt><dd>${escapeHtml(statusLabel)}</dd></div>
          <div class="preview-meta-item"><dt>Année</dt><dd>${escapeHtml(project.year || '—')}</dd></div>
          <div class="preview-meta-item"><dt>Lieu</dt><dd>${escapeHtml(project.location || '—')}</dd></div>
          <div class="preview-meta-item"><dt>Surface</dt><dd>${escapeHtml(project.surface || '—')}</dd></div>
          <div class="preview-meta-item"><dt>Client</dt><dd>${escapeHtml(project.client || '—')}</dd></div>
          <div class="preview-meta-item"><dt>Notre rôle</dt><dd>${escapeHtml(project.role || '—')}</dd></div>
          ${project.partners && project.partners.length > 0 ? `
            <div class="preview-meta-item" style="grid-column: span 2;"><dt>Partenaires</dt><dd>${escapeHtml(project.partners.join(', '))}</dd></div>
          ` : ''}
        </dl>

        <p class="preview-description">${escapeHtml(project.description)}</p>
        ${galleryHtml}
      </div>
    `;
    }

    // ============================================
    // PUBLICATION (commit GitHub via API)
    // ============================================
    async function publishProject() {
        const btn = document.getElementById('publish-btn');
        const errorEl = document.getElementById('publish-error');
        hideError(errorEl);

        if (!state.currentProject) {
            showError(errorEl, 'Aucun projet à publier');
            return;
        }

        if (!state.token) {
            showError(errorEl, 'Session expirée. Reconnectez-vous.');
            setTimeout(() => showView('login'), 1500);
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Publication…';

        try {
            const resp = await fetch('/api/admin-save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + state.token
                },
                body: JSON.stringify({ project: state.currentProject })
            });

            const data = await resp.json();

            if (resp.status === 401) {
                showError(errorEl, 'Session expirée. Reconnectez-vous.');
                sessionStorage.removeItem('admin_token');
                setTimeout(() => showView('login'), 1500);
                return;
            }

            if (!resp.ok || !data.success) {
                showError(errorEl, data.error || 'Erreur lors de la publication');
                btn.disabled = false;
                btn.textContent = 'Publier le projet';
                return;
            }

            // Succès !
            const projectSlug = state.currentProject.slug;
            const viewLink = document.getElementById('view-project-link');
            if (viewLink) viewLink.href = '/projet?id=' + encodeURIComponent(projectSlug);

            resetForm();
            showView('success');

        } catch (err) {
            console.error(err);
            showError(errorEl, 'Erreur réseau. Réessayez.');
            btn.disabled = false;
            btn.textContent = 'Publier le projet';
        }
    }

    // ============================================
    // RESET FORMULAIRE
    // ============================================
    function resetForm() {
        const form = document.getElementById('project-form');
        if (form) form.reset();

        state.coverImage = null;
        state.galleryImages = [];
        state.currentProject = null;

        // Reset visuels
        document.getElementById('cover-placeholder').hidden = false;
        document.getElementById('cover-preview').hidden = true;
        document.getElementById('cover-preview-img').src = '';
        document.getElementById('gallery-list').innerHTML = '';
        document.getElementById('desc-counter').textContent = '0';

        const btn = document.getElementById('publish-btn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Publier le projet';
        }
    }

    // ============================================
    // UTILITAIRES
    // ============================================
    const CATEGORY_LABELS = {
        'infrastructure': 'Infrastructure',
        'residentiel': 'Résidentiel',
        'hotellerie': 'Hôtellerie',
        'tertiaire': 'Tertiaire',
        'concours': 'Concours',
        'education': 'Éducation'
    };

    const STATUS_LABELS = {
        'realise': 'Réalisé',
        'etude': 'En étude',
        'concours': 'Concours'
    };

    function slugify(text) {
        return String(text)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .substring(0, 80);
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(text) {
        return escapeHtml(text);
    }

    function showError(el, msg) {
        if (!el) return;
        el.textContent = msg;
        el.hidden = false;
    }

    function hideError(el) {
        if (!el) return;
        el.textContent = '';
        el.hidden = true;
    }

    let toastTimer = null;
    function showToast(message, type) {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.className = 'toast' + (type ? ' is-' + type : '');
        toast.hidden = false;

        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
    }

})();