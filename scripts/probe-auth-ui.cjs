const http = require('http');
const { DatabaseSync } = require('node:sqlite');

function request(method, urlPath, cookie) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3020,
        path: urlPath,
        method,
        headers: cookie ? { Cookie: cookie } : {},
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () =>
          resolve({ status: res.statusCode, headers: res.headers, body: data }),
        );
      },
    );
    req.on('error', reject);
    req.end();
  });
}

const db = new DatabaseSync(
  'C:\\rushilProcess\\PMProcesses\\Products\\IntelliDesk\\data\\intellidesk.db',
);
const employee = db.prepare("SELECT id FROM users WHERE email = 'employee@moglix.com'").get();
const agent = db.prepare("SELECT id FROM users WHERE email = 'agent@moglix.com'").get();
db.close();

(async () => {
  const portal = await request('GET', '/portal', `intellidesk_user=${employee.id}`);
  const agentPage = await request('GET', '/agent', `intellidesk_user=${agent.id}`);
  console.log('portal', portal.status, {
    hero: portal.body.includes('portal-hero'),
    header: portal.body.includes('portal-header'),
    navyClass: portal.body.includes('portal-nav'),
    deptLine: portal.body.includes('portal-dept-line') || !portal.body.includes('Department'),
  });
  console.log('agent', agentPage.status, {
    sidebar: agentPage.body.includes('desk-sidebar'),
    queue: agentPage.body.includes('Ticket queue'),
    dueToday: agentPage.body.includes('Due today'),
    priority: agentPage.body.includes('Priority'),
  });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
