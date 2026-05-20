const { createHandler, sendJson } = require('../_lib/http');
const {
    loadDetailedPermissions,
    getAllDesignations,
    saveDetailedPermissions,
    checkActionPermission,
    getDesignationActions,
    getAllDesignationPermissions
} = require('../_lib/services');

module.exports = createHandler({
    GET: async ({ res, query }) => {
        const { designation, action } = query || {};

        if (designation && action) {
            // Check specific action permission
            const allowed = checkActionPermission(designation, action.split('.')[0], action.split('.')[1]);
            return sendJson(res, 200, { allowed });
        }

        if (designation) {
            // Get all permissions for a designation
            const perms = getAllDesignationPermissions(designation);
            return sendJson(res, 200, perms);
        }

        // Get all designations with their permissions
        const allDesignations = getAllDesignations();
        const permissions = loadDetailedPermissions();
        
        return sendJson(res, 200, {
            designations: allDesignations,
            permissions: permissions.designations || {}
        });
    },

    POST: async ({ res, body }) => {
        if (!body || typeof body !== 'object') {
            const error = new Error('Invalid request body');
            error.statusCode = 400;
            throw error;
        }

        const saved = await saveDetailedPermissions(body);
        
        if (!saved) {
            const error = new Error('Failed to save permissions');
            error.statusCode = 500;
            throw error;
        }

        const updated = loadDetailedPermissions();
        sendJson(res, 200, { success: true, permissions: updated });
    }
});
