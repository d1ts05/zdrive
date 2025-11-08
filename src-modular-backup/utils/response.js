// ============================================================
// ZDRIVE - Response Helpers
// ============================================================

import { CACHE_MAX_AGE } from '../config/constants.js';

/**
 * Create JSON success response
 */
export function jsonOk(body, extra = {}) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "cache-control": `public, max-age=${CACHE_MAX_AGE}`,
      "access-control-allow-origin": "*",
      ...extra,
    },
  });
}

/**
 * Create JSON error response
 */
export function jsonErr(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "access-control-allow-origin": "*",
    },
  });
}

/**
 * Create CORS preflight response
 */
export function corsResponse() {
  return new Response(null, {
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,OPTIONS",
      "access-control-allow-headers": "Content-Type,Authorization,Range",
    },
  });
}

/**
 * Encode filename for RFC5987 (UTF-8 in headers)
 */
export function encodeRFC5987ValueChars(str) {
  return encodeURIComponent(str)
    .replace(/['()]/g, escape)
    .replace(/\*/g, "%2A");
}