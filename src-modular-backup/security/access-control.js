// ============================================================
// ZDRIVE - Access Control & Security
// ============================================================

import { getAccessToken } from '../auth/google-oauth.js';
import { DRIVE_API_BASE, MAX_ANCESTRY_DEPTH } from '../config/constants.js';

/**
 * Check if a file is descendant of root folder (security check)
 * @param {object} env - Environment variables
 * @param {string} fileId - File ID to check
 * @returns {Promise<boolean>} True if file is allowed
 */
export async function isDescendantOfRoot(env, fileId) {
  const token = await getAccessToken(env);
  let current = fileId;

  for (let i = 0; i < MAX_ANCESTRY_DEPTH; i++) {
    const res = await fetch(
      `${DRIVE_API_BASE}/files/${current}?fields=parents&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      throw new Error(`Ancestry check failed: ${res.status}`);
    }

    const data = await res.json();
    const parents = data.parents || [];

    // Found root folder in ancestry
    if (parents.includes(env.ROOT_FOLDER_ID)) {
      return true;
    }

    // No more parents (reached root)
    if (!parents.length) {
      return current === env.ROOT_FOLDER_ID;
    }

    // Move up to parent
    current = parents[0];
  }

  // Max depth reached without finding root
  return false;
}