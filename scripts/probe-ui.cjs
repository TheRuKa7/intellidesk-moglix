const http = require('http');

function get(path) {
  return new Promise((res, rej) => {
    http
      .get('http://127.0.0.1:3020' + path, (r) => {
        let d = '';
        r.on('data', (c) => (d += c));
        r.on('end', () => res({ status: r.statusCode, body: d, headers: r.headers }));
      })
      .on('error', rej);
  });
}

(async () => {
  const home = await get('/');
  console.log('HOME', home.status, 'login-page', home.body.includes('login-page'));
  const m = home.body.match(/href="(\/_next\/static\/[^"]+\.css)"/);
  console.log('CSS', m && m[1]);
  if (m) {
    const css = await get(m[1]);
    const o = (css.body.match(/\{/g) || []).length;
    const c = (css.body.match(/\}/g) || []).length;
    console.log('size', css.body.length, 'bal', o - c);
    console.log(
      'desk',
      css.body.includes('desk-sidebar'),
      'navy-portal',
      css.body.includes('--navy'),
      'ticket-tabs',
      css.body.includes('ticket-tabs'),
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
