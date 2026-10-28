// IndexedDB helpers for caching the last opened file
const DB_NAME = 'md-viewer';
const STORE_NAME = 'files';
const LAST_FILE_KEY = 'lastFile';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveLastFile(name, contents) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ name, contents, savedAt: Date.now() }, LAST_FILE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function loadLastFile() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(LAST_FILE_KEY);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const contentArea = document.getElementById('content');
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');

    let currentZoom = 16; // base font size in px

    zoomInBtn.addEventListener('click', () => {
        currentZoom += 2;
        contentArea.style.setProperty('--base-font-size', `${currentZoom}px`);
    });

    zoomOutBtn.addEventListener('click', () => {
        currentZoom = Math.max(10, currentZoom - 2);
        contentArea.style.setProperty('--base-font-size', `${currentZoom}px`);
    });

    function render(name, contents) {
        // Parse markdown using marked
        contentArea.innerHTML = marked.parse(contents);
        document.title = name ? `${name} - MD Viewer` : 'MD Viewer';
    }

    // Restore the previously opened file (works offline since it is stored locally)
    loadLastFile()
        .then(file => {
            if (file && typeof file.contents === 'string') {
                render(file.name, file.contents);
            }
        })
        .catch(err => console.log('Failed to restore last file: ', err));

    // Ask the browser not to evict our stored data under storage pressure
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(() => {});
    }

    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const contents = e.target.result;
            render(file.name, contents);
            // Scroll to top when new file is loaded
            window.scrollTo(0, 0);
            saveLastFile(file.name, contents)
                .catch(err => console.log('Failed to cache file: ', err));
        };

        reader.onerror = function() {
            contentArea.innerHTML = '<div class="empty-state"><p>ファイルの読み込みに失敗しました。</p></div>';
        };

        reader.readAsText(file);
        // Allow re-selecting the same file to reload it
        fileInput.value = '';
    });
});
