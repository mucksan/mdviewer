document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const contentArea = document.getElementById('content');

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
