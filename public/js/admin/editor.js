// js/admin/editor.js
// Vue éditeur — wizard 4 étapes
// Méta → Couverture → Sections → Prévisualisation

import * as api from './api.js';
import { showView, toast, setBtnLoading, escapeHtml, escapeAttr, disciplineLabel, statusLabel, optimizeImage } from './ui.js';
import { setupUploadZone } from './cloudinary.js';

// État local de l'éditeur
const state = {
    mode: 'create',          // 'create' | 'edit'
    editingId: null,
    currentStep: 1,
    uploadHandlers: {},      // map { target : { setUrl, getUrl, getIsUploading } }
    imageUrls: {},           // map des URLs uploadées (uniquement Cloudinary, jamais data:)
    activeUploads: 0         // compteur d'uploads en cours (bloque "Suivant")
};

const FORM_FIELDS_META = [
    'title', 'subtitle', 'discipline', 'status', 'year', 'surface',
    'location', 'client', 'role', 'partners', 'categories', 'description', 'featured'
];

let onSavedCallback = null;
let onBackCallback = null;

export function setupEditor({ onSaved, onBack }) {
    onSavedCallback = onSaved;
    onBackCallback = onBack;

    setupUploadZones();
    setupNavigation();
    setupSubmit();
}

// ============================================
// API PUBLIQUE
// ============================================
export function openCreate() {
    state.mode = 'create';
    state.editingId = null;
    state.currentStep = 1;
    state.imageUrls = {};
    resetForm();
    document.getElementById('editor-title').textContent = 'Nouveau projet';
    document.getElementById('editor-subtitle').textContent = 'Création d\'un projet';
    showStep(1);
    showView('view-editor');
}

export function openEdit(project) {
    state.mode = 'edit';
    state.editingId = project.id;
    state.currentStep = 1;
    state.imageUrls = {};
    resetForm();
    prefillForm(project);
    document.getElementById('editor-title').textContent = 'Modifier : ' + project.title;
    document.getElementById('editor-subtitle').textContent = 'Édition du projet';
    showStep(1);
    showView('view-editor');
}

// ============================================
// SETUP : UPLOAD ZONES
// ============================================
function setupUploadZones() {
    // Zone cover principale
    const coverZone = document.getElementById('upload-cover');
    if (coverZone) {
        state.uploadHandlers['cover'] = setupUploadZone(coverZone, {
            mini: false,
            onUploaded: (url, meta) => {
                // Ne stocker l'URL que si l'upload est terminé (pas pendant)
                if (meta?.uploading) {
                    state.activeUploads = (state.activeUploads || 0) + 1;
                    updateWizardNextState();
                } else {
                    if (typeof url === 'string') {
                        state.imageUrls['cover'] = url;
                        const urlInput = document.getElementById('f-cover-url');
                        if (urlInput && url) urlInput.value = url;
                    }
                    if (state.activeUploads > 0) state.activeUploads--;
                    updateWizardNextState();
                }
            }
        });
    }

    // Input URL cover (alternative)
    document.getElementById('f-cover-url')?.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        state.imageUrls['cover'] = url;
        state.uploadHandlers['cover']?.setUrl(url);
    });

    // Toutes les zones mini (sections)
    document.querySelectorAll('.upload-zone-mini').forEach(zone => {
        const target = zone.dataset.target;
        state.uploadHandlers[target] = setupUploadZone(zone, {
            mini: true,
            onUploaded: (url, meta) => {
                if (meta?.uploading) {
                    state.activeUploads = (state.activeUploads || 0) + 1;
                    updateWizardNextState();
                } else {
                    if (typeof url === 'string') {
                        state.imageUrls[target] = url;
                        const urlInput = document.querySelector(`.section-url-input[data-target="${target}"]`);
                        if (urlInput && url) urlInput.value = url;
                    }
                    if (state.activeUploads > 0) state.activeUploads--;
                    updateWizardNextState();
                    updateSectionStatus();
                }
            }
        });
    });

    // Inputs URL pour sections simples (hero, image-text, context)
    document.querySelectorAll('.section-url-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const target = e.target.dataset.target;
            const url = e.target.value.trim();
            state.imageUrls[target] = url;
            state.uploadHandlers[target]?.setUrl(url);
            updateSectionStatus();
        });
    });
}

// ============================================
// NAVIGATION ENTRE ÉTAPES
// ============================================
function setupNavigation() {
    document.getElementById('wizard-prev')?.addEventListener('click', () => {
        if (state.currentStep > 1) showStep(state.currentStep - 1);
    });

    document.getElementById('wizard-next')?.addEventListener('click', () => {
        if (validateStep(state.currentStep)) {
            if (state.currentStep < 4) showStep(state.currentStep + 1);
        }
    });

    // Click direct sur un indicateur d'étape (pour naviguer)
    document.querySelectorAll('.wizard-step').forEach(step => {
        step.addEventListener('click', () => {
            const target = parseInt(step.dataset.step, 10);
            if (target < state.currentStep) {
                // On peut TOUJOURS revenir en arrière
                showStep(target);
            } else if (target > state.currentStep) {
                // Pour avancer : valider chaque étape entre la courante et la cible
                for (let s = state.currentStep; s < target; s++) {
                    if (!validateStep(s)) return;
                }
                showStep(target);
            }
        });
    });
}

function showStep(step) {
    state.currentStep = step;

    // Indicateur
    document.querySelectorAll('.wizard-step').forEach(s => {
        const n = parseInt(s.dataset.step, 10);
        s.classList.toggle('is-active', n === step);
        s.classList.toggle('is-done', n < step);
    });

    // Panneaux
    document.querySelectorAll('.wizard-pane').forEach(p => {
        p.classList.toggle('is-active', parseInt(p.dataset.pane, 10) === step);
    });

    // Boutons du footer
    document.getElementById('wizard-prev').hidden = (step === 1);
    document.getElementById('wizard-next').hidden = (step === 4);
    document.getElementById('wizard-submit').hidden = (step !== 4);

    // Effacer erreur
    document.getElementById('wizard-error').hidden = true;

    // Si on entre dans la prévisualisation : générer
    if (step === 4) renderPreview();

    // Mettre à jour l'état du bouton Suivant (au cas où un upload est en cours)
    updateWizardNextState();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Désactive le bouton "Suivant" si une upload est en cours,
 * pour éviter de sauvegarder un data:image qui n'a pas fini d'uploader.
 */
function updateWizardNextState() {
    const nextBtn = document.getElementById('wizard-next');
    const submitBtn = document.getElementById('wizard-submit');
    const isUploading = state.activeUploads > 0;

    if (nextBtn) {
        nextBtn.disabled = isUploading;
        const label = nextBtn.querySelector('.btn-label') || nextBtn;
        if (isUploading) {
            nextBtn.dataset.originalText = nextBtn.dataset.originalText || nextBtn.textContent;
            nextBtn.textContent = '⏳ Upload en cours…';
        } else if (nextBtn.dataset.originalText) {
            nextBtn.textContent = nextBtn.dataset.originalText;
        }
    }
    if (submitBtn) {
        submitBtn.disabled = isUploading;
    }

    // Petit indicateur dans la zone d'erreur
    const errorEl = document.getElementById('wizard-error');
    if (isUploading && errorEl) {
        errorEl.textContent = 'Upload(s) en cours, patientez avant de continuer…';
        errorEl.hidden = false;
        errorEl.className = 'wizard-info';
    } else if (errorEl && errorEl.className === 'wizard-info') {
        errorEl.hidden = true;
        errorEl.className = 'wizard-error';
    }
}

// ============================================
// VALIDATION PAR ÉTAPE
// ============================================
function validateStep(step) {
    const errorEl = document.getElementById('wizard-error');
    errorEl.hidden = true;

    if (step === 1) {
        const title = document.getElementById('f-title').value.trim();
        if (title.length < 2) {
            showError('Le titre du projet est requis (min. 2 caractères)');
            return false;
        }
    }

    if (step === 2) {
        const cover = state.imageUrls['cover'] || document.getElementById('f-cover-url').value.trim();
        if (!cover) {
            showError('Une image de couverture est obligatoire');
            return false;
        }
    }

    // Étape 3 : pas de validation bloquante (sections optionnelles individuellement)

    return true;
}

function showError(msg) {
    const el = document.getElementById('wizard-error');
    el.textContent = msg;
    el.hidden = false;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ============================================
// SUBMIT FINAL
// ============================================
function setupSubmit() {
    const form = document.getElementById('wizard-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (state.currentStep !== 4) return;
        if (!validateStep(1) || !validateStep(2)) return;

        const project = collectFormData();
        const submitBtn = document.getElementById('wizard-submit');
        setBtnLoading(submitBtn, true);

        try {
            let result;
            if (state.mode === 'edit') {
                result = await api.updateProject(state.editingId, project);
                toast(`Projet "${project.title}" mis à jour`, 'success');
            } else {
                result = await api.createProject(project);
                toast(`Projet "${project.title}" créé`, 'success');
            }
            if (onSavedCallback) onSavedCallback(result.project);
        } catch (err) {
            showError(err.message);
        } finally {
            setBtnLoading(submitBtn, false);
        }
    });
}

// ============================================
// LECTURE / ÉCRITURE DU FORMULAIRE
// ============================================
function resetForm() {
    document.getElementById('wizard-form')?.reset();
    // Reset des previews d'upload
    Object.values(state.uploadHandlers).forEach(h => h?.setUrl(''));
    state.imageUrls = {};
    state.activeUploads = 0;
    updateSectionStatus();
    updateWizardNextState();
}

function prefillForm(project) {
    // Métadonnées
    document.getElementById('f-title').value = project.title || '';
    document.getElementById('f-subtitle').value = project.subtitle || '';
    document.getElementById('f-discipline').value = project.discipline || 'architecture';
    document.getElementById('f-status').value = project.status || 'realise';
    document.getElementById('f-year').value = project.year || '';
    document.getElementById('f-surface').value = project.surface || '';
    document.getElementById('f-location').value = project.location || '';
    document.getElementById('f-client').value = project.client || '';
    document.getElementById('f-role').value = project.role || '';
    document.getElementById('f-partners').value = (project.partners || []).join(', ');
    document.getElementById('f-categories').value = (project.categories || []).join(', ');
    document.getElementById('f-description').value = project.description || '';
    document.getElementById('f-featured').checked = !!project.featured;

    // Cover
    if (project.cover) {
        state.imageUrls['cover'] = project.cover;
        state.uploadHandlers['cover']?.setUrl(project.cover);
        const urlInput = document.getElementById('f-cover-url');
        if (urlInput) urlInput.value = project.cover;
    }

    // Sections
    const sectionMap = {};
    (project.sections || []).forEach(s => { sectionMap[s.type] = s; });

    // Section hero
    if (sectionMap.hero?.image) {
        state.imageUrls['hero'] = sectionMap.hero.image;
        state.uploadHandlers['hero']?.setUrl(sectionMap.hero.image);
        const urlInput = document.querySelector('.section-url-input[data-target="hero"]');
        if (urlInput) urlInput.value = sectionMap.hero.image;
    }

    // Section image-text
    if (sectionMap['image-text']) {
        const s = sectionMap['image-text'];
        if (s.image) {
            state.imageUrls['image-text'] = s.image;
            state.uploadHandlers['image-text']?.setUrl(s.image);
            const urlInput = document.querySelector('.section-url-input[data-target="image-text"]');
            if (urlInput) urlInput.value = s.image;
        }
        document.getElementById('f-image-text-title').value = s.title || '';
        document.getElementById('f-image-text-text').value = s.text || '';
    }

    // Section context
    if (sectionMap.context) {
        const s = sectionMap.context;
        if (s.image) {
            state.imageUrls['context'] = s.image;
            state.uploadHandlers['context']?.setUrl(s.image);
            const urlInput = document.querySelector('.section-url-input[data-target="context"]');
            if (urlInput) urlInput.value = s.image;
        }
        document.getElementById('f-context-caption').value = s.caption || '';
    }

    // Section gallery (3 slots)
    if (sectionMap.gallery?.images) {
        sectionMap.gallery.images.forEach((img, i) => {
            if (i < 3) {
                const target = `gallery-${i}`;
                if (img.url) {
                    state.imageUrls[target] = img.url;
                    state.uploadHandlers[target]?.setUrl(img.url);
                }
                const captionInput = document.querySelector(`.gallery-caption[data-slot="${i}"]`);
                if (captionInput) captionInput.value = img.caption || '';
            }
        });
    }

    // Section plans (jusqu'à 5 slots)
    if (sectionMap.plans?.images) {
        sectionMap.plans.images.forEach((img, i) => {
            if (i < 5) {
                const target = `plans-${i}`;
                if (img.url) {
                    state.imageUrls[target] = img.url;
                    state.uploadHandlers[target]?.setUrl(img.url);
                }
                const captionInput = document.querySelector(`.plans-caption[data-slot="${i}"]`);
                if (captionInput) captionInput.value = img.caption || '';
            }
        });
    }

    updateSectionStatus();
}

function collectFormData() {
    // Métadonnées
    const partners = document.getElementById('f-partners').value
        .split(',').map(s => s.trim()).filter(Boolean);
    const categories = document.getElementById('f-categories').value
        .split(',').map(s => s.trim()).filter(Boolean);
    const yearStr = document.getElementById('f-year').value.trim();

    const project = {
        title: document.getElementById('f-title').value.trim(),
        subtitle: document.getElementById('f-subtitle').value.trim(),
        discipline: document.getElementById('f-discipline').value,
        status: document.getElementById('f-status').value,
        year: yearStr ? parseInt(yearStr, 10) : null,
        surface: document.getElementById('f-surface').value.trim() || '—',
        location: document.getElementById('f-location').value.trim(),
        client: document.getElementById('f-client').value.trim(),
        role: document.getElementById('f-role').value.trim(),
        partners,
        categories,
        description: document.getElementById('f-description').value.trim(),
        featured: document.getElementById('f-featured').checked,
        cover: state.imageUrls['cover'] || document.getElementById('f-cover-url').value.trim(),
        sections: collectSections()
    };

    return project;
}

function collectSections() {
    const sections = [];

    // Hero
    const heroUrl = state.imageUrls['hero'] || '';
    if (heroUrl) {
        sections.push({ type: 'hero', image: heroUrl, alt: 'Vue principale' });
    }

    // Image-text
    const itUrl = state.imageUrls['image-text'] || '';
    const itTitle = document.getElementById('f-image-text-title').value.trim();
    const itText = document.getElementById('f-image-text-text').value.trim();
    if (itUrl || itText) {
        sections.push({
            type: 'image-text',
            image: itUrl,
            title: itTitle,
            text: itText
        });
    }

    // Context
    const ctxUrl = state.imageUrls['context'] || '';
    const ctxCaption = document.getElementById('f-context-caption').value.trim();
    if (ctxUrl) {
        sections.push({
            type: 'context',
            image: ctxUrl,
            caption: ctxCaption
        });
    }

    // Gallery (3 slots)
    const galleryImages = [];
    for (let i = 0; i < 3; i++) {
        const url = state.imageUrls[`gallery-${i}`];
        const caption = document.querySelector(`.gallery-caption[data-slot="${i}"]`)?.value.trim();
        if (url) galleryImages.push({ url, caption: caption || '' });
    }
    if (galleryImages.length > 0) {
        sections.push({ type: 'gallery', images: galleryImages });
    }

    // Plans (jusqu'à 5 slots)
    const planImages = [];
    for (let i = 0; i < 5; i++) {
        const url = state.imageUrls[`plans-${i}`];
        const caption = document.querySelector(`.plans-caption[data-slot="${i}"]`)?.value.trim();
        if (url) planImages.push({ url, caption: caption || '' });
    }
    if (planImages.length > 0) {
        sections.push({ type: 'plans', images: planImages });
    }

    return sections;
}

function updateSectionStatus() {
    // Hero
    document.getElementById('status-hero').textContent =
        state.imageUrls['hero'] ? '✓ Rempli' : 'À remplir';

    // Image-text
    const hasImageText = state.imageUrls['image-text'] ||
        document.getElementById('f-image-text-text')?.value.trim();
    document.getElementById('status-image-text').textContent =
        hasImageText ? '✓ Rempli' : 'À remplir';

    // Context
    document.getElementById('status-context').textContent =
        state.imageUrls['context'] ? '✓ Rempli' : 'À remplir';

    // Gallery
    const galleryCount = [0, 1, 2].filter(i => state.imageUrls[`gallery-${i}`]).length;
    document.getElementById('status-gallery').textContent = `${galleryCount} / 3 images`;

    // Plans (jusqu'à 5)
    const plansCount = [0, 1, 2, 3, 4].filter(i => state.imageUrls[`plans-${i}`]).length;
    document.getElementById('status-plans').textContent = `${plansCount} / 5 plans`;
}

// ============================================
// PRÉVISUALISATION (étape 4)
// ============================================
function renderPreview() {
    const container = document.getElementById('preview-container');
    if (!container) return;

    const p = collectFormData();
    const sectionsCount = p.sections.length;
    const cover = p.cover ? optimizeImage(p.cover, 1200) : '';

    container.innerHTML = `
    <div class="preview-card">
      <div class="preview-cover">
        ${cover ? `<img src="${escapeAttr(cover)}" alt="${escapeAttr(p.title)}">` : '<p>Pas de couverture</p>'}
      </div>
      <div class="preview-body">
        <p class="preview-eyebrow">
          ${escapeHtml(disciplineLabel(p.discipline))} ·
          ${escapeHtml(statusLabel(p.status))}
          ${p.year ? ' · ' + p.year : ''}
        </p>
        <h2 class="preview-title">${escapeHtml(p.title || '(sans titre)')}</h2>
        ${p.subtitle ? `<p class="preview-subtitle">${escapeHtml(p.subtitle)}</p>` : ''}

        <dl class="preview-meta">
          ${p.location ? `<div><dt>Lieu</dt><dd>${escapeHtml(p.location)}</dd></div>` : ''}
          ${p.surface ? `<div><dt>Surface</dt><dd>${escapeHtml(p.surface)}</dd></div>` : ''}
          ${p.client ? `<div><dt>Client</dt><dd>${escapeHtml(p.client)}</dd></div>` : ''}
          ${p.role ? `<div><dt>Rôle</dt><dd>${escapeHtml(p.role)}</dd></div>` : ''}
          ${p.partners.length ? `<div><dt>Partenaires</dt><dd>${escapeHtml(p.partners.join(', '))}</dd></div>` : ''}
          ${p.categories.length ? `<div><dt>Catégories</dt><dd>${escapeHtml(p.categories.join(', '))}</dd></div>` : ''}
        </dl>

        ${p.description ? `<p class="preview-description">${escapeHtml(p.description)}</p>` : ''}

        <p class="preview-sections-count">
          <strong>${sectionsCount}</strong> section${sectionsCount > 1 ? 's' : ''} remplie${sectionsCount > 1 ? 's' : ''} sur 5
        </p>

        ${p.featured ? '<p class="preview-badge">⭐ Mis en avant dans la home</p>' : ''}
      </div>
    </div>
  `;
}

// Bouton "← Liste" du header → revenir à la liste
document.addEventListener('DOMContentLoaded', () => {
    // Sera attaché par main.js via onBack
});