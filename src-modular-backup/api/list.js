// ============================================================
// ZDRIVE - List Files API
// ============================================================

import { getAccessToken } from '../auth/google-oauth.js';
import { DRIVE_API_BASE, DEFAULT_PAGE_SIZE, CACHE_MAX_AGE } from '../config/constants.js';

/**
 * List files in a folder with caching
 * @param {object} env - Environment variables
 * @param {string} folderId - Folder ID to list
 * @param {string} pageToken - Pagination token (optional)
 * @param {object} ctx - Execution context for cache
 * @returns {Promise<Response>} Response with file list
 */
export async function listFiles(env, folderId, pageToken, ctx) {
  const token = await getAccessToken(env);
  
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "nextPageToken, files(id,name,mimeType,modifiedTime,size,iconLink,thumbnailLink)",
    pageSize: String(DEFAULT_PAGE_SIZE),
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });
  
  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const url = `${DRIVE_API_BASE}/files?${params}`;
  const req = new Request(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // Try to get from cache
  const cache = caches.default;
  let resp = await cache.match(req);

  if (!resp) {
    // Not in cache, fetch from Google Drive
    const res = await fetch(req);
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Drive list failed: ${res.status} ${errorText}`);
    }

    // Create cacheable response
    resp = new Response(await res.text(), {
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "cache-control": `public, max-age=${CACHE_MAX_AGE}`,
        "access-control-allow-origin": "*",
      },
    });

    // Store in cache (async)
    ctx.waitUntil(cache.put(req, resp.clone()));
  }

  return resp;
}

/**
 * Get file metadata
 * @param {object} env - Environment variables
 * @param {string} fileId - File ID
 * @returns {Promise<object>} File metadata
 */
export async function getMeta(env, fileId) {
  const token = await getAccessToken(env);
  
  const res = await fetch(
    `${DRIVE_API_BASE}/files/${fileId}?fields=id,name,mimeType,size&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    throw new Error(`Metadata fetch failed: ${res.status}`);
  }

  return res.json();
}