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

    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const contents = e.target.result;
            // Parse markdown using marked
            const html = marked.parse(contents);
            contentArea.innerHTML = html;
            // Scroll to top when new file is loaded
            window.scrollTo(0, 0);
        };
        
        reader.onerror = function() {
            contentArea.innerHTML = '<div class="empty-state"><p>ファイルの読み込みに失敗しました。</p></div>';
        };

        reader.readAsText(file);
    });
});
