export default {
  async fetch(request, env) {
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response('Endpoint lama sudah ditutup.', { status: 410 });
    const source = new URL(request.url);
    const target = new URL('https://celeyo.com/i/adam-nadhila');
    target.search = source.search;
    return Response.redirect(target.toString(), env.REDIRECT_PERMANENT === 'true' ? 301 : 302);
  },
};
