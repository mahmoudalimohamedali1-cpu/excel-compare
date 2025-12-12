/**
 * File Parser Module
 * Handles parsing of Excel (XLSX, XLS) and CSV files using SheetJS
 */

const FileParser = {
    /**
     * Supported file extensions
     */
    supportedExtensions: ['.xlsx', '.xls', '.csv'],

    /**
     * Parse a file and extract data
     * @param {File} file - File object to parse
     * @returns {Promise<Object>} Parsed data with sheets and columns
     */
    async parseFile(file) {
        const extension = this.getExtension(file.name);

        if (!this.isSupported(file.name)) {
            throw new Error(`نوع الملف غير مدعوم: ${extension}`);
        }

        try {
            const data = await this.readFileAsArrayBuffer(file);
            const workbook = XLSX.read(data, {
                type: 'array',
                cellDates: true,
                cellNF: true,
                cellStyles: true
            });

            return this.extractWorkbookData(workbook, file.name);
        } catch (error) {
            console.error('Error parsing file:', error);
            throw new Error(`فشل في قراءة الملف: ${file.name}`);
        }
    },

    /**
     * Read file as ArrayBuffer
     * @param {File} file - File to read
     * @returns {Promise<ArrayBuffer>} File content
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(new Uint8Array(e.target.result));
            reader.onerror = (e) => reject(e);
            reader.readAsArrayBuffer(file);
        });
    },

    /**
     * Extract data from workbook
     * @param {Object} workbook - SheetJS workbook
     * @param {string} fileName - Original file name
     * @returns {Object} Extracted data
     */
    extractWorkbookData(workbook, fileName) {
        const sheets = [];

        for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                defval: '',
                blankrows: false
            });

            if (jsonData.length === 0) continue;

            const headers = jsonData[0].map((h, i) => ({
                index: i,
                name: String(h || `Column ${i + 1}`).trim(),
                originalName: h
            }));

            const rows = jsonData.slice(1).map((row, rowIndex) => {
                const rowData = {};
                headers.forEach((header, colIndex) => {
                    rowData[header.name] = row[colIndex] !== undefined ? row[colIndex] : '';
                });
                rowData._rowIndex = rowIndex;
                return rowData;
            });

            sheets.push({
                name: sheetName,
                headers,
                rows,
                rowCount: rows.length,
                columnCount: headers.length
            });
        }

        return {
            fileName,
            sheets,
            sheetCount: sheets.length,
            totalRows: sheets.reduce((sum, s) => sum + s.rowCount, 0)
        };
    },

    /**
     * Get file extension
     * @param {string} fileName - File name
     * @returns {string} Extension in lowercase
     */
    getExtension(fileName) {
        return fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    },

    /**
     * Check if file type is supported
     * @param {string} fileName - File name
     * @returns {boolean} True if supported
     */
    isSupported(fileName) {
        const ext = this.getExtension(fileName);
        return this.supportedExtensions.includes(ext);
    },

    /**
     * Get file icon based on extension
     * @param {string} fileName - File name
     * @returns {string} Emoji icon
     */
    getFileIcon(fileName) {
        const ext = this.getExtension(fileName);
        const icons = {
            '.xlsx': '📊',
            '.xls': '📗',
            '.csv': '📄'
        };
        return icons[ext] || '📁';
    },

    /**
     * Format file size
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * Validate files before processing
     * @param {FileList} files - Files to validate
     * @returns {Object} Validation result
     */
    validateFiles(files) {
        const errors = [];
        const validFiles = [];
        const maxFiles = 10;
        const maxFileSize = 50 * 1024 * 1024; // 50MB

        if (files.length > maxFiles) {
            errors.push(`يمكن رفع ${maxFiles} ملفات كحد أقصى`);
        }

        for (const file of files) {
            if (!this.isSupported(file.name)) {
                errors.push(`الملف ${file.name} غير مدعوم`);
                continue;
            }
            if (file.size > maxFileSize) {
                errors.push(`الملف ${file.name} أكبر من الحد المسموح (50MB)`);
                continue;
            }
            validFiles.push(file);
        }

        return {
            valid: errors.length === 0,
            errors,
            validFiles: validFiles.slice(0, maxFiles)
        };
    },

    /**
     * Merge multiple sheets into comparison format
     * @param {Array} parsedFiles - Array of parsed file data
     * @returns {Object} Merged data structure
     */
    prepareForComparison(parsedFiles) {
        const allSheets = [];

        parsedFiles.forEach((file, fileIndex) => {
            file.sheets.forEach((sheet, sheetIndex) => {
                allSheets.push({
                    id: `file${fileIndex}_sheet${sheetIndex}`,
                    label: file.sheets.length > 1
                        ? `${file.fileName} - ${sheet.name}`
                        : file.fileName,
                    fileName: file.fileName,
                    sheetName: sheet.name,
                    headers: sheet.headers,
                    rows: sheet.rows,
                    rowCount: sheet.rowCount
                });
            });
        });

        return {
            sheets: allSheets,
            sheetCount: allSheets.length,
            commonColumns: this.findCommonColumns(allSheets)
        };
    },

    /**
     * Find columns that exist in all sheets
     * @param {Array} sheets - Array of sheets
     * @returns {Array} Common column names
     */
    findCommonColumns(sheets) {
        if (sheets.length === 0) return [];

        const columnSets = sheets.map(sheet =>
            new Set(sheet.headers.map(h => h.name.toLowerCase()))
        );

        const common = [...columnSets[0]].filter(col =>
            columnSets.every(set => set.has(col))
        );

        return common;
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileParser;
}
