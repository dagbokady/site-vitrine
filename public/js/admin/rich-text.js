// js/admin/rich-text.js
// Mini-éditeur de texte enrichi : gras + 3 couleurs + 2 tailles
// Utilise contenteditable + spans HTML simples (pas de markdown ni de framework).
// Le HTML produit est très limité : <strong>, <span style="color:..."> et <span class="text-large">.

const COLORS = {
    orange: '#E63A11',
    noir: '#0A0A0A',
    gris: '#6B7280'
};

/**
 * Transforme un <textarea> ou un <div> en mini-éditeur enrichi.
 * Retourne un objet { getHtml(), setHtml(html), getElement() }.
 */
export function setupRichText(targetEl, { placeholder = '', minHeight = 80 } = {}) {
    // Si c'est un textarea : on le cache et crée un contenteditable à côté
    const isTextarea = targetEl.tagName === 'TEXTAREA';

    let hidden, editable, toolbar;

    if (isTextarea) {
        // Conserve le textarea pour la soumission, mais on bosse sur un div à côté
        targetEl.style.display = 'none';
        hidden = targetEl;

        const wrap = document.createElement('div');
        wrap.className = 'rich-text-wrap';
        targetEl.parentElement.insertBefore(wrap, targetEl);

        // Toolbar
        toolbar = document.createElement('div');
        toolbar.className = 'rich-text-toolbar';
        toolbar.innerHTML = `
      <button type="button" class="rt-btn" data-action="bold" title="Gras (Ctrl+B)"><strong>B</strong></button>
      <span class="rt-sep"></span>
      <button type="button" class="rt-btn rt-color rt-color-orange" data-action="color" data-value="${COLORS.orange}" title="Orange"></button>
      <button type="button" class="rt-btn rt-color rt-color-noir" data-action="color" data-value="${COLORS.noir}" title="Noir"></button>
      <button type="button" class="rt-btn rt-color rt-color-gris" data-action="color" data-value="${COLORS.gris}" title="Gris"></button>
      <span class="rt-sep"></span>
      <button type="button" class="rt-btn" data-action="size" data-value="large" title="Texte large (titre)">A+</button>
      <button type="button" class="rt-btn" data-action="size" data-value="normal" title="Texte normal">A</button>
      <span class="rt-sep"></span>
      <button type="button" class="rt-btn" data-action="clear" title="Effacer le formatage">⌫</button>
    `;
        wrap.appendChild(toolbar);

        // Zone éditable
        editable = document.createElement('div');
        editable.className = 'rich-text-editable';
        editable.contentEditable = 'true';
        editable.setAttribute('data-placeholder', placeholder || targetEl.getAttribute('placeholder') || '');
        editable.style.minHeight = minHeight + 'px';
        editable.innerHTML = targetEl.value || '';
        wrap.appendChild(editable);

        // Toolbar actions
        toolbar.addEventListener('mousedown', (e) => {
            // Empêche la perte du focus / sélection
            e.preventDefault();
        });
        toolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('.rt-btn');
            if (!btn) return;
            e.preventDefault();
            const action = btn.dataset.action;
            const value = btn.dataset.value;
            applyAction(editable, action, value);
            syncToTextarea();
        });

        // Sync à chaque saisie
        editable.addEventListener('input', syncToTextarea);
        editable.addEventListener('blur', syncToTextarea);

        function syncToTextarea() {
            hidden.value = editable.innerHTML;
            // Déclenche un event input sur le textarea pour les listeners externes
            hidden.dispatchEvent(new Event('input', { bubbles: true }));
        }
    } else {
        // Cas non géré (juste contenteditable direct sans toolbar) — TODO si besoin
        return null;
    }

    return {
        getHtml: () => editable.innerHTML,
        setHtml: (html) => {
            editable.innerHTML = html || '';
            hidden.value = editable.innerHTML;
        },
        getElement: () => editable
    };
}

/**
 * Applique une action au contenu sélectionné.
 * Utilise document.execCommand (déprécié mais marche partout, c'est suffisant ici).
 */
function applyAction(editable, action, value) {
    editable.focus();

    if (action === 'bold') {
        document.execCommand('bold', false, null);
    } else if (action === 'color') {
        document.execCommand('foreColor', false, value);
    } else if (action === 'size') {
        if (value === 'large') {
            wrapSelection(editable, 'span', { className: 'rt-large' });
        } else {
            // "normal" = retire la classe rt-large des spans
            unwrapWithClass(editable, 'rt-large');
        }
    } else if (action === 'clear') {
        document.execCommand('removeFormat', false, null);
    }
}

function wrapSelection(editable, tag, { className } = {}) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const wrapper = document.createElement(tag);
    if (className) wrapper.className = className;
    try {
        wrapper.appendChild(range.extractContents());
        range.insertNode(wrapper);
    } catch (e) {
        // Le DOM n'aime pas toujours qu'on extrait/inserts à travers des frontières
        console.warn('wrapSelection failed:', e);
    }
}

function unwrapWithClass(editable, className) {
    const spans = editable.querySelectorAll('.' + className);
    spans.forEach(span => {
        const parent = span.parentNode;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.removeChild(span);
    });
}