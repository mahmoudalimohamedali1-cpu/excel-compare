/**
 * Key Detection Module
 * Automatically detects identifier columns (ID, name, phone, email, etc.)
 */

const KeyDetector = {
    /**
     * Pattern definitions for column type detection
     */
    patterns: {
        id: {
            keywords: [
                'id', 'ID', 'رقم', 'كود', 'تعريفي', 'معرف', 'code', 'Code',
                'employeeid', 'employee_id', 'رقم_الموظف', 'رقم الموظف',
                'userid', 'user_id', 'رقم المستخدم', 'serial', 'سيريال',
                'رقم_تعريفي', 'الرقم', 'index', 'no', 'num', 'number', '#',
                'مسلسل', 'رقم_مسلسل', 'الكود', 'ref', 'reference', 'مرجع'
            ],
            priority: 1
        },
        name: {
            keywords: [
                'name', 'Name', 'اسم', 'الاسم', 'employee', 'موظف', 'اسم_الموظف',
                'fullname', 'full_name', 'الاسم_الكامل', 'first_name', 'last_name',
                'الاسم الاول', 'الاسم الأول', 'اسم العائلة', 'username', 'اسم المستخدم',
                'person', 'شخص', 'عامل', 'مستخدم', 'الموظف'
            ],
            priority: 2
        },
        phone: {
            keywords: [
                'phone', 'Phone', 'هاتف', 'جوال', 'تليفون', 'موبايل', 'mobile',
                'Mobile', 'telephone', 'tel', 'رقم_الهاتف', 'رقم الهاتف',
                'رقم الجوال', 'الموبايل', 'cell', 'contact', 'اتصال'
            ],
            priority: 3
        },
        email: {
            keywords: [
                'email', 'Email', 'بريد', 'إيميل', 'ايميل', 'mail', 'Mail',
                'البريد', 'البريد الإلكتروني', 'البريد_الالكتروني', 'e-mail',
                'contact_email', 'بريد_الكتروني'
            ],
            priority: 4
        },
        nationalId: {
            keywords: [
                'national', 'رقم_الهوية', 'هوية', 'الهوية', 'رقم الهوية',
                'ssn', 'national_id', 'رقم_قومي', 'الرقم القومي', 'identity',
                'passport', 'جواز', 'جواز_السفر', 'إقامة', 'اقامة'
            ],
            priority: 2
        }
    },

    /**
     * Detect the best key column from headers
     * @param {Array} headers - Array of header objects {name, index}
     * @param {Array} rows - Sample rows for analysis
     * @returns {Object} Detection result with suggested column
     */
    detectKeyColumn(headers, rows) {
        const scores = headers.map(header => ({
            header,
            score: 0,
            type: null,
            confidence: 0,
            reasons: []
        }));

        // Analyze each header
        scores.forEach(item => {
            const headerName = item.header.name.toLowerCase();

            // Check against patterns
            for (const [type, pattern] of Object.entries(this.patterns)) {
                for (const keyword of pattern.keywords) {
                    if (headerName.includes(keyword.toLowerCase())) {
                        item.score += (10 - pattern.priority) * 2;
                        item.type = type;
                        item.reasons.push(`يحتوي على كلمة "${keyword}"`);
                        break;
                    }
                }
            }

            // Analyze column data
            if (rows.length > 0) {
                const columnValues = rows.map(row => row[item.header.name]);
                const dataAnalysis = this.analyzeColumnData(columnValues);

                item.score += dataAnalysis.score;
                item.reasons.push(...dataAnalysis.reasons);

                if (dataAnalysis.detectedType && !item.type) {
                    item.type = dataAnalysis.detectedType;
                }
            }
        });

        // Sort by score
        scores.sort((a, b) => b.score - a.score);

        // Calculate confidence
        if (scores.length > 0 && scores[0].score > 0) {
            scores[0].confidence = Math.min(scores[0].score / 20, 1);
        }

        return {
            suggested: scores.length > 0 && scores[0].score > 0 ? scores[0] : null,
            allScores: scores,
            hasConfidentMatch: scores.length > 0 && scores[0].score >= 10
        };
    },

    /**
     * Analyze column data to help identify type
     * @param {Array} values - Column values
     * @returns {Object} Analysis result
     */
    analyzeColumnData(values) {
        const result = {
            score: 0,
            reasons: [],
            detectedType: null
        };

        if (!values || values.length === 0) return result;

        // Filter out empty values
        const nonEmpty = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');

        if (nonEmpty.length === 0) return result;

        // Check uniqueness
        const uniqueCount = new Set(nonEmpty.map(v => String(v).toLowerCase())).size;
        const uniqueRatio = uniqueCount / nonEmpty.length;

        if (uniqueRatio > 0.95) {
            result.score += 5;
            result.reasons.push('قيم فريدة بنسبة عالية');
        }

        // Check if numeric IDs
        const numericCount = nonEmpty.filter(v => /^\d+$/.test(String(v).trim())).length;
        if (numericCount / nonEmpty.length > 0.9) {
            result.score += 3;
            result.reasons.push('أرقام تعريفية');
            result.detectedType = 'id';
        }

        // Check for email patterns
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emailCount = nonEmpty.filter(v => emailPattern.test(String(v))).length;
        if (emailCount / nonEmpty.length > 0.5) {
            result.score += 4;
            result.reasons.push('عناوين بريد إلكتروني');
            result.detectedType = 'email';
        }

        // Check for phone patterns (with country codes, etc.)
        const phonePattern = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\./0-9]*$/;
        const phoneCount = nonEmpty.filter(v => {
            const str = String(v).replace(/\s/g, '');
            return phonePattern.test(str) && str.length >= 8 && str.length <= 15;
        }).length;
        if (phoneCount / nonEmpty.length > 0.5) {
            result.score += 3;
            result.reasons.push('أرقام هاتف');
            result.detectedType = 'phone';
        }

        // Check for names (Arabic or English text, 2-4 words typically)
        const nameCount = nonEmpty.filter(v => {
            const str = String(v).trim();
            const words = str.split(/\s+/);
            return words.length >= 2 && words.length <= 5 &&
                /^[\u0600-\u06FFa-zA-Z\s]+$/.test(str);
        }).length;
        if (nameCount / nonEmpty.length > 0.5) {
            result.score += 2;
            result.reasons.push('أسماء أشخاص');
            if (!result.detectedType) result.detectedType = 'name';
        }

        return result;
    },

    /**
     * Get all potential key columns
     * @param {Array} headers - Header objects
     * @param {Array} rows - Data rows
     * @returns {Array} Sorted list of potential keys
     */
    getAllPotentialKeys(headers, rows) {
        const detection = this.detectKeyColumn(headers, rows);
        return detection.allScores.filter(s => s.score > 0);
    },

    /**
     * Create formatted options for UI select
     * @param {Array} headers - Header objects
     * @param {Array} rows - Data rows
     * @returns {Array} Options for select element
     */
    createColumnOptions(headers, rows) {
        const detection = this.detectKeyColumn(headers, rows);

        return headers.map(header => {
            const scoreData = detection.allScores.find(s => s.header.index === header.index);
            let label = header.name;

            if (scoreData && scoreData.type) {
                const typeLabels = {
                    id: 'معرّف',
                    name: 'اسم',
                    phone: 'هاتف',
                    email: 'بريد',
                    nationalId: 'هوية'
                };
                label += ` (${typeLabels[scoreData.type] || scoreData.type})`;
            }

            if (detection.suggested && detection.suggested.header.index === header.index) {
                label += ' ⭐';
            }

            return {
                value: header.index,
                label,
                name: header.name,
                isRecommended: detection.suggested?.header.index === header.index,
                score: scoreData?.score || 0
            };
        }).sort((a, b) => b.score - a.score);
    },

    /**
     * Get type icon
     * @param {string} type - Column type
     * @returns {string} Emoji icon
     */
    getTypeIcon(type) {
        const icons = {
            id: '🔢',
            name: '👤',
            phone: '📱',
            email: '📧',
            nationalId: '🪪'
        };
        return icons[type] || '📋';
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KeyDetector;
}
