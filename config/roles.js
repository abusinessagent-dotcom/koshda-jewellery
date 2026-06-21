/**
 * Koshda Jewellery House — Role Definitions & Permissions Matrix
 * Configures authorization levels and access controls for admins and dealers.
 */
window.SG = window.SG || {};

SG.roles = (function() {
  // Constant Role Identifiers
  const roles = {
    SUPER_ADMIN: 'super_admin',
    CATALOGUE_MANAGER: 'catalogue_manager',
    DEALER_MANAGER: 'dealer_manager',
    ANALYTICS_VIEWER: 'analytics_viewer',
    DEALER: 'dealer'
  };

  // Administrative Permission Matrix
  const matrix = {
    [roles.SUPER_ADMIN]: {
      canApproveDealer: true,
      canUploadProduct: true,
      canManageTokens: true,
      canViewAnalytics: true,
      canViewBookings: true,
      canModifyBookings: true,
      canManageUsers: true
    },
    [roles.CATALOGUE_MANAGER]: {
      canApproveDealer: false,
      canUploadProduct: true,
      canManageTokens: false,
      canViewAnalytics: false,
      canViewBookings: true,
      canModifyBookings: true,
      canManageUsers: false
    },
    [roles.DEALER_MANAGER]: {
      canApproveDealer: true,
      canUploadProduct: false,
      canManageTokens: true,
      canViewAnalytics: false,
      canViewBookings: true,
      canModifyBookings: false,
      canManageUsers: true
    },
    [roles.ANALYTICS_VIEWER]: {
      canApproveDealer: false,
      canUploadProduct: false,
      canManageTokens: false,
      canViewAnalytics: true,
      canViewBookings: true,
      canModifyBookings: false,
      canManageUsers: false
    },
    [roles.DEALER]: {
      canApproveDealer: false,
      canUploadProduct: false,
      canManageTokens: false,
      canViewAnalytics: false,
      canViewBookings: false,
      canModifyBookings: false,
      canManageUsers: false
    }
  };

  const labels = {
    [roles.SUPER_ADMIN]: 'Super Admin',
    [roles.CATALOGUE_MANAGER]: 'Catalogue Manager',
    [roles.DEALER_MANAGER]: 'Dealer Manager',
    [roles.ANALYTICS_VIEWER]: 'Analytics Viewer',
    [roles.DEALER]: 'Approved Dealer'
  };

  const tiers = {
    standard: 'Standard',
    premium: 'Premium',
    exclusive: 'Exclusive'
  };

  return {
    /**
     * @constant {string} SUPER_ADMIN - Super Administrator role ID
     */
    SUPER_ADMIN: roles.SUPER_ADMIN,

    /**
     * @constant {string} CATALOGUE_MANAGER - Catalogue Manager role ID
     */
    CATALOGUE_MANAGER: roles.CATALOGUE_MANAGER,

    /**
     * @constant {string} DEALER_MANAGER - Dealer Manager role ID
     */
    DEALER_MANAGER: roles.DEALER_MANAGER,

    /**
     * @constant {string} ANALYTICS_VIEWER - Analytics Viewer role ID
     */
    ANALYTICS_VIEWER: roles.ANALYTICS_VIEWER,

    /**
     * @constant {string} DEALER - Standard Dealer role ID
     */
    DEALER: roles.DEALER,

    /**
     * Access subscription tiers and their labels.
     * @type {object}
     */
    tiers,

    /**
     * Checks if a role is authorized for a specific administrative permission.
     * @param {string} role User role
     * @param {string} permission Permission key
     * @returns {boolean} True if permission is granted
     */
    hasPermission(role, permission) {
      return !!(matrix[role] && matrix[role][permission]);
    },

    /**
     * Retrieves a human-readable label for a role.
     * @param {string} role User role
     * @returns {string} Human-readable label
     */
    getLabel(role) {
      return labels[role] || role || 'Unknown';
    },

    /**
     * Checks if the given role represents an administrator status.
     * @param {string} role User role
     * @returns {boolean} True if administrative role
     */
    isAdmin(role) {
      return role !== roles.DEALER && Object.values(roles).includes(role);
    },

    /**
     * Returns an array of all administrative role identifiers.
     * @returns {string[]} List of administrative roles
     */
    getAdminRoles() {
      return [
        roles.SUPER_ADMIN,
        roles.CATALOGUE_MANAGER,
        roles.DEALER_MANAGER,
        roles.ANALYTICS_VIEWER
      ];
    }
  };
})();

