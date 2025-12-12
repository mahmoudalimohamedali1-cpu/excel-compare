/**
 * UI Module
 * Handles all UI interactions and DOM manipulations
 */

const UI = {
    /**
     * DOM element references
     */
    elements: {},

    /**
     * Initialize UI
     */
    init() {
        this.cacheElements();
        this.bindEvents();
        this.initTooltips();
    },

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            // Upload
            uploadZone: document.getElementById('uploadZone'),
            fileInput: document.getElementById('fileInput'),
            fileList: document.getElementById('fileList'),

            // Settings
            settingsPanel: document.getElementById('settingsPanel'),
            keyColumnSelect: document.getElementById('keyColumnSelect'),
            thresholdSelect: document.getElementById('thresholdSelect'),
            compareBtn: document.getElementById('compareBtn'),

            // Results
            resultsSection: document.getElementById('resultsSection'),
            statsGrid: document.getElementById('statsGrid'),
            tabButtons: document.querySelectorAll('.tab'),
            resultsTable: document.getElementById('resultsTable'),
            searchInput: document.getElementById('searchInput'),

            // Export
            exportExcel: document.getElementById('exportExcel'),
            exportCSV: document.getElementById('exportCSV'),
            exportPDF: document.getElementById('exportPDF'),

            // Loading
            loadingOverlay: document.getElementById('loadingOverlay'),
            loadingText: document.getElementById('loadingText'),
            progressFill: document.getElementById('progressFill'),

            // Toast container
            toastContainer: document.getElementById('toastContainer'),

            // Theme toggle
            themeToggle: document.getElementById('themeToggle')
        };
    },

    /**
     * Bind event listeners
     */
    bindEvents() {
        // File upload
        if (this.elements.uploadZone) {
            this.elements.uploadZone.addEventListener('click', () => {
                this.elements.fileInput?.click();
            });

            this.elements.uploadZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                this.elements.uploadZone.classList.add('dragover');
            });

            this.elements.uploadZone.addEventListener('dragleave', () => {
                this.elements.uploadZone.classList.remove('dragover');
            });

            this.elements.uploadZone.addEventListener('drop', (e) => {
                e.preventDefault();
                this.elements.uploadZone.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    App.handleFileUpload(e.dataTransfer.files);
                }
            });
        }

        if (this.elements.fileInput) {
            this.elements.fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    App.handleFileUpload(e.target.files);
                }
            });
        }

        // Compare button
        if (this.elements.compareBtn) {
            this.elements.compareBtn.addEventListener('click', () => {
                App.runComparison();
            });
        }

        // Tabs
        this.elements.tabButtons.forEach(tab => {
            tab.addEventListener('click', () => {
                this.setActiveTab(tab.dataset.tab);
                App.filterResults(tab.dataset.tab);
            });
        });

        // Search
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', (e) => {
                App.searchResults(e.target.value);
            });
        }

        // Export buttons
        if (this.elements.exportExcel) {
            this.elements.exportExcel.addEventListener('click', () => {
                App.exportReport('excel');
            });
        }

        if (this.elements.exportCSV) {
            this.elements.exportCSV.addEventListener('click', () => {
                App.exportReport('csv');
            });
        }

        if (this.elements.exportPDF) {
            this.elements.exportPDF.addEventListener('click', () => {
                App.exportReport('pdf');
            });
        }

        // Theme toggle
        if (this.elements.themeToggle) {
            this.elements.themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
    },

    /**
     * Initialize tooltips
     */
    initTooltips() {
        // Add tooltip functionality if needed
    },

    /**
     * Show file in list
     * @param {Object} fileData - Parsed file data
     * @param {number} index - File index
     */
    addFileToList(fileData, index) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.dataset.index = index;

        fileItem.innerHTML = `
            <span class="file-icon">${FileParser.getFileIcon(fileData.fileName)}</span>
            <div class="file-info">
                <div class="file-name">${fileData.fileName}</div>
                <div class="file-size">${fileData.totalRows} صف • ${fileData.sheetCount} شيت</div>
            </div>
            <button class="file-remove" title="إزالة">✕</button>
        `;

        fileItem.querySelector('.file-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            App.removeFile(index);
            fileItem.remove();
        });

        this.elements.fileList.appendChild(fileItem);
    },

    /**
     * Update key column select options
     * @param {Array} options - Column options
     */
    updateKeyColumnOptions(options) {
        if (!this.elements.keyColumnSelect) return;

        this.elements.keyColumnSelect.innerHTML = `
            <option value="">-- اختر عمود المفتاح --</option>
            ${options.map(opt => `
                <option value="${opt.value}" ${opt.isRecommended ? 'selected' : ''}>
                    ${opt.label}
                </option>
            `).join('')}
        `;
    },

    /**
     * Show settings panel
     */
    showSettings() {
        if (this.elements.settingsPanel) {
            this.elements.settingsPanel.classList.remove('section-hidden');
        }
    },

    /**
     * Hide settings panel
     */
    hideSettings() {
        if (this.elements.settingsPanel) {
            this.elements.settingsPanel.classList.add('section-hidden');
        }
    },

    /**
     * Show results section
     */
    showResults() {
        if (this.elements.resultsSection) {
            this.elements.resultsSection.classList.remove('section-hidden');
        }
    },

    /**
     * Hide results section
     */
    hideResults() {
        if (this.elements.resultsSection) {
            this.elements.resultsSection.classList.add('section-hidden');
        }
    },

    /**
     * Update statistics cards
     * @param {Object} stats - Statistics object
     */
    updateStats(stats) {
        if (!this.elements.statsGrid) return;

        this.elements.statsGrid.innerHTML = stats.cards.map(card => `
            <div class="stat-card ${card.color}">
                <div class="stat-icon">${card.icon}</div>
                <div class="stat-value">${card.value}</div>
                <div class="stat-label">${card.label}</div>
            </div>
        `).join('');
    },

    /**
     * Update tab counts
     * @param {Object} counts - Tab counts
     */
    updateTabCounts(counts) {
        this.elements.tabButtons.forEach(tab => {
            const count = counts[tab.dataset.tab] || 0;
            const countSpan = tab.querySelector('.tab-count');
            if (countSpan) {
                countSpan.textContent = count;
            }
        });
    },

    /**
     * Set active tab
     * @param {string} tabId - Tab identifier
     */
    setActiveTab(tabId) {
        this.elements.tabButtons.forEach(tab => {
            if (tab.dataset.tab === tabId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    },

    /**
     * Render results table
     * @param {Array} rows - Table rows
     * @param {Object} report - Full report for column info
     */
    renderTable(rows, report) {
        if (!this.elements.resultsTable) return;

        if (rows.length === 0) {
            this.elements.resultsTable.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📭</div>
                    <div class="empty-state-title">لا توجد نتائج</div>
                    <div class="empty-state-text">لا توجد بيانات مطابقة للفلتر المحدد</div>
                </div>
            `;
            return;
        }

        // Build table headers
        const headers = [report.keyColumn, 'الحالة'];
        report.sheets.forEach((sheet, idx) => {
            headers.push(`شيت ${idx + 1}`);
        });

        const tableHTML = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            ${headers.map(h => `<th>${h}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(row => this.renderTableRow(row, report)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        this.elements.resultsTable.innerHTML = tableHTML;
    },

    /**
     * Render a single table row
     * @param {Object} row - Row data
     * @param {Object} report - Report data
     * @returns {string} HTML string
     */
    renderTableRow(row, report) {
        const statusInfo = Matcher.getMatchStatus(row._score || 0);

        let cells = `
            <td>${row._key}</td>
            <td><span class="status-badge ${row._status}">${statusInfo.icon} ${statusInfo.label}</span></td>
        `;

        report.sheets.forEach((sheet, idx) => {
            const presence = row._analysis?.presentInSheets
                ? !row._analysis.missingInSheets?.includes(idx)
                : true;

            if (presence) {
                cells += `<td class="cell-${row._status}">✓ موجود</td>`;
            } else {
                cells += `<td class="cell-missing">✗ غير موجود</td>`;
            }
        });

        return `<tr>${cells}</tr>`;
    },

    /**
     * Show loading overlay
     * @param {string} message - Loading message
     */
    showLoading(message = 'جاري التحميل...') {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.add('active');
            if (this.elements.loadingText) {
                this.elements.loadingText.textContent = message;
            }
        }
    },

    /**
     * Hide loading overlay
     */
    hideLoading() {
        if (this.elements.loadingOverlay) {
            this.elements.loadingOverlay.classList.remove('active');
        }
    },

    /**
     * Update progress bar
     * @param {number} percent - Progress percentage
     */
    updateProgress(percent) {
        if (this.elements.progressFill) {
            this.elements.progressFill.style.width = `${percent}%`;
        }
    },

    /**
     * Show toast notification
     * @param {string} message - Toast message
     * @param {string} type - Toast type (success, error, warning)
     * @param {number} duration - Duration in ms
     */
    showToast(message, type = 'success', duration = 3000) {
        if (!this.elements.toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || '!'}</span>
            <span class="toast-message">${message}</span>
        `;

        this.elements.toastContainer.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    /**
     * Toggle theme
     */
    toggleTheme() {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);

        if (this.elements.themeToggle) {
            this.elements.themeToggle.textContent = newTheme === 'light' ? '🌙' : '☀️';
        }
    },

    /**
     * Initialize theme from storage
     */
    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        if (this.elements.themeToggle) {
            this.elements.themeToggle.textContent = savedTheme === 'light' ? '🌙' : '☀️';
        }
    },

    /**
     * Clear file list
     */
    clearFileList() {
        if (this.elements.fileList) {
            this.elements.fileList.innerHTML = '';
        }
    },

    /**
     * Enable/disable compare button
     * @param {boolean} enabled - Enable state
     */
    setCompareEnabled(enabled) {
        if (this.elements.compareBtn) {
            this.elements.compareBtn.disabled = !enabled;
        }
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UI;
}
