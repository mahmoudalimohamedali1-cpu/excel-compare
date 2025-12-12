/**
 * Arabic Text Normalizer
 * Handles Arabic-specific text variations for better matching
 */

const ArabicNormalizer = {
    // Character mappings for normalization
    mappings: {
        // Alef variations → plain Alef
        alef: {
            'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ٲ': 'ا', 'ٳ': 'ا'
        },
        // Yaa and Alef Maqsura
        yaa: {
            'ى': 'ي', 'ئ': 'ي'
        },
        // Taa Marbuta and Haa
        taa: {
            'ة': 'ه'
        },
        // Waw variations
        waw: {
            'ؤ': 'و'
        },
        // Remove these characters
        remove: ['ء', 'ً', 'ٌ', 'ٍ', 'َ', 'ُ', 'ِ', 'ّ', 'ْ', 'ـ']
    },

    /**
     * Normalize Arabic text for comparison
     * @param {string} text - Input text
     * @returns {string} Normalized text
     */
    normalize(text) {
        if (!text || typeof text !== 'string') return '';

        let normalized = text;

        // Apply Alef normalization
        for (const [from, to] of Object.entries(this.mappings.alef)) {
            normalized = normalized.replace(new RegExp(from, 'g'), to);
        }

        // Apply Yaa normalization
        for (const [from, to] of Object.entries(this.mappings.yaa)) {
            normalized = normalized.replace(new RegExp(from, 'g'), to);
        }

        // Apply Taa normalization
        for (const [from, to] of Object.entries(this.mappings.taa)) {
            normalized = normalized.replace(new RegExp(from, 'g'), to);
        }

        // Apply Waw normalization
        for (const [from, to] of Object.entries(this.mappings.waw)) {
            normalized = normalized.replace(new RegExp(from, 'g'), to);
        }

        // Remove diacritics and special characters
        for (const char of this.mappings.remove) {
            normalized = normalized.replace(new RegExp(char, 'g'), '');
        }

        // Normalize whitespace
        normalized = normalized.replace(/\s+/g, ' ').trim();

        // Remove common Arabic prefixes for matching (optional)
        // normalized = this.removeCommonPrefixes(normalized);

        return normalized;
    },

    /**
     * Remove common Arabic prefixes (ال, و, ب, ل, ف, etc.)
     * @param {string} text - Input text
     * @returns {string} Text without common prefixes
     */
    removeCommonPrefixes(text) {
        const prefixes = ['ال', 'وال', 'بال', 'لل', 'فال', 'كال'];
        let result = text;
        
        for (const prefix of prefixes) {
            if (result.startsWith(prefix) && result.length > prefix.length + 2) {
                result = result.substring(prefix.length);
                break;
            }
        }
        
        return result;
    },

    /**
     * Clean and prepare text for comparison
     * @param {string} text - Input text
     * @returns {string} Cleaned text
     */
    clean(text) {
        if (!text || typeof text !== 'string') return '';

        return text
            // Remove extra whitespace
            .replace(/\s+/g, ' ')
            // Remove leading/trailing whitespace
            .trim()
            // Convert to lowercase (for mixed Arabic/English)
            .toLowerCase()
            // Remove common punctuation
            .replace(/[.,،؛:;!?()[\]{}'"«»]/g, '')
            // Normalize Arabic
            .split(' ')
            .map(word => this.normalize(word))
            .join(' ');
    },

    /**
     * Extract Arabic words from text
     * @param {string} text - Input text
     * @returns {string[]} Array of Arabic words
     */
    extractWords(text) {
        if (!text) return [];
        const cleaned = this.clean(text);
        return cleaned.split(' ').filter(word => word.length > 0);
    },

    /**
     * Check if text contains Arabic characters
     * @param {string} text - Input text
     * @returns {boolean} True if contains Arabic
     */
    isArabic(text) {
        if (!text) return false;
        // Arabic Unicode range
        return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text);
    },

    /**
     * Get phonetic representation for Arabic text
     * Useful for matching names with different spellings
     * @param {string} text - Input text
     * @returns {string} Phonetic representation
     */
    getPhonetic(text) {
        let phonetic = this.normalize(text);
        
        // Group similar sounding letters
        const phoneticGroups = {
            'ت': 'ط',  // Ta and Taa
            'ث': 'س',  // Tha and Seen
            'ذ': 'ز',  // Dhal and Zay
            'ظ': 'ض',  // Dhaa and Dad
            'ص': 'س',  // Sad and Seen
            'ق': 'ك',  // Qaf and Kaf
        };

        for (const [from, to] of Object.entries(phoneticGroups)) {
            phonetic = phonetic.replace(new RegExp(from, 'g'), to);
        }

        return phonetic;
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArabicNormalizer;
}
