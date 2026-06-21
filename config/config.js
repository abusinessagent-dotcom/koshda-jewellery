/**
 * Koshda Jewellery House — System Configuration & Environment Mocks
 * Centralized settings, feature flags, limits, and integration placeholders.
 */
window.SG = window.SG || {};
window.SG.config = window.SG.config || {};

Object.assign(window.SG.config, {
  /**
   * HMAC key material for admin gate security.
   * @type {string}
   */
  HMAC_KEY_MATERIAL: 'KoshdaAdminGate2025',

  /**
   * Environment details and API server configuration.
   * @type {object}
   */
  environment: {
    // ⚠️  Set isDev: true ONLY in a local development environment.
    // When true, TOTP secrets and seed passwords are printed to the console.
    isDev: false,
    version: '1.0.0',
    apiUrl: window.location.origin
  },

  /**
   * Mock API credentials for third-party integrations.
   * @type {string}
   */
  whatsappPhoneId: '',
  whatsappToken: '',
  sheetsId: '',
  sheetsApiKey: '',

  /**
   * Device registration limits allowed per subscription tier.
   * @type {object}
   */
  deviceLimits: {
    standard: 2,
    premium: 5,
    exclusive: 8
  },
  
  maxOpenBookings: 5,
  maxCartItems: 30,
  sessionDurationHours: 8,
  inactivityMins: 30,

  /**
   * System feature toggles.
   * @type {object}
   */
  featureFlags: {
    watermarkEnabled: true,
    aiSearchEnabled: true,
    // ⚠️  demoMode: when true, MFA OTP codes and seed passwords are toasted/logged.
    // Must be false in any shared or hosted environment.
    demoMode: false
  }
});

