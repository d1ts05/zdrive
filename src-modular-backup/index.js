export default {
  async fetch(request, env, ctx) {
    return new Response("ZDRIVE Temporary - Modular version under maintenance", {
      headers: { "content-type": "text/plain" }
    });
  }
};