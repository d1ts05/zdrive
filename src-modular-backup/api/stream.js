// ============================================================
// ZDRIVE - Stream API (Video/Audio with Range support)
// ============================================================

import { getAccessToken } from '../auth/google-oauth.js';
import { isDescendantOfRoot } from '../security/access-control.js';
import { DRIVE_API_BASE } from '../config/constants.js';

/**
 * Stream video/audio file with Range support
 * @param {object} env - Environment variables
 * @param {Request} request - Original request (for Range header)
 * @param {string} fileId - File ID to stream
 * @returns {Promise<Response>} Streaming response
 */
export async function streamFile(env, request, fileId) {
  // Security check
  const allowed = await isDescendantOfRoot(env, fileId);
  if (!allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  const token = await getAccessToken(env);
  const range = request.headers.get("range");
  const url = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;

  // Forward Range header if present (for video seeking)
  const headers = range
    ? { Authorization: `Bearer ${token}`, Range: range }
    : { Authorization: `Bearer ${token}` };

  const res = await fetch(url, { headers });

  const responseHeaders = new Headers(res.headers);
  responseHeaders.set("access-control-allow-origin", "*");
  responseHeaders.set("accept-ranges", "bytes");
  
  return new Response(res.body, {
    status: res.status,
    headers: responseHeaders
  });
}