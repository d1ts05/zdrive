// ============================================================
// ZDRIVE - Tree API (Recursive folder tree for ZIP)
// ============================================================

import { getAccessToken } from '../auth/google-oauth.js';
import { DRIVE_API_BASE } from '../config/constants.js';

/**
 * Get complete folder tree recursively (for ZIP download)
 * @param {object} env - Environment variables
 * @param {string} folderId - Root folder ID
 * @returns {Promise<object>} Tree structure with all files
 */
export async function treeFiles(env, folderId) {  // ← Tambahkan "export" di sini!
  const token = await getAccessToken(env);

  // Get root folder metadata
  const head = await fetch(
    `${DRIVE_API_BASE}/files/${folderId}?fields=id,name&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!head.ok) {
    throw new Error(`Root metadata failed: ${head.status}`);
  }

  const rootMeta = await head.json();

  const files = [];
  const queue = [{ id: folderId, path: "" }];

  // BFS traversal of folder tree
  while (queue.length) {
    const cur = queue.shift();
    
    const params = new URLSearchParams({
      q: `'${cur.id}' in parents and trashed=false`,
      fields: "nextPageToken, files(id,name,mimeType,size)",
      pageSize: "1000",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    });

    let pageToken = null;
    do {
      if (pageToken) {
        params.set("pageToken", pageToken);
      }

      const res = await fetch(`${DRIVE_API_BASE}/files?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Tree listing failed: ${res.status}`);
      }

      const data = await res.json();

      for (const it of data.files || []) {
        const isFolder = it.mimeType === "application/vnd.google-apps.folder";
        
        if (isFolder) {
          // Add subfolder to queue
          queue.push({
            id: it.id,
            path: (cur.path ? cur.path + "/" : "") + it.name,
          });
        } else {
          // Add file to results with full path
          files.push({
            id: it.id,
            name: it.name,
            mimeType: it.mimeType,
            size: it.size || "0",
            path: (cur.path ? cur.path + "/" : "") + it.name,
          });
        }
      }

      pageToken = data.nextPageToken || null;
    } while (pageToken);
  }

  return {
    root: { id: folderId, name: rootMeta.name || "Folder" },
    files
  };
}