/**
 * Reporter Module
 * Generates comparison reports and manages results
 */

const Reporter = {
    /**
     * Compare multiple sheets and generate comprehensive report
     * @param {Array} sheets - Array of sheet data
     * @param {string} keyColumn - Primary key column for matching
     * @param {Object} options - Comparison options
     * @returns {Object} Comparison report
     */
    compareSheets(sheets, keyColumn, options = {}) {
        if (sheets.length < 2) {
            throw new Error('يجب رفع ملفين على الأقل للمقارنة');
        }

        const {
            compareColumns = null, // All columns if null
            threshold = 0.75
        } = options;

        // Update matcher threshold
        Matcher.setConfig({ similarThreshold: threshold });

        // Build unified record map
        const recordMap = new Map();
        const allColumns = new Set();

        // Process each sheet
        sheets.forEach((sheet, sheetIndex) => {
            sheet.headers.forEach(h => allColumns.add(h.name));

            sheet.rows.forEach((row, rowIndex) => {
                const keyValue = row[keyColumn];
                if (keyValue === undefined || keyValue === null || String(keyValue).trim() === '') {
                    return; // Skip rows without key
                }

                const keyStr = String(keyValue).trim();

                if (!recordMap.has(keyStr)) {
                    recordMap.set(keyStr, {
                        key: keyStr,
                        occurrences: [],
                        sheetPresence: new Array(sheets.length).fill(null),
                        status: 'unknown'
                    });
                }

                const record = recordMap.get(keyStr);
                record.occurrences.push({
                    sheetIndex,
                    sheetName: sheet.label,
                    row,
                    rowIndex
                });
                record.sheetPresence[sheetIndex] = row;
            });
        });

        // Analyze each record
        const results = {
            exactMatches: [],
            fuzzyMatches: [],
            differences: [],
            conflicts: [],
            all: []
        };

        const columnsToCompare = compareColumns || [...allColumns].filter(c => c !== keyColumn);

        recordMap.forEach((record, key) => {
            const analysis = this.analyzeRecord(record, sheets.length, columnsToCompare);
            record.status = analysis.status;
            record.analysis = analysis;

            // Categorize
            switch (analysis.status) {
                case 'matched':
                    results.exactMatches.push(record);
                    break;
                case 'similar':
                    results.fuzzyMatches.push(record);
                    break;
                case 'missing':
                    results.differences.push(record);
                    break;
                case 'conflict':
                    results.conflicts.push(record);
                    break;
            }

            results.all.push(record);
        });

        // Generate summary
        const summary = {
            totalRecords: recordMap.size,
            exactMatches: results.exactMatches.length,
            fuzzyMatches: results.fuzzyMatches.length,
            differences: results.differences.length,
            conflicts: results.conflicts.length,
            sheetsCompared: sheets.length,
            keyColumn,
            columnsCompared: columnsToCompare.length
        };

        return {
            results,
            summary,
            sheets: sheets.map(s => ({ name: s.label, rowCount: s.rowCount })),
            keyColumn,
            columns: [...allColumns]
        };
    },

    /**
     * Analyze a single record across sheets
     * @param {Object} record - Record with occurrences
     * @param {number} sheetCount - Total number of sheets
     * @param {Array} columnsToCompare - Columns to compare
     * @returns {Object} Analysis result
     */
    analyzeRecord(record, sheetCount, columnsToCompare) {
        const presentInSheets = record.sheetPresence.filter(p => p !== null).length;

        // Missing in some sheets
        if (presentInSheets < sheetCount) {
            const missingIn = [];
            record.sheetPresence.forEach((presence, idx) => {
                if (presence === null) missingIn.push(idx);
            });

            return {
                status: 'missing',
                presentIn: presentInSheets,
                totalSheets: sheetCount,
                missingInSheets: missingIn,
                matchScore: presentInSheets / sheetCount,
                details: `موجود في ${presentInSheets} من ${sheetCount} شيتات`
            };
        }

        // Compare values across sheets
        const columnComparisons = {};
        let totalScore = 0;
        let hasConflict = false;
        let hasFuzzyMatch = false;

        for (const column of columnsToCompare) {
            const values = record.sheetPresence.map(row => row ? row[column] : null);
            const comparison = this.compareColumnValues(values);

            columnComparisons[column] = comparison;
            totalScore += comparison.score;

            if (comparison.isConflict) hasConflict = true;
            if (comparison.isFuzzy) hasFuzzyMatch = true;
        }

        const avgScore = columnsToCompare.length > 0 ? totalScore / columnsToCompare.length : 1;

        // Determine status
        let status;
        if (hasConflict && avgScore < 0.5) {
            status = 'conflict';
        } else if (avgScore >= 0.95) {
            status = 'matched';
        } else if (avgScore >= Matcher.config.similarThreshold) {
            status = 'similar';
        } else {
            status = 'conflict';
        }

        return {
            status,
            matchScore: avgScore,
            columnComparisons,
            presentIn: presentInSheets,
            totalSheets: sheetCount,
            details: this.getStatusDetails(status, avgScore)
        };
    },

    /**
     * Compare values of a column across sheets
     * @param {Array} values - Values from each sheet
     * @returns {Object} Comparison result
     */
    compareColumnValues(values) {
        const nonNull = values.filter(v => v !== null && v !== undefined);

        if (nonNull.length === 0) {
            return { score: 1, isExact: true, isConflict: false, isFuzzy: false };
        }

        if (nonNull.length === 1) {
            return { score: 1, isExact: true, isConflict: false, isFuzzy: false };
        }

        // Compare all pairs
        let minScore = 1;
        let maxScore = 0;

        for (let i = 0; i < nonNull.length; i++) {
            for (let j = i + 1; j < nonNull.length; j++) {
                const match = Matcher.smartMatch(nonNull[i], nonNull[j]);
                minScore = Math.min(minScore, match.score);
                maxScore = Math.max(maxScore, match.score);
            }
        }

        const avgScore = (minScore + maxScore) / 2;

        return {
            score: avgScore,
            isExact: minScore >= 0.99,
            isFuzzy: minScore < 0.99 && minScore >= 0.6,
            isConflict: minScore < 0.6,
            values: nonNull,
            variance: maxScore - minScore
        };
    },

    /**
     * Get human-readable status details
     * @param {string} status - Status code
     * @param {number} score - Match score
     * @returns {string} Status description
     */
    getStatusDetails(status, score) {
        const descriptions = {
            matched: 'متطابق في جميع الشيتات',
            similar: `متشابه (${Math.round(score * 100)}%)`,
            missing: 'غير موجود في بعض الشيتات',
            conflict: 'توجد تناقضات في البيانات'
        };
        return descriptions[status] || status;
    },

    /**
     * Format results for table display
     * @param {Object} report - Comparison report
     * @param {string} filter - Filter type (all, matched, etc.)
     * @returns {Array} Formatted rows for table
     */
    formatForTable(report, filter = 'all') {
        let records;

        switch (filter) {
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
            const row = {
                _key: record.key,
                _status: record.status,
                _score: record.analysis?.matchScore || 0,
                _analysis: record.analysis
            };

            // Add key column
            row[report.keyColumn] = record.key;

            // Add values from each sheet
            report.sheets.forEach((sheet, idx) => {
                const presence = record.sheetPresence[idx];
                if (presence) {
                    for (const [col, val] of Object.entries(presence)) {
                        if (!row.hasOwnProperty(`${col}_sheet${idx}`)) {
                            row[`${col}_sheet${idx}`] = val;
                        }
                    }
                }
            });

            return row;
        });
    },

    /**
     * Get statistics for dashboard
     * @param {Object} report - Comparison report
     * @returns {Object} Statistics object
     */
    getStatistics(report) {
        const { summary } = report;

        return {
            cards: [
                {
                    id: 'matched',
                    label: 'متطابق',
                    value: summary.exactMatches,
                    icon: '✓',
                    color: 'matched'
                },
                {
                    id: 'similar',
                    label: 'متشابه',
                    value: summary.fuzzyMatches,
                    icon: '≈',
                    color: 'similar'
                },
                {
                    id: 'missing',
                    label: 'مفقود',
                    value: summary.differences,
                    icon: '?',
                    color: 'missing'
                },
                {
                    id: 'conflict',
                    label: 'تناقض',
                    value: summary.conflicts,
                    icon: '!',
                    color: 'conflict'
                }
            ],
            summary: {
                total: summary.totalRecords,
                matchRate: summary.totalRecords > 0
                    ? Math.round((summary.exactMatches / summary.totalRecords) * 100)
                    : 0,
                sheetsCompared: summary.sheetsCompared
            }
        };
    },

    /**
     * Find potential duplicate records within a sheet
     * @param {Object} sheet - Sheet data
     * @param {string} keyColumn - Column to check
     * @param {number} threshold - Similarity threshold
     * @returns {Array} Duplicate groups
     */
    findDuplicates(sheet, keyColumn, threshold = 0.85) {
        const duplicates = [];
        const checked = new Set();
        const rows = sheet.rows;

        for (let i = 0; i < rows.length; i++) {
            if (checked.has(i)) continue;

            const group = [{ index: i, row: rows[i] }];
            const keyA = rows[i][keyColumn];

            for (let j = i + 1; j < rows.length; j++) {
                if (checked.has(j)) continue;

                const keyB = rows[j][keyColumn];
                const match = Matcher.smartMatch(keyA, keyB);

                if (match.score >= threshold) {
                    group.push({ index: j, row: rows[j], score: match.score });
                    checked.add(j);
                }
            }

            if (group.length > 1) {
                duplicates.push({
                    key: keyA,
                    records: group,
                    count: group.length
                });
                checked.add(i);
            }
        }

        return duplicates;
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Reporter;
}
