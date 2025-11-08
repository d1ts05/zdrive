// ============================================================
// ZDRIVE - Configuration & Constants
// ============================================================

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

// Pagination & Limits
export const DEFAULT_PAGE_SIZE = 100;
export const MAX_SEARCH_PAGES = 30;
export const MAX_SEARCH_RESULTS = 300;

// ZIP Download Limits
export const MAX_ZIP_FILES = 100;
export const MAX_ZIP_BYTES = 200 * 1024 * 1024; // 200MB

// Cache Settings
export const CACHE_MAX_AGE = 60; // seconds

// Security
export const MAX_ANCESTRY_DEPTH = 50;