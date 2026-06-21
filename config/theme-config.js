/**
 * ═══════════════════════════════════════════════════════════════════
 * Koshda Jewellery House — JavaScript Theme Configuration
 * ═══════════════════════════════════════════════════════════════════
 *
 * The JS mirror of theme.css — a single source of truth usable in:
 *  - Node.js scripts (require/import)
 *  - Browser via <script src="..."> tag
 *  - Email templates, PDF generation, canvas rendering
 *
 * The `THEME` object mirrors all CSS variables as JS properties.
 * Use `ThemeUtils.applyTheme(element, isDark)` to apply tokens to
 * any DOM element programmatically.
 *
 * Usage (browser):
 *   <script src="/config/theme-config.js"></script>
 *   ThemeUtils.setDarkMode(true);     // Toggle dark mode
 *   ThemeUtils.applyTheme(el, false); // Apply light mode inline styles
 *
 * Usage (Node.js):
 *   const { THEME, BRAND, ThemeUtils } = require('./config/theme-config');
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

// ══════════════════════════════════════════════════════════════════════
// DESIGN TOKENS (JS)
// ══════════════════════════════════════════════════════════════════════

const THEME = Object.freeze({

  // ── Gold Palette ────────────────────────────────────────────────
  gold: {
    50:  'hsl(45, 100%, 97%)',
    100: 'hsl(44, 100%, 91%)',
    200: 'hsl(43, 100%, 82%)',
    300: 'hsl(43, 95%,  68%)',
    400: 'hsl(40, 89%,  61%)',
    500: 'hsl(38, 56%,  55%)',   // Brand primary
    600: 'hsl(36, 50%,  41%)',
    700: 'hsl(34, 48%,  31%)',
    800: 'hsl(33, 45%,  22%)',
    900: 'hsl(32, 42%,  14%)',
    brand: '#C9A84C',            // Hex for email/canvas use
  },

  // ── Obsidian Palette ─────────────────────────────────────────────
  obsidian: {
    50:  'hsl(225, 20%, 97%)',
    100: 'hsl(222, 18%, 92%)',
    200: 'hsl(220, 16%, 82%)',
    300: 'hsl(218, 14%, 64%)',
    400: 'hsl(216, 12%, 46%)',
    500: 'hsl(214, 12%, 32%)',
    600: 'hsl(212, 14%, 20%)',
    700: 'hsl(210, 16%, 13%)',
    800: 'hsl(208, 18%, 8%)',
    900: 'hsl(206, 22%, 4%)',
  },

  // ── Semantic Colors ──────────────────────────────────────────────
  semantic: {
    success:    'hsl(142, 71%, 45%)',
    successBg:  'hsl(142, 76%, 96%)',
    warning:    'hsl(38, 92%, 50%)',
    warningBg:  'hsl(48, 100%, 96%)',
    danger:     'hsl(0, 84%, 60%)',
    dangerBg:   'hsl(0, 86%, 97%)',
    info:       'hsl(217, 91%, 60%)',
    infoBg:     'hsl(212, 100%, 96%)',
  },

  // ── Light Mode Color Roles ───────────────────────────────────────
  light: {
    bg:              'hsl(45, 20%, 98%)',
    bgSubtle:        'hsl(44, 18%, 95%)',
    bgElevated:      '#ffffff',
    surface:         '#ffffff',
    surfaceHover:    'hsl(44, 20%, 97%)',
    border:          'hsl(44, 12%, 88%)',
    borderSubtle:    'hsl(44, 10%, 93%)',
    borderStrong:    'hsl(44, 12%, 75%)',
    textPrimary:     'hsl(206, 22%, 8%)',
    textSecondary:   'hsl(208, 14%, 26%)',
    textMuted:       'hsl(210, 10%, 52%)',
    textDisabled:    'hsl(212, 8%, 70%)',
    textInverse:     '#ffffff',
    accent:          'hsl(38, 56%, 55%)',
    accentHover:     'hsl(36, 50%, 41%)',
    accentMuted:     'hsl(44, 100%, 91%)',
    link:            'hsl(36, 50%, 41%)',
    linkHover:       'hsl(34, 48%, 31%)',
    overlay:         'rgba(8, 8, 16, 0.55)',
  },

  // ── Dark Mode Color Roles ────────────────────────────────────────
  dark: {
    bg:              'hsl(206, 22%, 4%)',
    bgSubtle:        'hsl(208, 18%, 8%)',
    bgElevated:      'hsl(210, 16%, 13%)',
    surface:         'hsl(208, 18%, 8%)',
    surfaceHover:    'hsl(210, 16%, 13%)',
    border:          'hsl(212, 14%, 20%)',
    borderSubtle:    'hsl(210, 16%, 13%)',
    borderStrong:    'hsl(214, 12%, 32%)',
    textPrimary:     'hsl(44, 30%, 95%)',
    textSecondary:   'hsl(44, 10%, 75%)',
    textMuted:       'hsl(44, 8%, 52%)',
    textDisabled:    'hsl(44, 6%, 36%)',
    textInverse:     'hsl(206, 22%, 4%)',
    accent:          'hsl(40, 89%, 61%)',
    accentHover:     'hsl(43, 95%, 68%)',
    accentMuted:     'rgba(201, 168, 76, 0.12)',
    link:            'hsl(40, 89%, 61%)',
    linkHover:       'hsl(43, 95%, 68%)',
    overlay:         'rgba(0, 0, 0, 0.70)',
  },

  // ── Typography ──────────────────────────────────────────────────
  font: {
    display:   "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    body:      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono:      "'Fira Code', Consolas, 'Courier New', monospace",
    sizes: {
      xs:   '11px',
      sm:   '12px',
      base: '14px',
      md:   '15px',
      lg:   '16px',
      xl:   '18px',
      '2xl':'22px',
      '3xl':'28px',
      '4xl':'36px',
      '5xl':'48px',
      '6xl':'60px',
      h1:   'clamp(36px, 5vw, 64px)',
      h2:   'clamp(28px, 4vw, 48px)',
      h3:   'clamp(22px, 3vw, 32px)',
      h4:   'clamp(18px, 2.5vw, 24px)',
    },
    weights: {
      thin:      100,
      light:     300,
      regular:   400,
      medium:    500,
      semibold:  600,
      bold:      700,
      extrabold: 800,
    },
    lineHeight: {
      none:    1,
      tight:   1.2,
      snug:    1.35,
      normal:  1.5,
      relaxed: 1.7,
      loose:   2,
    },
    tracking: {
      tightest: '-0.05em',
      tighter:  '-0.025em',
      tight:    '-0.01em',
      normal:    '0',
      wide:      '0.025em',
      wider:     '0.05em',
      widest:    '0.15em',
      luxury:    '0.25em',
    },
  },

  // ── Spacing ─────────────────────────────────────────────────────
  space: {
    0:    '0',
    px:   '1px',
    1:    '4px',
    2:    '8px',
    3:    '12px',
    4:    '16px',
    5:    '20px',
    6:    '24px',
    8:    '32px',
    10:   '40px',
    12:   '48px',
    16:   '64px',
    20:   '80px',
    24:   '96px',
  },

  // ── Border Radius ────────────────────────────────────────────────
  radius: {
    none: '0',
    xs:   '2px',
    sm:   '4px',
    md:   '6px',
    lg:   '8px',
    xl:   '12px',
    '2xl':'16px',
    '3xl':'24px',
    full: '9999px',
  },

  // ── Shadows ─────────────────────────────────────────────────────
  shadow: {
    none:  'none',
    xs:    '0 1px 2px rgba(0,0,0,0.04)',
    sm:    '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    md:    '0 4px 6px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.05)',
    lg:    '0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.05)',
    xl:    '0 20px 25px rgba(0,0,0,0.10), 0 10px 10px rgba(0,0,0,0.04)',
    '2xl': '0 25px 50px rgba(0,0,0,0.15)',
    gold:  '0 0 0 3px rgba(201,168,76,0.18), 0 4px 12px rgba(201,168,76,0.25)',
  },

  // ── Animation ────────────────────────────────────────────────────
  animation: {
    easing: {
      linear:  'linear',
      in:      'cubic-bezier(0.4, 0, 1, 1)',
      out:     'cubic-bezier(0, 0, 0.2, 1)',
      inOut:   'cubic-bezier(0.4, 0, 0.2, 1)',
      spring:  'cubic-bezier(0.34, 1.56, 0.64, 1)',
      luxury:  'cubic-bezier(0.16, 1, 0.3, 1)',
    },
    duration: {
      instant: '0ms',
      fast:    '100ms',
      normal:  '200ms',
      slow:    '350ms',
      slower:  '500ms',
      slowest: '750ms',
    },
  },

  // ── Component Tokens ─────────────────────────────────────────────
  components: {
    button: {
      fontFamily:    "'Inter', sans-serif",
      fontWeight:    600,
      letterSpacing: '0.02em',
      height: { sm: '30px', md: '38px', lg: '48px' },
      radius: '6px',
      primary: {
        bg:     'hsl(38, 56%, 55%)',
        hover:  'hsl(36, 50%, 41%)',
        active: 'hsl(34, 48%, 31%)',
        text:   '#ffffff',
      },
      secondary: {
        bg:     'transparent',
        hover:  'hsl(44, 18%, 95%)',
        border: 'hsl(44, 12%, 75%)',
        text:   'hsl(206, 22%, 8%)',
      },
      danger: {
        bg:    'hsl(0, 84%, 60%)',
        hover: 'hsl(0, 79%, 51%)',
        text:  '#ffffff',
      },
    },
    card: {
      bg:          '#ffffff',
      border:      'hsl(44, 12%, 88%)',
      borderHover: 'hsl(44, 12%, 75%)',
      radius:      '12px',
      shadow:      '0 1px 3px rgba(0,0,0,0.06)',
      shadowHover: '0 10px 15px rgba(0,0,0,0.08)',
      padding:     '24px',
    },
    input: {
      bg:           'hsl(44, 18%, 95%)',
      bgFocus:      '#ffffff',
      border:       'hsl(44, 12%, 88%)',
      borderFocus:  'hsl(38, 56%, 55%)',
      borderError:  'hsl(0, 84%, 60%)',
      text:         'hsl(206, 22%, 8%)',
      placeholder:  'hsl(212, 8%, 70%)',
      radius:       '6px',
      height:       '40px',
      ringFocus:    '0 0 0 3px rgba(201,168,76,0.18)',
    },
    navbar: {
      height:   '60px',
      bg:       'rgba(255,255,255,0.9)',
      backdrop: 'blur(12px)',
      text:     'hsl(206, 22%, 8%)',
    },
    sidebar: {
      width:       '260px',
      bg:          'hsl(208, 18%, 8%)',
      text:        'hsl(220, 16%, 82%)',
      textActive:  'hsl(40, 89%, 61%)',
      itemActiveBg:'rgba(201,168,76,0.14)',
    },
    table: {
      bg:       '#ffffff',
      border:   'hsl(44, 10%, 93%)',
      headBg:   'hsl(44, 18%, 95%)',
      headText: 'hsl(210, 10%, 52%)',
      rowHover: 'hsl(44, 20%, 97%)',
      radius:   '8px',
    },
  },
});

// ══════════════════════════════════════════════════════════════════════
// BRAND CONTENT RULES
// ══════════════════════════════════════════════════════════════════════

const BRAND = Object.freeze({
  name:    'Koshda Jewellery House',
  tagline: 'Crafted for Connoisseurs', // 3–5 words, premium, emotional

  /** Headline writing rules */
  headline: {
    style:         'Short · Premium · Emotional',
    maxWords:       7,
    font:          'Cormorant Garamond',
    weight:        600,
    letterSpacing: '-0.025em',
    exampleLight:  'The Art of Fine Gold',
    exampleDark:   'Elegance, Redefined',
  },

  /** Tagline format rules */
  taglineRule: {
    style:         '5–8 words · Uppercase · Wide tracking',
    transform:     'uppercase',
    letterSpacing: '0.25em',
    font:          'Inter',
    weight:        500,
    examples: [
      'EXCLUSIVE B2B JEWELLERY PLATFORM',
      'WHERE TRADITION MEETS PRECISION',
      'CURATED FOR THE DISCERNING DEALER',
    ],
  },

  /** Body description rules */
  description: {
    style:       'Clear · Trust-building · No jargon',
    maxWords:    40,
    tone:        'Professional yet approachable',
    font:        'Inter',
    lineHeight:  1.7,
    exampleText: 'Access our exclusive catalogue of handcrafted 22-karat gold jewellery, designed for wholesale dealers who value quality without compromise.',
  },

  /** CTA rules */
  cta: {
    style:         'Action-first · Uppercase · Bold',
    maxWords:       4,
    transform:     'uppercase',
    letterSpacing: '0.04em',
    examples: [
      'REQUEST ACCESS',
      'VIEW CATALOGUE',
      'APPLY NOW',
      'EXPLORE DESIGNS',
    ],
  },
});

// ══════════════════════════════════════════════════════════════════════
// THEME UTILITIES
// ══════════════════════════════════════════════════════════════════════

const ThemeUtils = {
  /**
   * Toggle dark mode on the document root.
   * @param {boolean} isDark
   */
  setDarkMode(isDark) {
    if (typeof document === 'undefined') return;
    if (isDark) {
      document.documentElement.dataset.theme = 'dark';
      localStorage.setItem('koshda_theme', 'dark');
    } else {
      document.documentElement.dataset.theme = 'light';
      localStorage.setItem('koshda_theme', 'light');
    }
  },

  /**
   * Load saved theme preference from localStorage.
   * Falls back to OS dark mode preference.
   */
  loadSavedTheme() {
    if (typeof document === 'undefined') return;
    const saved = localStorage.getItem('koshda_theme');
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.dataset.theme = saved;
    } else {
      // Follow OS preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';
    }
  },

  /**
   * Check if dark mode is currently active.
   * @returns {boolean}
   */
  isDarkMode() {
    if (typeof document === 'undefined') return false;
    return document.documentElement.dataset.theme === 'dark';
  },

  /**
   * Toggle dark/light mode.
   */
  toggleDarkMode() {
    this.setDarkMode(!this.isDarkMode());
  },

  /**
   * Get the current mode's color palette.
   * @returns {object} The light or dark color role object.
   */
  colors() {
    return this.isDarkMode() ? THEME.dark : THEME.light;
  },

  /**
   * Apply theme inline styles to a DOM element.
   * Useful for canvas, SVG, or email template rendering.
   * @param {HTMLElement} el
   * @param {boolean} [isDark=false]
   */
  applyTheme(el, isDark = false) {
    if (!el) return;
    const colors = isDark ? THEME.dark : THEME.light;
    el.style.backgroundColor = colors.bg;
    el.style.color            = colors.textPrimary;
    el.style.fontFamily       = THEME.font.body;
  },

  /**
   * Generate a CSS custom property string from the THEME object.
   * Useful for injecting tokens into a <style> tag dynamically.
   * @param {boolean} [darkMode=false]
   * @returns {string} CSS :root { ... } block
   */
  toCSSVars(darkMode = false) {
    const c = darkMode ? THEME.dark : THEME.light;
    return `:root {
  --color-bg: ${c.bg};
  --color-surface: ${c.surface};
  --color-text-primary: ${c.textPrimary};
  --color-text-secondary: ${c.textSecondary};
  --color-text-muted: ${c.textMuted};
  --color-accent: ${c.accent};
  --color-border: ${c.border};
  --color-overlay: ${c.overlay};
  --font-display: ${THEME.font.display};
  --font-body: ${THEME.font.body};
  --gold-brand: ${THEME.gold.brand};
}`;
  },
};

// ══════════════════════════════════════════════════════════════════════
// EXPORTS (Node.js + Browser)
// ══════════════════════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
  // Node.js
  module.exports = { THEME, BRAND, ThemeUtils };
} else if (typeof window !== 'undefined') {
  // Browser globals
  window.THEME      = THEME;
  window.BRAND      = BRAND;
  window.ThemeUtils = ThemeUtils;

  // Auto-load saved theme on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ThemeUtils.loadSavedTheme());
  } else {
    ThemeUtils.loadSavedTheme();
  }
}
