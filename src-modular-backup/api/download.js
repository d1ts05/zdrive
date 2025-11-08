// ============================================================
// ZDRIVE - Download & Preview API
// ============================================================

import { getAccessToken } from '../auth/google-oauth.js';
import { isDescendantOfRoot } from '../security/access-control.js';
import { getMeta } from './list.js';
import { encodeRFC5987ValueChars } from '../utils/response.js';
import { DRIVE_API_BASE } from '../config/constants.js';

/**
 * Download file with proper headers
 * @param {object} env - Environment variables
 * @param {string} fileId - File ID to download
 * @returns {Promise<Response>} File download response
 */
export async function downloadFile(env, fileId) {
  // Security check
  const allowed = await isDescendantOfRoot(env, fileId);
  if (!allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  const meta = await getMeta(env, fileId);
  const token = await getAccessToken(env);
  const url = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;
  
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const name = meta?.name || fileId;
  const mime = meta?.mimeType || res.headers.get("content-type") || "application/octet-stream";

  const headers = new Headers(res.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("content-type", mime);

  // Set Content-Disposition for download with UTF-8 filename support
  const ascii = name.replace(/[^\x20-\x7E]/g, "_");
  const utf8 = encodeRFC5987ValueChars(name);
  headers.set(
    "content-disposition",
    `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`
  );

  return new Response(res.body, { status: res.status, headers });
}

/**
 * Preview file inline (for images, PDFs, etc)
 * @param {object} env - Environment variables
 * @param {string} fileId - File ID to preview
 * @returns {Promise<Response>} File preview response
 */
export async function previewFile(env, fileId) {
  // Security check
  const allowed = await isDescendantOfRoot(env, fileId);
  if (!allowed) {
    return new Response("Forbidden", { status: 403 });  
  }

  const meta = await getMeta(env, fileId);
  const token = await getAccessToken(env);
  const url = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;
  
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const headers = new Headers(res.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("content-type", meta?.mimeType || "application/pdf");
  headers.set("content-disposition", "inline");
  headers.set("x-content-type-options", "nosniff");
  
  return new Response(res.body, { status: res.status, headers });
}