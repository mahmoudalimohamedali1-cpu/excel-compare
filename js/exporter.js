/**
 * Exporter Module
 * Handles export to Excel, CSV, and PDF formats
 */

const Exporter = {
    /**
     * Export report to Excel
     * @param {Object} report - Comparison report
     * @param {string} reportType - Type of report (all, matched, etc.)
     * @returns {Blob} Excel file blob
     */
    toExcel(report, reportType = 'all') {
        const workbook = XLSX.utils.book_new();

        // Summary sheet
        const summaryData = [
            ['تقرير المقارنة'],
            [''],
            ['الإحصائيات', 'القيمة'],
            ['إجمالي السجلات', report.summary.totalRecords],
            ['المتطابقة', report.summary.exactMatches],
            ['المتشابهة', report.summary.fuzzyMatches],
            ['المفقودة', report.summary.differences],
            ['التناقضات', report.summary.conflicts],
            [''],
            ['عمود المفتاح', report.keyColumn],
            ['عدد الشيتات', report.summary.sheetsCompared]
        ];
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'ملخص');

        // Results sheets based on type
        const sheetsToExport = this.getSheetsToExport(report, reportType);

        sheetsToExport.forEach(({ name, data }) => {
            if (data.length > 0) {
                const sheet = XLSX.utils.json_to_sheet(data);
                XLSX.utils.book_append_sheet(workbook, sheet, name);
            }
        });

        // Generate file
        const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    },

    /**
     * Export report to CSV
     * @param {Object} report - Comparison report
     * @param {string} reportType - Type of report
     * @returns {Blob} CSV file blob
     */
    toCSV(report, reportType = 'all') {
        const data = this.prepareDataForExport(report, reportType);

        if (data.length === 0) {
            return new Blob(['لا توجد بيانات للتصدير'], { type: 'text/csv;charset=utf-8' });
        }

        // Get headers from first row
        const headers = Object.keys(data[0]);

        // Build CSV content
        let csv = '\uFEFF'; // BOM for UTF-8
        csv += headers.join(',') + '\n';

        data.forEach(row => {
            const values = headers.map(header => {
                let value = row[header];
                if (value === null || value === undefined) value = '';
                value = String(value).replace(/"/g, '""');
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = `"${value}"`;
                }
                return value;
            });
            csv += values.join(',') + '\n';
        });

        return new Blob([csv], { type: 'text/csv;charset=utf-8' });
    },

    /**
     * Export report to PDF
     * @param {Object} report - Comparison report
     * @param {string} reportType - Type of report
     * @returns {Promise<Blob>} PDF file blob
     */
    async toPDF(report, reportType = 'all') {
        // Use jsPDF if available
        if (typeof jspdf === 'undefined' && typeof jsPDF === 'undefined') {
            throw new Error('مكتبة PDF غير متاحة');
        }

        const { jsPDF } = typeof jspdf !== 'undefined' ? jspdf : window;
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // Add Arabic font support (if available)
        doc.setFont('helvetica');

        // Title
        doc.setFontSize(20);
        doc.text('Excel Comparison Report', 148, 20, { align: 'center' });

        // Summary section
        doc.setFontSize(12);
        let y = 40;

        doc.text(`Total Records: ${report.summary.totalRecords}`, 20, y);
        y += 8;
        doc.text(`Exact Matches: ${report.summary.exactMatches}`, 20, y);
        y += 8;
        doc.text(`Similar: ${report.summary.fuzzyMatches}`, 20, y);
        y += 8;
        doc.text(`Missing: ${report.summary.differences}`, 20, y);
        y += 8;
        doc.text(`Conflicts: ${report.summary.conflicts}`, 20, y);
        y += 15;

        // Table
        const data = this.prepareDataForExport(report, reportType);

        if (data.length > 0) {
            const headers = Object.keys(data[0]).filter(k => !k.startsWith('_'));
            const tableData = data.slice(0, 50).map(row =>
                headers.map(h => String(row[h] || '').substring(0, 30))
            );

            doc.autoTable({
                head: [headers],
                body: tableData,
                startY: y,
                theme: 'grid',
                styles: {
                    fontSize: 8,
                    cellPadding: 2
                },
                headStyles: {
                    fillColor: [59, 130, 246],
                    textColor: 255
                }
            });
        }

        return doc.output('blob');
    },

    /**
     * Prepare data for export
     * @param {Object} report - Comparison report
     * @param {string} reportType - Type of report
     * @returns {Array} Formatted data array
     */
    prepareDataForExport(report, reportType) {
        let records;

        switch (reportType) {
            case 'matched':
                records = report.results.exactMatches;
                break;
            case 'similar':
                records = report.results.fuzzyMatches;
                break;
            case 'missing':
                records = report.results.differences;
                break;
            case 'conflicts':
                records = report.results.conflicts;
                break;
            default:
                records = report.results.all;
        }

        return records.map(record => {
            const row = {};

            // Key column
            row[report.keyColumn] = record.key;
            row['الحالة'] = this.getStatusLabel(record.status);
            row['نسبة التطابق'] = record.analysis?.matchScore
                ? Math.round(record.analysis.matchScore * 100) + '%'
                : '-';

            // Values from each sheet
            report.sheets.forEach((sheet, idx) => {
                const presence = record.sheetPresence[idx];
                const sheetLabel = `شيت ${idx + 1}`;

                if (presence) {
                    row[sheetLabel] = 'موجود ✓';
                } else {
                    row[sheetLabel] = 'غير موجود ✗';
                }
            });

            return row;
        });
    },

    /**
     * Get sheets to export based on report type
     * @param {Object} report - Comparison report
     * @param {string} reportType - Type of report
     * @returns {Array} Sheets configuration
     */
    getSheetsToExport(report, reportType) {
        const sheets = [];

        if (reportType === 'all' || reportType === 'matched') {
            sheets.push({
                name: 'متطابق',
                data: this.prepareSheetData(report.results.exactMatches, report)
            });
        }

        if (reportType === 'all' || reportType === 'similar') {
            sheets.push({
                name: 'متشابه',
                data: this.prepareSheetData(report.results.fuzzyMatches, report)
            });
        }

        if (reportType === 'all' || reportType === 'missing') {
            sheets.push({
                name: 'مفقود',
                data: this.prepareSheetData(report.results.differences, report)
            });
        }

        if (reportType === 'all' || reportType === 'conflicts') {
            sheets.push({
                name: 'تناقضات',
                data: this.prepareSheetData(report.results.conflicts, report)
            });
        }

        return sheets;
    },

    /**
     * Prepare sheet data for Excel export
     * @param {Array} records - Records to export
     * @param {Object} report - Full report
     * @returns {Array} Formatted data
     */
    prepareSheetData(records, report) {
        return records.map(record => {
            const row = {};
            row[report.keyColumn] = record.key;
            row['الحالة'] = this.getStatusLabel(record.status);

            // Add data from each sheet
            record.sheetPresence.forEach((presence, idx) => {
                const prefix = `شيت${idx + 1}_`;
                if (presence) {
                    Object.keys(presence).forEach(key => {
                        if (!key.startsWith('_')) {
                            row[prefix + key] = presence[key];
                        }
                    });
                }
            });

            return row;
        });
    },

    /**
     * Get status label in Arabic
     * @param {string} status - Status code
     * @returns {string} Arabic label
     */
    getStatusLabel(status) {
        const labels = {
            matched: 'متطابق ✓',
            similar: 'متشابه ≈',
            missing: 'مفقود ?',
            conflict: 'تناقض !'
        };
        return labels[status] || status;
    },

    /**
     * Download file
     * @param {Blob} blob - File blob
     * @param {string} filename - File name
     */
    download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Export and download
     * @param {Object} report - Comparison report
     * @param {string} format - Export format (excel, csv, pdf)
     * @param {string} reportType - Type of report
     */
    async exportAndDownload(report, format, reportType = 'all') {
        const timestamp = new Date().toISOString().slice(0, 10);
        let blob, filename;

        switch (format) {
            case 'excel':
                blob = this.toExcel(report, reportType);
                filename = `comparison_report_${timestamp}.xlsx`;
                break;
            case 'csv':
                blob = this.toCSV(report, reportType);
                filename = `comparison_report_${timestamp}.csv`;
                break;
            case 'pdf':
                blob = await this.toPDF(report, reportType);
                filename = `comparison_report_${timestamp}.pdf`;
                break;
            default:
                throw new Error('صيغة غير مدعومة');
        }

        this.download(blob, filename);
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Exporter;
}
