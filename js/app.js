/**
 * Main Application Module
 * Coordinates all modules and manages application state
 */

const App = {
    /**
     * Application state
     */
    state: {
        files: [],
        parsedData: [],
        currentReport: null,
        currentFilter: 'all',
        searchQuery: ''
    },

    /**
     * Initialize application
     */
    init() {
        console.log('🚀 Excel Smart Compare - Initializing...');

        // Initialize UI
        UI.init();
        UI.initTheme();

        // Check for required libraries
        this.checkDependencies();

        console.log('✅ Application ready');
    },

    /**
     * Check for required libraries
     */
    checkDependencies() {
        if (typeof XLSX === 'undefined') {
            UI.showToast('مكتبة SheetJS غير متاحة - قد يؤثر ذلك على قراءة الملفات', 'warning', 5000);
        }
    },

    /**
     * Handle file upload
     * @param {FileList} files - Uploaded files
     */
    async handleFileUpload(files) {
        const validation = FileParser.validateFiles(files);

        if (validation.errors.length > 0) {
            validation.errors.forEach(err => UI.showToast(err, 'error'));
        }

        if (validation.validFiles.length === 0) {
            return;
        }

        UI.showLoading('جاري قراءة الملفات...');

        try {
            for (let i = 0; i < validation.validFiles.length; i++) {
                const file = validation.validFiles[i];
                UI.updateProgress((i / validation.validFiles.length) * 100);

                const parsed = await FileParser.parseFile(file);
                this.state.parsedData.push(parsed);
                UI.addFileToList(parsed, this.state.parsedData.length - 1);
            }

            UI.updateProgress(100);
            UI.showToast(`تم تحميل ${validation.validFiles.length} ملف بنجاح`, 'success');

            // Update UI based on loaded files
            this.updateSettingsAfterUpload();

        } catch (error) {
            console.error('Upload error:', error);
            UI.showToast(error.message || 'حدث خطأ أثناء قراءة الملفات', 'error');
        } finally {
            UI.hideLoading();
        }
    },

    /**
     * Update settings panel after file upload
     */
    updateSettingsAfterUpload() {
        if (this.state.parsedData.length >= 2) {
            UI.showSettings();
            UI.setCompareEnabled(true);

            // Get all columns from first file for key detection
            const firstFile = this.state.parsedData[0];
            if (firstFile.sheets.length > 0) {
                const firstSheet = firstFile.sheets[0];
                const columnOptions = KeyDetector.createColumnOptions(
                    firstSheet.headers,
                    firstSheet.rows
                );
                UI.updateKeyColumnOptions(columnOptions);
            }
        } else if (this.state.parsedData.length === 1) {
            UI.showSettings();
            UI.setCompareEnabled(false);
            UI.showToast('قم برفع ملف آخر للمقارنة', 'warning');
        }
    },

    /**
     * Remove a file from the list
     * @param {number} index - File index
     */
    removeFile(index) {
        this.state.parsedData.splice(index, 1);

        // Reindex remaining files
        UI.clearFileList();
        this.state.parsedData.forEach((file, i) => {
            UI.addFileToList(file, i);
        });

        // Update settings
        if (this.state.parsedData.length < 2) {
            UI.setCompareEnabled(false);
            UI.hideResults();
        }

        this.updateSettingsAfterUpload();
    },

    /**
     * Run comparison
     */
    async runComparison() {
        const keyColumn = UI.elements.keyColumnSelect?.value;
        const threshold = parseFloat(UI.elements.thresholdSelect?.value || '0.75');

        if (!keyColumn) {
            UI.showToast('الرجاء اختيار عمود المفتاح', 'warning');
            return;
        }

        if (this.state.parsedData.length < 2) {
            UI.showToast('يجب رفع ملفين على الأقل للمقارنة', 'warning');
            return;
        }

        UI.showLoading('جاري المقارنة...');

        try {
            // Prepare sheets for comparison
            const sheets = FileParser.prepareForComparison(this.state.parsedData);

            UI.updateProgress(30);

            // Find the actual key column name
            const firstSheet = sheets.sheets[0];
            const keyColumnName = firstSheet.headers.find(h => h.index === parseInt(keyColumn))?.name || keyColumn;

            UI.updateProgress(50);

            // Run comparison
            const report = Reporter.compareSheets(sheets.sheets, keyColumnName, {
                threshold
            });

            UI.updateProgress(80);

            // Store report
            this.state.currentReport = report;
            this.state.currentFilter = 'all';

            // Update UI
            this.displayResults(report);

            UI.updateProgress(100);
            UI.showToast('تمت المقارنة بنجاح', 'success');
            UI.showResults();

        } catch (error) {
            console.error('Comparison error:', error);
            UI.showToast(error.message || 'حدث خطأ أثناء المقارنة', 'error');
        } finally {
            UI.hideLoading();
        }
    },

    /**
     * Display comparison results
     * @param {Object} report - Comparison report
     */
    displayResults(report) {
        // Update statistics
        const stats = Reporter.getStatistics(report);
        UI.updateStats(stats);

        // Update tab counts
        UI.updateTabCounts({
            all: report.summary.totalRecords,
            matched: report.summary.exactMatches,
            similar: report.summary.fuzzyMatches,
            missing: report.summary.differences,
            conflicts: report.summary.conflicts
        });

        // Render table
        const rows = Reporter.formatForTable(report, this.state.currentFilter);
        UI.renderTable(rows, report);
    },

    /**
     * Filter results by type
     * @param {string} filterType - Filter type
     */
    filterResults(filterType) {
        this.state.currentFilter = filterType;

        if (!this.state.currentReport) return;

        let rows = Reporter.formatForTable(this.state.currentReport, filterType);

        // Apply search filter if exists
        if (this.state.searchQuery) {
            rows = this.applySearchFilter(rows, this.state.searchQuery);
        }

        UI.renderTable(rows, this.state.currentReport);
    },

    /**
     * Search results
     * @param {string} query - Search query
     */
    searchResults(query) {
        this.state.searchQuery = query;

        if (!this.state.currentReport) return;

        let rows = Reporter.formatForTable(this.state.currentReport, this.state.currentFilter);

        if (query) {
            rows = this.applySearchFilter(rows, query);
        }

        UI.renderTable(rows, this.state.currentReport);
    },

    /**
     * Apply search filter to rows
     * @param {Array} rows - Table rows
     * @param {string} query - Search query
     * @returns {Array} Filtered rows
     */
    applySearchFilter(rows, query) {
        const normalizedQuery = query.toLowerCase();

        return rows.filter(row => {
            return Object.values(row).some(value => {
                if (typeof value === 'string' || typeof value === 'number') {
                    return String(value).toLowerCase().includes(normalizedQuery);
                }
                return false;
            });
        });
    },

    /**
     * Export report
     * @param {string} format - Export format
     */
    async exportReport(format) {
        if (!this.state.currentReport) {
            UI.showToast('لا توجد نتائج للتصدير', 'warning');
            return;
        }

        UI.showLoading('جاري إعداد التقرير...');

        try {
            await Exporter.exportAndDownload(
                this.state.currentReport,
                format,
                this.state.currentFilter
            );
            UI.showToast('تم تحميل التقرير بنجاح', 'success');
        } catch (error) {
            console.error('Export error:', error);
            UI.showToast(error.message || 'حدث خطأ أثناء التصدير', 'error');
        } finally {
            UI.hideLoading();
        }
    },

    /**
     * Reset application state
     */
    reset() {
        this.state = {
            files: [],
            parsedData: [],
            currentReport: null,
            currentFilter: 'all',
            searchQuery: ''
        };

        UI.clearFileList();
        UI.hideSettings();
        UI.hideResults();
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
}
