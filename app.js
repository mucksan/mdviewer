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
        // Re-apply the active search to the new document
        if (!searchBar.hidden) {
            runSearch();
        }
    }

    // Keyword search
    const searchBar = document.getElementById('searchBar');
    const searchInput = document.getElementById('searchInput');
    const searchCount = document.getElementById('searchCount');
    let hits = [];
    let currentHit = -1;

    function clearHighlights() {
        contentArea.querySelectorAll('mark.search-hit').forEach(mark => {
            const parent = mark.parentNode;
            parent.replaceChild(document.createTextNode(mark.textContent), mark);
            parent.normalize();
        });
        hits = [];
        currentHit = -1;
    }

    function highlight(keyword) {
        const lowerKeyword = keyword.toLowerCase();
        const walker = document.createTreeWalker(contentArea, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) {
            if (walker.currentNode.nodeValue.toLowerCase().includes(lowerKeyword)) {
                textNodes.push(walker.currentNode);
            }
        }

        textNodes.forEach(node => {
            const text = node.nodeValue;
            const lowerText = text.toLowerCase();
            const fragment = document.createDocumentFragment();
            let pos = 0;
            let index;
            while ((index = lowerText.indexOf(lowerKeyword, pos)) !== -1) {
                fragment.appendChild(document.createTextNode(text.slice(pos, index)));
                const mark = document.createElement('mark');
                mark.className = 'search-hit';
                mark.textContent = text.slice(index, index + keyword.length);
                fragment.appendChild(mark);
                hits.push(mark);
                pos = index + keyword.length;
            }
            fragment.appendChild(document.createTextNode(text.slice(pos)));
            node.parentNode.replaceChild(fragment, node);
        });
    }

    function goToHit(index) {
        if (hits.length === 0) {
            return;
        }
        if (currentHit >= 0) {
            hits[currentHit].classList.remove('current');
        }
        currentHit = (index + hits.length) % hits.length;
        const mark = hits[currentHit];
        mark.classList.add('current');
        mark.scrollIntoView({ block: 'center' });
        searchCount.textContent = `${currentHit + 1}/${hits.length}`;
    }

    function runSearch() {
        clearHighlights();
        const keyword = searchInput.value.trim();
        if (!keyword) {
            searchCount.textContent = '';
            return;
        }
        highlight(keyword);
        if (hits.length === 0) {
            searchCount.textContent = '0件';
            return;
        }
        goToHit(0);
    }

    function openSearch() {
        searchBar.hidden = false;
        searchInput.focus();
        searchInput.select();
    }

    function closeSearch() {
        searchBar.hidden = true;
        clearHighlights();
        searchCount.textContent = '';
    }

    document.getElementById('searchToggle').addEventListener('click', () => {
        if (searchBar.hidden) {
            openSearch();
        } else {
            closeSearch();
        }
    });
    document.getElementById('searchClose').addEventListener('click', closeSearch);
    document.getElementById('searchPrev').addEventListener('click', () => goToHit(currentHit - 1));
    document.getElementById('searchNext').addEventListener('click', () => goToHit(currentHit + 1));

    searchInput.addEventListener('input', runSearch);
    searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.isComposing) {
            e.preventDefault();
            goToHit(e.shiftKey ? currentHit - 1 : currentHit + 1);
        } else if (e.key === 'Escape') {
            closeSearch();
        }
    });

    // Ctrl/Cmd+F opens the in-app search instead of the browser's
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            openSearch();
        }
    });

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
