// ============================================================
// ZDRIVE - Google OAuth Authentication
// ============================================================

import { GOOGLE_TOKEN_URL } from '../config/constants.js';

/**
 * Get Google Drive access token from refresh token
 * @param {object} env - Environment variables (secrets)
 * @returns {Promise<string>} Access token
 */
export async function getAccessToken(env) {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: env.GOOGLE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${errorText}`);
  }

  const json = await res.json();
  return json.access_token;
}