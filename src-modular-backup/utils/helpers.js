// ============================================================
// ZDRIVE - Helper Functions
// ============================================================

/**
 * Base64 encode for cursor
 */
export function b64(json) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(json))));
}

/**
 * Base64 decode for cursor
 */
export function ub64(s) {
  return JSON.parse(decodeURIComponent(escape(atob(s))));
}

/**
 * Escape special characters for Google Drive contains query
 */
export function escapeForDriveContains(q) {
  return (q || "").replace(/['\\]/g, "\\$&");
}

/**
 * Check if mimeType is a folder
 */
export function isFolder(mimeType) {
  return mimeType === "application/vnd.google-apps.folder";
}