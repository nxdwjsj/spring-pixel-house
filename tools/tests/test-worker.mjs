/* worker.js 单元测试（Node 原生 Request/Response + 内存 KV） */
import { readFileSync, writeFileSync, rmSync } from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { join } from 'path';

/* 根 package.json 无 "type":"module"，worker.js(ESM) 需复制成 .mjs 才能被 Node import */
const srcPath = fileURLToPath(new URL('../../worker.js', import.meta.url));
const tmpPath = join(tmpdir(), 'sp-worker-under-test.mjs');
writeFileSync(tmpPath, readFileSync(srcPath, 'utf8'));
const mod = await import(pathToFileURL(tmpPath).href);
process.on('exit', () => { try { rmSync(tmpPath); } catch (e) {} });
const worker = mod.default;

let pass = 0, fail = 0;
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' — ' + x : '')); } };

function makeKV() {
  const map = new Map();
  return {
    async get(k, type) {
      const v = map.get(k);
      if (v === undefined) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(k, v) { map.set(k, v); },
    _map: map
  };
}
const ADMIN = 'secret-123';
const env = { DATA: makeKV(), ADMIN_KEY: ADMIN, ASSETS: { fetch: () => new Response('static', { status: 200 }) } };
const H = { 'content-type': 'application/json', 'x-admin-key': ADMIN };
const call = (path, opts = {}) => worker.fetch(new Request('https://blog.dev' + path, {
  method: opts.method || 'GET',
  headers: opts.raw ? opts.raw : H,
  body: opts.body ? JSON.stringify(opts.body) : undefined
}), env);
const json = r => r.json();

console.log('\n[1] 公开接口');
let r = await call('/api/ping');
let d = await json(r);
ok(r.status === 200 && d.cloud === true && d.admin === true, 'GET /api/ping');
r = await call('/api/posts');
d = await json(r);
ok(Array.isArray(d.posts) && d.posts.length === 0, 'GET /api/posts 初始为空');
r = await call('/api/visitors');
d = await json(r);
ok(d.total === 0 && d.unique === 0, 'GET /api/visitors 初始 0');
r = await call('/api/nope');
ok(r.status === 404, '未知接口 404');

console.log('\n[2] 访客上报（去重 + 隐私字段）');
r = await call('/api/visit', { method: 'POST', body: { vid: 'aaa', r: 'https://x.dev/' } });
d = await json(r);
ok(r.status === 200 && d.total === 1 && d.unique === 1 && d.mine === 1, '首次到访 total/unique/mine=1');
r = await call('/api/visit', { method: 'POST', body: { vid: 'aaa' } });
d = await json(r);
ok(d.total === 2 && d.unique === 1 && d.mine === 2, '同 vid 再访 total=2 unique=1 mine=2');
r = await call('/api/visit', { method: 'POST', body: { vid: 'bbb' } });
d = await json(r);
ok(d.total === 3 && d.unique === 2, '新 vid → unique=2');
ok(d.recent[0] && !('ip' in d.recent[0]) && 'd' in d.recent[0], 'recent 含设备且无 IP 字段');
r = await call('/api/visitors');
d = await json(r);
ok(d.total === 3 && d.unique === 2, 'GET /api/visitors 汇总一致');

console.log('\n[3] 管理鉴权');
r = await call('/api/admin/ping', { raw: { 'content-type': 'application/json', 'x-admin-key': 'wrong' } });
ok(r.status === 401, '错误密钥 401');
r = await call('/api/admin/ping', { raw: { 'content-type': 'application/json' } });
ok(r.status === 401, '缺密钥 401');
r = await call('/api/admin/ping');
ok(r.status === 200, '正确密钥 200');

console.log('\n[4] 管理文章');
const post = { slug: 'hello-world', title: '你好世界', date: '2026-09-30', tags: ['测试'],
  summary: '摘要', body: '## 正文\n\n内容', animal: 'fox', theme: 'sky', deco: 'd-peek' };
r = await call('/api/admin/posts', { method: 'PUT', body: post });
d = await json(r);
ok(r.status === 200 && d.ok && d.count === 1, 'PUT 新文章');
r = await call('/api/admin/posts', { method: 'PUT', body: { slug: 'BAD slug!', title: 'x', body: 'y' } });
ok(r.status === 400, '非法 slug 拒绝');
r = await call('/api/admin/posts', { method: 'PUT', body: { slug: 'no-body', title: 'x' } });
ok(r.status === 400, '缺正文拒绝');
r = await call('/api/posts');
d = await json(r);
ok(d.posts.length === 1 && d.posts[0].animal === 'fox' && d.posts[0].theme === 'sky', 'GET /api/posts 可读回');
r = await call('/api/admin/posts', { method: 'PUT', body: { ...post, title: '改标题' } });
d = await json(r);
ok(d.count === 1, '同 slug 覆盖不新增');
r = await call('/api/admin/posts/hello-world', { method: 'DELETE' });
d = await json(r);
ok(r.status === 200 && d.count === 0, 'DELETE 文章');
r = await call('/api/admin/posts/hello-world', { method: 'DELETE' });
ok(r.status === 404, '再删 404');

console.log('\n[5] 管理恋爱存档');
const love = {
  v: 2,
  milestones: [
    { date: '2026-03-15', title: '在一起', desc: '开始' },
    { date: '', title: '第 520 天', desc: '', days: 520 },
    { date: '', title: '农历生日', desc: '', lunar: '08-15', leap: true },
    { date: '2026-04-01', title: '缺天数', days: 0, desc: '' },
    { date: '2026-04-02', title: '坏农历', lunar: '13-40', desc: '' }
  ],
  anniversaries: [
    { date: '2027-03-15', title: '一周年', note: '第一个365', yearly: true },
    { date: '', title: '中秋', note: '月饼节', yearly: true, lunar: '08-15', leap: false },
    { date: 'bad-date', title: '坏日期', note: '', yearly: false }],
  memories: [{ title: '便签', text: '糖分' }]
};
r = await call('/api/admin/love', { method: 'PUT', body: love });
ok(r.status === 200, 'PUT /api/admin/love');
r = await call('/api/love');
d = await json(r);
ok(d.milestones.length === 5 && d.anniversaries.length === 2 && d.memories.length === 1,
  '非法条目被过滤', JSON.stringify(d.milestones) + JSON.stringify(d.anniversaries));
ok(d.anniversaries[0].yearly === true, 'yearly 保留');
ok(d.v === 2, '种子版本号 v 保留', 'v=' + d.v);
ok(d.milestones.some(m => m.days === 520), 'days 天数保留', JSON.stringify(d.milestones));
ok(d.milestones.some(m => m.lunar === '08-15' && m.leap === true), 'lunar/leap 保留');
ok(d.milestones.every(m => !('days' in m) || m.days >= 1), 'days:0 不落库');
ok(d.milestones.find(m => m.title === '坏农历') && !d.milestones.find(m => m.title === '坏农历').lunar,
  '非法 lunar 被剥离');
ok(d.anniversaries.some(a => a.lunar === '08-15' && a.yearly === true),
  '农历纪念日保留（可无公历 date）', JSON.stringify(d.anniversaries));
r = await call('/api/admin/love', { method: 'PUT', body: null });
ok(r.status === 400, '空体拒绝');

console.log('\n[6] 管理相册');
const tiny = 'data:image/jpeg;base64,/9j/4AAQSkZJRg';
r = await call('/api/admin/photos', { method: 'PUT', body: { photos: [
  { id: 'p1', date: '2026-09-30', caption: '合影', album: '生活', data: tiny }] } });
ok(r.status === 200, 'PUT 合法照片');
r = await call('/api/admin/photos', { method: 'PUT', body: { photos: [{ id: 'p2', data: 'not-image' }] } });
ok(r.status === 400, '非 dataURL 拒绝');
r = await call('/api/admin/photos', { method: 'PUT', body: { photos: [{ id: 'p3', data: 'data:image/jpeg;base64,' + 'A'.repeat(1600000) }] } });
ok(r.status === 400, '超大照片拒绝');
r = await call('/api/admin/photos', { method: 'PUT', body: { photos: Array.from({ length: 61 }, (_, i) => ({ id: 'p' + i, data: tiny })) } });
ok(r.status === 400, '超过 60 张拒绝');
r = await call('/api/love');
d = await json(r);
ok(d.photos.length === 1 && d.photos[0].caption === '合影' && d.photos[0].album === '生活',
  'GET /api/love 带出照片与合集');

console.log('\n[7] 未设 ADMIN_KEY 时关闭后台');
const env2 = { DATA: makeKV(), ASSETS: { fetch: () => new Response('s') } };
const r2 = await worker.fetch(new Request('https://blog.dev/api/admin/ping', { headers: H }), env2);
ok(r2.status === 401, '无密钥环境一律 401');
const r3 = await worker.fetch(new Request('https://blog.dev/api/ping'), env2);
ok((await r3.json()).admin === false, 'ping 报告 admin:false');

console.log('\n[8] 静态资源兜底');
const r4 = await worker.fetch(new Request('https://blog.dev/index.html'), env);
ok(r4.status === 200, '非 /api 走 ASSETS');

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
