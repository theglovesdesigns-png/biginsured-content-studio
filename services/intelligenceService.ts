
/**
 * BRADLEY INSURANCE GROUP - CONTENT INTELLIGENCE LOGIC
 * Ported and enhanced from Apps Script 2024
 */

export interface CategoryGoal {
    category: string;
    current: number;
    goal: number;
    difference: number;
    priority: '🔴 HIGH' | '🟡 MEDIUM' | '🟢 LOW' | '✅ GOAL MET';
    progress: number; // percentage
}

export const CATEGORY_GOALS: Record<string, number> = {
    'Auto Insurance': 50,
    'Home Insurance': 50,
    'Business Insurance': 25,
    'Life Insurance': 15,
    'General Insurance': 50,
    'Claims': 20,
    'FAQ': 15,
    'Local Ohio Content': 20,
    'Seasonal': 10
};

/**
 * Normalizes strings for similarity comparison
 */
const normalize = (str: string) => {
    return str.toLowerCase()
        .replace(/[^\w\s]/g, '')  // Remove punctuation
        .replace(/\s+/g, ' ')      // Normalize whitespace
        .trim();
};

/**
 * Jaccard Similarity (Word-based)
 * Matches the Apps Script logic but optimized for TS
 */
export const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = normalize(str1);
    const s2 = normalize(str2);

    if (s1 === s2) return 1.0;

    // Substring detection
    if (s1.length > 10 && s2.length > 10) {
        if (s1.includes(s2)) return s2.length / s1.length;
        if (s2.includes(s1)) return s1.length / s2.length;
    }

    const words1 = new Set(s1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(s2.split(' ').filter(w => w.length > 2));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    if (union.size === 0) return 0;

    return intersection.size / union.size;
};

/**
 * Calculates the balance across all categories
 */
export const analyzeBalance = (existingTitles: { title: string, category: string }[]): CategoryGoal[] => {
    const counts: Record<string, number> = {};
    
    // Initialize counts with predefined goals
    Object.keys(CATEGORY_GOALS).forEach(cat => counts[cat] = 0);

    // Count existing (Published + Scheduled)
    existingTitles.forEach(item => {
        if (!item.category) return;
        const trimmedCat = item.category.trim();
        if (!trimmedCat) return;

        // Try exact match
        const exactKey = Object.keys(CATEGORY_GOALS).find(k => 
            k.toLowerCase() === trimmedCat.toLowerCase()
        );

        if (exactKey) {
            counts[exactKey]++;
        } else {
            // Find fuzzy matches if possible
            const fuzzyKey = Object.keys(CATEGORY_GOALS).find(k => 
                k.toLowerCase().includes(trimmedCat.toLowerCase()) || 
                trimmedCat.toLowerCase().includes(k.toLowerCase())
            );
            if (fuzzyKey) {
                counts[fuzzyKey]++;
            } else {
                // It is a totally new custom category! Let's dynamically add it to counts so it's not discarded.
                const formattedCat = trimmedCat.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                if (counts[formattedCat] === undefined) {
                    counts[formattedCat] = 0;
                }
                counts[formattedCat]++;
            }
        }
    });

    return Object.keys(counts).map(cat => {
        const current = counts[cat];
        const goal = CATEGORY_GOALS[cat] !== undefined ? CATEGORY_GOALS[cat] : 10; // default goal for custom categories is 10
        const difference = goal - current;
        const progress = Math.min(100, Math.round((current / (goal || 1)) * 100));

        let priority: CategoryGoal['priority'];
        if (difference > 10) priority = '🔴 HIGH';
        else if (difference > 5) priority = '🟡 MEDIUM';
        else if (difference > 0) priority = '🟢 LOW';
        else priority = '✅ GOAL MET';

        return {
            category: cat,
            current,
            goal,
            difference,
            priority,
            progress
        };
    });
};
