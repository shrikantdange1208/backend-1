function define(name, value) {
    Object.defineProperty(exports, name, {
        value:      value,
        enumerable: true
    });
}

define("NAME", "name");
define("FIRST_NAME", "firstName");
define("LAST_NAME", "lastName");
define("ID", "id");
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
define("IS_HEAD_OFFICE", "isHeadOffice");
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
define("SUPER_ADMIN", "superadmin");
define("ENTITY", "entity");
define("PROPERTY", "property");
define("USERS", "users");
define("USER", "user");
define("ROLES", "roles");
define("PERMISSIONS", "permissions");
define("INVENTORY", "inventory");
define("IS_BELOW_THRESHOLD", "isBelowThreshold");
define("UNAUTHORIZED", "Unauthorized");
define("UNAUTHENTICATED", "Unauthenticated");

// Audit constants
define("AUDIT", "audit");
define("USER", "user");
define("UID", "uid");
define("EMAIL", "email");
define("TIMESTAMP", "timestamp");
define("DATE", "date");
define("EVENT", "event");
define("BEFORE", "before");
define("AFTER", "after");

//Transaction constants
define("TRANSACTIONS", "transactions");
define("TRANSFER_REQUESTS", "transferRequests");
define("PENDING_REQUESTS", "pendingRequests");
define("NEXT_PAGE_TOKEN","nextPageToken");
define("PREV_PAGE_TOKEN","prevPageToken");
define("FROM_DATE", "fromDate");
define("TO_DATE", "toDate");
define("REPORT", "report");
//TODO : Need to modify page size before handing over
define("PAGE_SIZE",50);
define("TRANSACTION_ID","transactionId");

// Action constants
define("TRANSACTIONID", "transactionId");
define("ADD_PRODUCT", "addProduct");
define("ISSUE_PRODUCT", "issueProduct");
define("TRANSFER_IN", "transferIn");
define("TRANSFER_OUT", "transferOut");
define("ADJUSTMENT", "adjustment");
define("AVAILABLE_QUANTITY", "availableQuantity");
define("INITIAL_QUANTITY", "initialQuantity");
define("CLOSING_QUANTITY", "closingQuantity");
define("ADDED_QUANTITY", "addedQuantity");
define("CONSUMED_QUANTITY", "consumedQuantity");
define("OPERATIONAL_QUANTITY", "operationalQuantity");
define("TRANSFERRED_QUANTITY", "transferredQuantity");
define("NOTE", "note");

define("REQUEST", "request");
define("ACCEPT", "accept");
define("MOVE", "move");
define("REJECT", "reject");
define("STATE", "state");
define("ACCEPTED", "ACCEPTED");
define("REJECTED", "REJECTED");
define("PENDING", "PENDING");

define("METADATA", "metadata");
define("DASHBOARD", "dashboard");
define("RECENT_ACTIVITY", "recentActivity")
define("PRODUCTS_BELOW_THRESHOLD","productsBelowThreshold")
define("TOTAL_PRODUCTS_IN_INVENTORY","totalProductsInInventory")
define("TOTAL_PRODUCTS_BELOW_THRESHOLD","totalProductsBelowThreshold")
