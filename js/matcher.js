/**
 * Smart Matcher Module
 * Implements various matching algorithms for comparing values
 */

const Matcher = {
    /**
     * Default configuration
     */
    config: {
        exactThreshold: 1.0,
        highSimilarityThreshold: 0.9,
        similarThreshold: 0.75,
        weakMatchThreshold: 0.6,
        numericTolerance: 0.01, // 1% tolerance for numbers
        useArabicNormalization: true
    },

    /**
     * Update configuration
     * @param {Object} newConfig - New config values
     */
    setConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    },

    /**
     * Main smart matching function
     * @param {*} valueA - First value
     * @param {*} valueB - Second value
     * @param {Object} options - Matching options
     * @returns {Object} Match result with score and type
     */
    smartMatch(valueA, valueB, options = {}) {
        // Handle null/undefined
        if (valueA == null && valueB == null) {
            return { score: 1.0, type: 'exact', matched: true };
        }
        if (valueA == null || valueB == null) {
            return { score: 0, type: 'missing', matched: false };
        }

        const strA = String(valueA).trim();
        const strB = String(valueB).trim();

        // Empty strings
        if (strA === '' && strB === '') {
            return { score: 1.0, type: 'exact', matched: true };
        }
        if (strA === '' || strB === '') {
            return { score: 0, type: 'missing', matched: false };
        }

        // Exact match
        if (strA === strB) {
            return { score: 1.0, type: 'exact', matched: true };
        }

        // Case-insensitive exact match
        if (strA.toLowerCase() === strB.toLowerCase()) {
            return { score: 0.99, type: 'exact', matched: true };
        }

        // Numeric matching
        const numA = parseFloat(strA.replace(/[^\d.-]/g, ''));
        const numB = parseFloat(strB.replace(/[^\d.-]/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) {
            const numResult = this.numericMatch(numA, numB);
            if (numResult.score >= this.config.similarThreshold) {
                return numResult;
            }
        }

        // Normalize for comparison
        let cleanA = strA.toLowerCase();
        let cleanB = strB.toLowerCase();

        // Apply Arabic normalization if enabled
        if (this.config.useArabicNormalization &&
            (ArabicNormalizer.isArabic(strA) || ArabicNormalizer.isArabic(strB))) {
            cleanA = ArabicNormalizer.clean(strA);
            cleanB = ArabicNormalizer.clean(strB);

            // Check again after normalization
            if (cleanA === cleanB) {
                return { score: 0.98, type: 'normalized', matched: true };
            }
        }

        // Fuzzy matching - use best score from multiple algorithms
        const scores = [
            { algorithm: 'levenshtein', score: this.levenshteinSimilarity(cleanA, cleanB) },
            { algorithm: 'jaroWinkler', score: this.jaroWinkler(cleanA, cleanB) },
            { algorithm: 'tokenSet', score: this.tokenSetRatio(cleanA, cleanB) }
        ];

        // Get best score
        const bestMatch = scores.reduce((best, current) =>
            current.score > best.score ? current : best
        );

        // Determine match type based on score
        let type = 'none';
        let matched = false;

        if (bestMatch.score >= this.config.highSimilarityThreshold) {
            type = 'fuzzy_high';
            matched = true;
        } else if (bestMatch.score >= this.config.similarThreshold) {
            type = 'fuzzy';
            matched = true;
        } else if (bestMatch.score >= this.config.weakMatchThreshold) {
            type = 'fuzzy_weak';
            matched = true;
        }

        return {
            score: bestMatch.score,
            type,
            matched,
            algorithm: bestMatch.algorithm,
            details: scores
        };
    },

    /**
     * Levenshtein distance based similarity
     * @param {string} a - First string
     * @param {string} b - Second string
     * @returns {number} Similarity score 0-1
     */
    levenshteinSimilarity(a, b) {
        if (a === b) return 1;
        if (!a || !b) return 0;

        const matrix = [];
        const lenA = a.length;
        const lenB = b.length;

        // Initialize matrix
        for (let i = 0; i <= lenB; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= lenA; j++) {
            matrix[0][j] = j;
        }

        // Fill matrix
        for (let i = 1; i <= lenB; i++) {
            for (let j = 1; j <= lenA; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }

        const distance = matrix[lenB][lenA];
        const maxLen = Math.max(lenA, lenB);
        return maxLen === 0 ? 1 : 1 - (distance / maxLen);
    },

    /**
     * Jaro-Winkler similarity
     * @param {string} a - First string
     * @param {string} b - Second string
     * @returns {number} Similarity score 0-1
     */
    jaroWinkler(a, b) {
        if (a === b) return 1;
        if (!a || !b) return 0;

        const jaroScore = this.jaro(a, b);

        // Calculate common prefix (up to 4 chars)
        let prefix = 0;
        for (let i = 0; i < Math.min(a.length, b.length, 4); i++) {
            if (a[i] === b[i]) prefix++;
            else break;
        }

        // Winkler modification
        return jaroScore + (prefix * 0.1 * (1 - jaroScore));
    },

    /**
     * Jaro similarity (helper for Jaro-Winkler)
     * @param {string} a - First string
     * @param {string} b - Second string
     * @returns {number} Jaro score
     */
    jaro(a, b) {
        if (a === b) return 1;

        const lenA = a.length;
        const lenB = b.length;
        const matchWindow = Math.floor(Math.max(lenA, lenB) / 2) - 1;

        const aMatches = new Array(lenA).fill(false);
        const bMatches = new Array(lenB).fill(false);

        let matches = 0;
        let transpositions = 0;

        // Find matches
        for (let i = 0; i < lenA; i++) {
            const start = Math.max(0, i - matchWindow);
            const end = Math.min(i + matchWindow + 1, lenB);

            for (let j = start; j < end; j++) {
                if (bMatches[j] || a[i] !== b[j]) continue;
                aMatches[i] = true;
                bMatches[j] = true;
                matches++;
                break;
            }
        }

        if (matches === 0) return 0;

        // Count transpositions
        let k = 0;
        for (let i = 0; i < lenA; i++) {
            if (!aMatches[i]) continue;
            while (!bMatches[k]) k++;
            if (a[i] !== b[k]) transpositions++;
            k++;
        }

        return (
            matches / lenA +
            matches / lenB +
            (matches - transpositions / 2) / matches
        ) / 3;
    },

    /**
     * Token Set Ratio - compares sets of words
     * Good for different word orders: "محمد أحمد" vs "أحمد محمد"
     * @param {string} a - First string
     * @param {string} b - Second string
     * @returns {number} Similarity score 0-1
     */
    tokenSetRatio(a, b) {
        if (a === b) return 1;
        if (!a || !b) return 0;

        const tokensA = new Set(a.toLowerCase().split(/\s+/).filter(t => t.length > 0));
        const tokensB = new Set(b.toLowerCase().split(/\s+/).filter(t => t.length > 0));

        if (tokensA.size === 0 && tokensB.size === 0) return 1;
        if (tokensA.size === 0 || tokensB.size === 0) return 0;

        // Calculate intersection
        const intersection = new Set([...tokensA].filter(t => tokensB.has(t)));

        // Jaccard similarity
        const union = new Set([...tokensA, ...tokensB]);
        const jaccardScore = intersection.size / union.size;

        // Also check if one is subset of another
        const subsetScore = intersection.size / Math.min(tokensA.size, tokensB.size);

        // Check individual token matches for partial matches
        let partialMatchScore = 0;
        const unmatchedA = [...tokensA].filter(t => !tokensB.has(t));
        const unmatchedB = [...tokensB].filter(t => !tokensA.has(t));

        for (const tokenA of unmatchedA) {
            let bestMatch = 0;
            for (const tokenB of unmatchedB) {
                const sim = this.levenshteinSimilarity(tokenA, tokenB);
                bestMatch = Math.max(bestMatch, sim);
            }
            partialMatchScore += bestMatch;
        }
        partialMatchScore = unmatchedA.length > 0
            ? partialMatchScore / unmatchedA.length * 0.5
            : 0;

        // Combined score
        return Math.max(jaccardScore, subsetScore * 0.95,
            (intersection.size / tokensA.size + intersection.size / tokensB.size) / 2 + partialMatchScore * 0.3);
    },

    /**
     * Numeric match with tolerance
     * @param {number} a - First number
     * @param {number} b - Second number
     * @returns {Object} Match result
     */
    numericMatch(a, b) {
        if (a === b) {
            return { score: 1.0, type: 'exact', matched: true };
        }

        const diff = Math.abs(a - b);
        const avg = (Math.abs(a) + Math.abs(b)) / 2;

        if (avg === 0) {
            return { score: diff === 0 ? 1 : 0, type: 'numeric', matched: diff === 0 };
        }

        const percentDiff = diff / avg;

        if (percentDiff <= this.config.numericTolerance) {
            return {
                score: 1 - percentDiff,
                type: 'numeric_tolerance',
                matched: true,
                difference: diff
            };
        }

        // Exponential decay for larger differences
        const score = Math.exp(-percentDiff * 5);
        return {
            score,
            type: 'numeric',
            matched: score >= this.config.weakMatchThreshold,
            difference: diff
        };
    },

    /**
     * Multi-column matching
     * @param {Object} rowA - First row object
     * @param {Object} rowB - Second row object
     * @param {Array} columns - Columns to compare
     * @param {Object} weights - Column weights
     * @returns {Object} Combined match result
     */
    multiColumnMatch(rowA, rowB, columns, weights = {}) {
        let totalWeight = 0;
        let weightedScore = 0;
        const columnResults = {};

        for (const column of columns) {
            const weight = weights[column] || 1;
            const valueA = rowA[column];
            const valueB = rowB[column];
            const result = this.smartMatch(valueA, valueB);

            columnResults[column] = result;
            weightedScore += result.score * weight;
            totalWeight += weight;
        }

        const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

        return {
            score: finalScore,
            matched: finalScore >= this.config.similarThreshold,
            type: this.getMatchType(finalScore),
            columnResults
        };
    },

    /**
     * Get match type from score
     * @param {number} score - Match score
     * @returns {string} Match type
     */
    getMatchType(score) {
        if (score >= this.config.exactThreshold) return 'exact';
        if (score >= this.config.highSimilarityThreshold) return 'fuzzy_high';
        if (score >= this.config.similarThreshold) return 'fuzzy';
        if (score >= this.config.weakMatchThreshold) return 'fuzzy_weak';
        return 'none';
    },

    /**
     * Get match status for UI
     * @param {number} score - Match score
     * @returns {Object} Status with label and class
     */
    getMatchStatus(score) {
        if (score >= 0.95) return { label: 'متطابق', class: 'matched', icon: '✓' };
        if (score >= 0.75) return { label: 'متشابه', class: 'similar', icon: '≈' };
        if (score >= 0.6) return { label: 'ضعيف', class: 'similar', icon: '~' };
        return { label: 'مختلف', class: 'missing', icon: '✗' };
    }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Matcher;
}
