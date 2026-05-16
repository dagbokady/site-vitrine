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
        // /auto/ : Cloudinary détecte automatiquement le type (image OU vidéo).
        // → permet d'uploader des .mp4 / .webm pour le slider hero.
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`);

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

    // État interne : upload en cours ?
    let isUploading = false;

    function showPreview(url, isVideoOverride) {
        // Détecte si c'est une vidéo (soit forçé via flag, soit par URL/extension)
        const isVid = isVideoOverride === true
            || /^data:video\//i.test(url)
            || /\.(mp4|webm|mov)(\?|$)/i.test(url);

        if (preview) {
            // Si vidéo : remplace le <img> par un <video> au runtime
            if (isVid) {
                let video = preview.querySelector('video');
                if (!video) {
                    video = document.createElement('video');
                    video.muted = true;
                    video.loop = true;
                    video.autoplay = true;
                    video.playsInline = true;
                    video.style.cssText = (img && img.style.cssText) || '';
                    video.style.width = '100%';
                    video.style.maxHeight = '280px';
                    video.style.objectFit = 'cover';
                    if (img) img.replaceWith(video);
                    else preview.prepend(video);
                }
                video.src = url;
                if (img) img.style.display = 'none';
            } else {
                // Image : restaurer <img> si elle a été remplacée par une <video>
                let video = preview.querySelector('video');
                if (video && !img) {
                    // Recréer une img
                    const newImg = document.createElement('img');
                    video.replaceWith(newImg);
                } else if (video) {
                    video.remove();
                }
                const imgEl = preview.querySelector('img') || img;
                if (imgEl) {
                    imgEl.src = url;
                    imgEl.style.display = '';
                }
            }
            preview.hidden = false;
        }
        if (trigger) trigger.hidden = true;
    }

    function hidePreview() {
        if (preview) {
            const video = preview.querySelector('video');
            if (video) video.remove();
            if (img) img.src = '';
            preview.hidden = true;
        }
        if (trigger) trigger.hidden = false;
        fileInput.value = '';
    }

    function showUploadingOverlay() {
        let overlay = zoneEl.querySelector('.upload-progress-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'upload-progress-overlay';
            overlay.innerHTML = `
        <div class="upload-spinner-mini"></div>
        <p class="upload-progress-text">Upload en cours…</p>
        <p class="upload-progress-percent">0%</p>
      `;
            zoneEl.appendChild(overlay);
        }
        overlay.hidden = false;
        return overlay;
    }

    function hideUploadingOverlay() {
        const overlay = zoneEl.querySelector('.upload-progress-overlay');
        if (overlay) overlay.hidden = true;
    }

    function setProgress(percent) {
        const el = zoneEl.querySelector('.upload-progress-percent');
        if (el) el.textContent = percent + '%';
    }

    async function handleFile(file) {
        if (!file) return;
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) {
            alert('Seules les images et les vidéos sont acceptées');
            return;
        }
        // Limite : 10 Mo pour les images, 50 Mo pour les vidéos
        const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
            alert(`Fichier trop lourd (max ${isVideo ? '50 Mo pour une vidéo' : '10 Mo pour une image'})`);
            return;
        }

        // Aperçu local immédiat : pour image c'est une dataURL,
        // pour vidéo on affiche aussi la dataURL (le navigateur la lira)
        const reader = new FileReader();
        reader.onload = (e) => showPreview(e.target.result, isVideo);
        reader.readAsDataURL(file);

        // Marquer comme en cours d'upload + UI
        isUploading = true;
        trigger.disabled = true;
        zoneEl.classList.add('is-uploading');
        showUploadingOverlay();

        // Notifier l'éditeur que l'upload commence (pour bloquer "Suivant")
        if (typeof onUploaded === 'function') {
            onUploaded(null, { uploading: true });
        }

        try {
            const url = await uploadImage(file, setProgress);
            // Maintenant SEULEMENT, on stocke l'URL définitive
            showPreview(url);
            isUploading = false;
            zoneEl.classList.remove('is-uploading');
            hideUploadingOverlay();
            if (typeof onUploaded === 'function') {
                onUploaded(url, { uploading: false });
            }
        } catch (err) {
            hidePreview();
            isUploading = false;
            zoneEl.classList.remove('is-uploading');
            hideUploadingOverlay();
            alert('Erreur d\'upload : ' + err.message + '\n\nRéessayez en cliquant sur la zone.');
            if (typeof onUploaded === 'function') {
                onUploaded('', { uploading: false, error: true });
            }
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
            // Reset l'état d'upload aussi (au cas où on supprime pendant l'upload)
            isUploading = false;
            zoneEl.classList.remove('is-uploading');
            hideUploadingOverlay();
            if (typeof onUploaded === 'function') onUploaded('', { uploading: false });
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

    // Méthode publique pour pré-remplir + état
    return {
        setUrl: (url) => {
            if (url) showPreview(url);
            else hidePreview();
        },
        getUrl: () => img?.src || '',
        getIsUploading: () => isUploading
    };
}