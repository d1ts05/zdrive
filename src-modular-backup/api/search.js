// ============================================================
// ZDRIVE - Deep Search API (BFS with cursor)
// ============================================================

import { getAccessToken } from '../auth/google-oauth.js';
import { jsonOk } from '../utils/response.js';
import { b64, ub64, escapeForDriveContains } from '../utils/helpers.js';
import { DRIVE_API_BASE, MAX_SEARCH_PAGES, MAX_SEARCH_RESULTS, DEFAULT_PAGE_SIZE } from '../config/constants.js';

/**
 * Deep search through all folders (BFS algorithm with pagination cursor)
 * @param {object} env - Environment variables
 * @param {string} q - Search query
 * @param {string} cursor - Pagination cursor (optional)
 * @returns {Promise<Response>} Search results with next cursor
 */
export async function deepSearch(env, q, cursor) {
  const token = await getAccessToken(env);

  // Decode state from cursor or initialize new search
  let state = cursor
    ? ub64(cursor)
    : { queue: [env.ROOT_FOLDER_ID], current: null, q };

  const safe = escapeForDriveContains(q);
  const results = [];
  let pages = 0;

  // BFS search with pagination
  while (pages < MAX_SEARCH_PAGES && results.length < MAX_SEARCH_RESULTS) {
    // Get next folder from queue
    if (!state.current) {
      const next = state.queue.shift();
      if (!next) break; // Queue exhausted
      state.current = { id: next, pageToken: null };
    }

    // Build search query for current folder
    const params = new URLSearchParams({
      q: `'${state.current.id}' in parents and trashed=false and (name contains '${safe}' or mimeType='application/vnd.google-apps.folder')`,
      fields: "nextPageToken, files(id,name,mimeType,modifiedTime,size,iconLink,thumbnailLink)",
      pageSize: String(DEFAULT_PAGE_SIZE),
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    });

    if (state.current.pageToken) {
      params.set("pageToken", state.current.pageToken);
    }

    const req = new Request(`${DRIVE_API_BASE}/files?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await fetch(req);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Drive search failed: ${res.status} ${errorText}`);
    }

    const data = await res.json();
    pages++;

    // Process results: add folders to queue, files to results
    for (const it of data.files || []) {
      const isFolder = it.mimeType === "application/vnd.google-apps.folder";
      if (isFolder) {
        state.queue.push(it.id); // Explore this folder later
      } else {
        results.push(it); // Add file to results
      }
    }

    // Update pagination state
    if (data.nextPageToken) {
      state.current.pageToken = data.nextPageToken;
    } else {
      state.current = null; // Done with this folder
    }
  }

  // Create cursor for next page if search is not complete
  const nextCursor =
    state.current || state.queue.length
      ? b64({ queue: state.queue, current: state.current, q })
      : null;

  return jsonOk({ files: results, nextCursor });
}