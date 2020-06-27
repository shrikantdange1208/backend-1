function define(name, value) {
    Object.defineProperty(exports, name, {
        value:      value,
        enumerable: true
    });
}

define("NAME", "name");
define("CATEGORY", "category");
define("CATEGORIES", "categories");
define("BRANCHES", "branches");
define("BRANCH", "branch");
define("PRODUCT", "product");
define("PRODUCTS", "products");
define("OPERATION", "operation");
define("OPERATIONS", "operations");
define("THRESHOLD", "threshold");
define("THRESHOLDS", "thresholds");
define("DESCRIPTION", "description");
define("LABEL", "label");
define("IS_ACTIVE", "isActive");
define("CREATED_DATE", "createdDate");
define("LAST_UPDATED_DATE", "lastUpdatedDate");
define("TOTAL_CATEGORIES", "totalCategories");
define("TOTAL_BRANCHES", "totalBranches");
define("TOTAL_PRODUCTS", "totalProducts");
define("TOTAL_OPERATIONS", "totalOperations");
define("TOTAL_UNITS", "totalUnits");
define("TOTAL", "total");
define("STATUS", "status");
define("UNIT", "unit");
define("UNITS", "units");
define("CREATE", "create");
define("UPDATE", "update");
define("DELETE", "delete");
define("ADMIN", "admin");
define("SYSTEM", "system");
define("ENTITY", "entity");
define("PROPERTY", "property");
define("USERS", "users");
define("ROLES", "roles");
define("PERMISSIONS", "permissions");
define("INVENTORY", "inventory");
define("IS_BELOW_THRESHOLD", "isBelowThreshold");
define("UNAUTHORIZED", "Unauthorized");

// Audit constants
define("AUDIT", "audit");
define("USER", "user");
define("UID", "uid");
define("EMAIL", "email");
define("TIMESTAMP", "timestamp");
define("DATE", "date");
define("EVENT", "event");
