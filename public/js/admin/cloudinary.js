// js/admin/cloudinary.js
// Upload direct vers Cloudinary depuis le navigateur (preset unsigned)

const CLOUD_NAME = 'diqycra58';
const UPLOAD_PRESET = 'mcjohnson_unsigned';

/**
 * Upload un File vers Cloudinary, retourne l'URL secure_url.
 * onProgress(percent) : callback optionnel.
 */
export async function uploadImage(file, onProgress) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && typeof onProgress === 'function') {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        });

        xhr.onload = () => {
            try {
                const data = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
                    resolve(data.secure_url);
                } else {
                    reject(new Error(data.error?.message || 'Échec de l\'upload Cloudinary'));
                }
            } catch (e) {
                reject(new Error('Réponse Cloudinary invalide'));
            }
        };

        xhr.onerror = () => reject(new Error('Erreur réseau pendant l\'upload'));
        xhr.send(formData);
    });
}

/**
 * Configure une zone d'upload (drag & drop + click).
 * Le zone DOM doit contenir : input[type=file], .upload-trigger(-mini), .upload-preview(-mini), img, .upload-remove(-mini)
 */
export function setupUploadZone(zoneEl, { onUploaded, mini = false } = {}) {
    const fileInput = zoneEl.querySelector('input[type="file"]');
    const trigger = zoneEl.querySelector(mini ? '.upload-trigger-mini' : '.upload-trigger');
    const preview = zoneEl.querySelector(mini ? '.upload-preview-mini' : '.upload-preview');
    const img = preview?.querySelector('img');
    const removeBtn = zoneEl.querySelector(mini ? '.upload-remove-mini' : '.upload-remove');

    if (!fileInput || !trigger) return;

    function showPreview(url) {
        if (img) img.src = url;
        if (preview) preview.hidden = false;
        if (trigger) trigger.hidden = true;
    }

    function hidePreview() {
        if (img) img.src = '';
        if (preview) preview.hidden = true;
        if (trigger) trigger.hidden = false;
        fileInput.value = '';
    }

    async function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            alert('Seules les images sont acceptées');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert('Image trop lourde (max 10 Mo)');
            return;
        }

        // Aperçu local immédiat
        const reader = new FileReader();
        reader.onload = (e) => showPreview(e.target.result);
        reader.readAsDataURL(file);

        // Upload Cloudinary
        trigger.disabled = true;
        try {
            const url = await uploadImage(file);
            showPreview(url);
            if (typeof onUploaded === 'function') onUploaded(url);
        } catch (err) {
            hidePreview();
            alert('Erreur d\'upload : ' + err.message);
        } finally {
            trigger.disabled = false;
        }
    }

    // Click sur le trigger → ouvre le file picker
    trigger.addEventListener('click', () => fileInput.click());

    // Sélection d'un fichier
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    });

    // Bouton supprimer
    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            hidePreview();
            if (typeof onUploaded === 'function') onUploaded('');
        });
    }

    // Drag & drop
    ['dragenter', 'dragover'].forEach(ev => {
        zoneEl.addEventListener(ev, (e) => {
            e.preventDefault();
            e.stopPropagation();
            zoneEl.classList.add('is-dragover');
        });
    });
    ['dragleave', 'drop'].forEach(ev => {
        zoneEl.addEventListener(ev, (e) => {
            e.preventDefault();
            e.stopPropagation();
            zoneEl.classList.remove('is-dragover');
        });
    });
    zoneEl.addEventListener('drop', (e) => {
        const file = e.dataTransfer?.files?.[0];
        if (file) handleFile(file);
    });

    // Méthode publique pour pré-remplir (utile en mode édition)
    return {
        setUrl: (url) => {
            if (url) showPreview(url);
            else hidePreview();
        },
        getUrl: () => img?.src || ''
    };
}