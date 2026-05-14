// js/admin/ui.js
// Utilitaires UI partagés

export function showView(viewId) {
    document.querySelectorAll('.admin-view').forEach(v => {
        v.hidden = v.id !== viewId;
    });
    // Header actions visibles uniquement hors de la vue login
    const headerActions = document.getElementById('header-actions');
    if (headerActions) {
        headerActions.hidden = (viewId === 'view-login');
    }
    // Bouton "← Liste" visible uniquement dans l'éditeur
    const backToList = document.getElementById('back-to-list');
    if (backToList) {
        backToList.hidden = (viewId !== 'view-editor');
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
}

let toastTimer = null;
export function toast(message, type = 'success', duration = 3500) {
    const el = document.getElementById('toast');
    const msg = document.getElementById('toast-message');
    if (!el || !msg) return;

    msg.textContent = message;
    el.className = 'admin-toast is-' + type;
    el.hidden = false;
    // Force reflow pour relancer la transition
    void el.offsetHeight;
    el.classList.add('is-visible');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        el.classList.remove('is-visible');
        setTimeout(() => { el.hidden = true; }, 300);
    }, duration);
}

export function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function escapeAttr(text) { return escapeHtml(text); }

export function disciplineLabel(id) {
    return { architecture: 'Architecture', design: 'Design', urbanisme: 'Urbanisme' }[id] || id;
}

export function statusLabel(id) {
    return { realise: 'Réalisé', 'en-cours': 'En cours', etude: 'En étude', concours: 'Concours' }[id] || id;
}

export function optimizeImage(url, width) {
    if (!url) return '';
    if (url.includes('cloudinary.com')) {
        return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
    }
    if (url.includes('images.unsplash.com') && !url.includes('?')) {
        return url + `?w=${width}&q=80&auto=format`;
    }
    return url;
}

export function setBtnLoading(btn, loading) {
    if (!btn) return;
    const label = btn.querySelector('.btn-label');
    const loader = btn.querySelector('.btn-loader');
    if (loading) {
        btn.disabled = true;
        if (label) label.style.opacity = '0.5';
        if (loader) loader.hidden = false;
    } else {
        btn.disabled = false;
        if (label) label.style.opacity = '1';
        if (loader) loader.hidden = true;
    }
}