/**
 * Koshda Jewellery House — Product Code & BIS Hallmark Validation Schemas
 * Standardizes SKU formatting and regulatory hallmark validation rules.
 */
window.SG = window.SG || {};

SG.productCodes = (function() {
  const categories = {
    NECK: 'Necklace',
    EARR: 'Earrings',
    BANG: 'Bangles',
    RING: 'Ring',
    MAAG: 'Maang Tikka',
    BRAC: 'Bracelet',
    ANKL: 'Anklet',
    PEND: 'Pendant',
    NOSE: 'Nose Ring',
    SETT: 'Jewellery Set',
    MANG: 'Mangalsutra'
  };

  const materials = {
    '22K': '22 Karat Gold',
    '18K': '18 Karat Gold',
    '14K': '14 Karat Gold',
    'SIL': 'Sterling Silver',
    'PLAT': 'Platinum',
    'RGP': 'Rolled Gold Plate',
    'GF': 'Gold Filled',
    'MIX': 'Mixed Metals'
  };

  const subCategories = {
    BRD: 'Bridal',
    DLY: 'Daily Wear',
    FST: 'Festive',
    GFT: 'Gifting',
    OFFC: 'Office Wear',
    CAST: 'Casting'
  };

  const styles = {
    TRAD: 'Traditional',
    CTMP: 'Contemporary',
    FUSE: 'Fusion',
    TMPL: 'Temple',
    HRTG: 'Heritage',
    MNML: 'Minimalist',
    STAT: 'Statement'
  };

  // Standard Product Code Regex: MATERIAL-SEQ-CATEGORY-SUBCAT-STYLE-YEAR
  const codeRegex = /^(22K|18K|14K|SIL|PLAT|RGP|GF|MIX)-(\d{4})-(NECK|BANG|RING|EARR|PEND|BRAC|ANKL|MAAG|NOSE|SETT|MANG)-(BRD|DLY|FST|GFT|OFFC|CAST)-(TRAD|CTMP|FUSE|TMPL|HRTG|MNML|STAT)-(\d{2})$/;

  // BIS Hallmark Code Regex: HM-XXX-YYYY-NNNNNN (where XXX is center, YYYY is year/grade, NNNNNN is unique ID)
  const hallmarkRegex = /^HM-[A-Z0-9]{3,4}-[A-Z0-9]{4}-[A-Z0-9]{6,8}$/i;

  return {
    /**
     * Map of product categories to human-readable labels.
     * @type {object}
     */
    categories,

    /**
     * Map of materials (gold karatage/silver/platinum) to labels.
     * @type {object}
     */
    materials,

    /**
     * Map of sub-categories (themes/occasions) to labels.
     * @type {object}
     */
    subCategories,

    /**
     * Map of design styles to labels.
     * @type {object}
     */
    styles,

    /**
     * Generates a standard product code from constituent parts.
     * @param {string} material Material code (e.g., '22K')
     * @param {number|string} seq Sequence number
     * @param {string} category Category code (e.g., 'NECK')
     * @param {string} subCat Sub-category code (e.g., 'BRD')
     * @param {string} style Style code (e.g., 'HRTG')
     * @param {number|string} year Year code (e.g., 25 or 2025)
     * @returns {string} Formatted SKU code (e.g., '22K-0001-NECK-BRD-HRTG-25')
     */
    generate(material, seq, category, subCat, style, year) {
      const s = String(seq).padStart(4, '0');
      const y = String(year).slice(-2);
      return `${material}-${s}-${category}-${subCat}-${style}-${y}`;
    },

    /**
     * Validates a product code and parses it into parts if valid.
     * @param {string} code SKU code to validate
     * @returns {object} Validation result { valid: boolean, parts: object|null }
     */
    validate(code) {
      if (!code) return { valid: false, parts: null };
      const match = code.trim().toUpperCase().match(codeRegex);
      if (!match) return { valid: false, parts: null };

      return {
        valid: true,
        parts: {
          material: match[1],
          sequence: match[2],
          category: match[3],
          subCategory: match[4],
          style: match[5],
          year: match[6],
          materialLabel: materials[match[1]],
          categoryLabel: categories[match[3]],
          subCategoryLabel: subCategories[match[4]],
          styleLabel: styles[match[5]]
        }
      };
    },

    /**
     * Validates a BIS Hallmark identifier format.
     * @param {string} hallmark Hallmark number to validate
     * @returns {object} Validation result { valid: boolean }
     */
    validateBIS(hallmark) {
      if (!hallmark) return { valid: false };
      return { valid: hallmarkRegex.test(hallmark.trim()) };
    }
  };
})();

