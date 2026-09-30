/* 云端模式前端测试：fetch stub 模拟 Cloudflare Worker */
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const HTML = fs.readFileSync(require('path').join(__dirname, '..', '..', 'index.html'), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) errors.push(e.message); });
vc.on('error', (...a) => errors.push(a.join(' ')));

let pass = 0, fail = 0;
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? ' — ' + x : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* 内存中的“云端” */
const cloud = {
  posts: [{ slug: 'cloud-post', title: '云端文章', date: '2026-10-01', tags: ['云端'],
    summary: '来自 KV', body: '## 云端正文\n\n内容', animal: 'owl', theme: 'sky', deco: 'd-peek' }],
  love: { milestones: [], anniversaries: [], memories: [] },
  photos: [{ id: 'p1', date: '2026-10-01', caption: '云端照片', data: 'data:image/jpeg;base64,xx' }],
  visitors: { total: 42, unique: 7, recent: [
    { t: Date.now() - 36e5, c: 'CN', v: 'new', n: 3, r: '', d: '手机' }] }
};
const calls = [];
function router(url, opts) {
  const p = url.replace(/\/+$/, '');
  const method = (opts.method || 'GET').toUpperCase();
  const key = (opts.headers || {})['X-Admin-Key'];
  const body = opts.body ? JSON.parse(opts.body) : null;
  calls.push(method + ' ' + p);
  const J = (o, status) => ({ ok: !(status && status >= 400), status: status || 200, json: async () => o });
  if (p === '/api/ping') return J({ ok: true, cloud: true, admin: true });
  if (p === '/api/posts') return J({ posts: cloud.posts });
  if (p === '/api/love') return J({ ...cloud.love, photos: cloud.photos });
  if (p === '/api/visitors') return J({ total: cloud.visitors.total, unique: cloud.visitors.unique, recent: cloud.visitors.recent });
  if (p === '/api/visit') { cloud.visitors.total++; return J({ total: cloud.visitors.total, unique: cloud.visitors.unique, recent: cloud.visitors.recent, mine: 9 }); }
  if (p === '/api/admin/ping') return key === 'sky-key' ? J({ ok: true }) : J({ error: '管理员密钥不正确' }, 401);
  if (p === '/api/admin/posts' && method === 'PUT') {
    if (key !== 'sky-key') return J({ error: '管理员密钥不正确' }, 401);
    const i = cloud.posts.findIndex(x => x.slug === body.slug);
    if (i >= 0) cloud.posts[i] = body; else cloud.posts.push(body);
    return J({ ok: true, count: cloud.posts.length });
  }
  if (p.startsWith('/api/admin/posts/') && method === 'DELETE') {
    if (key !== 'sky-key') return J({ error: '管理员密钥不正确' }, 401);
    const slug = decodeURIComponent(p.split('/').pop());
    cloud.posts = cloud.posts.filter(x => x.slug !== slug);
    return J({ ok: true, count: cloud.posts.length });
  }
  return J({ error: '接口不存在' }, 404);
}

(async () => {
  const dom = new JSDOM(HTML, {
    url: 'http://blog.dev/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      w.IntersectionObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };
      w.fetch = (url, opts = {}) => Promise.resolve(router(String(url), opts));
      w.scrollTo = () => {};
      w.confirm = () => true;
      w.Element.prototype.scrollIntoView = function () {};
      w.URL.createObjectURL = () => 'blob:t';
      w.URL.revokeObjectURL = () => {};
      w.addEventListener('error', e => errors.push('onerror: ' + e.message));
    }
  });
  const w = dom.window, d = w.document;
  const $ = s => d.querySelector(s);
  const $$ = s => Array.from(d.querySelectorAll(s));

  console.log('\n[1] 云端启动');
  for (let i = 0; i < 60 && !w.Store; i++) await sleep(50);
  await sleep(300);
  const S = w.eval('Store');
  ok(S.cloud === true, '识别为云端模式');
  ok(S.posts.length === 3 && S.posts.some(p => p.slug === 'cloud-post'),
    '云端文章保留，缺的新种子自动补入', '实际 ' + S.posts.length);
  ok($$('#postGrid .card').length === 3 && $('#postGrid .card').dataset.animal === 'owl', '卡片 3 张，首卡动物 owl');
  ok($('#postGrid .card').classList.contains('t-sky'), '主题色 t-sky');
  ok($$('#loveLine li').length === 7 && $$('#loveLine li[data-date]').length === 7,
    '云端空爱档 → 自动补齐 7 条种子轨迹', '实际 ' + $$('#loveLine li').length);
  ok($$('#annivList .anniv').length === 4 &&
    $$('#annivList .anniv').some(a => a.dataset.lunar === '08-15'),
    '种子纪念日补齐（含中秋农历）', '实际 ' + $$('#annivList .anniv').length);
  ok($$('#memList .sweet').length === 3, '种子便签补齐 3 张');
  ok(S.love.v === 2, '合并后打上种子版本号 v=2', 'v=' + S.love.v);
  ok(!$('#loveNext').textContent.includes('NaN'), '下一个存档点无 NaN', $('#loveNext').textContent);
  ok(!!$('#albumGrid .album-item') && $$('#albumGrid .album-item').length === 1, '云端相册 1 张');

  console.log('\n[2] 云端访客');
  await sleep(150);
  ok($('#visitorNum').textContent === '43', '到访后 total=43', $('#visitorNum').textContent);
  ok($('#visitorUni').textContent === '7', '独立访客 7');
  ok($('#visitorMode').textContent.includes('云端统计') && $('#visitorMode').textContent.includes('第 9 次'), '云端文案含本次第 9 次');
  ok($$('#visitorList li').length >= 1 && $('#visitorList').textContent.includes('手机'), '到访列表含设备');

  console.log('\n[3] 云端阅读页');
  w.location.hash = '#/post/cloud-post';
  await sleep(150);
  ok($('#dTitle').textContent === '云端文章', '打开云端文章');
  ok($('#dBody').innerHTML.includes('<h2>云端正文</h2>'), 'Markdown 已渲染');
  ok($('#postDetail').classList.contains('t-sky'), '阅读页跟随 t-sky');
  w.location.hash = '#posts';
  await sleep(150);

  console.log('\n[4] 云端站长登录 + 发文（走真实 PUT）');
  $('#adminBtn').click();
  await sleep(50);
  $('#keyInput').value = 'wrong';
  $('#loginBtn').click();
  await sleep(150);
  ok($('#loginMsg').textContent.includes('密钥不对'), '错密钥被拒');
  $('#keyInput').value = 'sky-key';
  $('#loginBtn').click();
  await sleep(200);
  ok($('#adminPanes').hidden === false, '正确密钥登录成功');
  $('#edTitle').value = '第二篇';
  $('#edTitle').dispatchEvent(new w.Event('input', { bubbles: true }));
  $('#edBody').value = '正文内容';
  $('#edBody').dispatchEvent(new w.Event('input', { bubbles: true }));
  $('#edSave').click();
  await sleep(400);
  ok(S.posts.length === 4 && cloud.posts.length === 2, '云端 PUT 落库（本地 3+1，云端 1+1）', 'cloud=' + cloud.posts.length);
  ok(S.seeded === false, '种子不再标记待写入');
  ok(calls.some(c => c === 'PUT /api/admin/posts'), '发出过 PUT /api/admin/posts');
  ok($$('#postGrid .card').length === 4, '列表 4 张卡');
  const puts = calls.filter(c => c === 'PUT /api/admin/posts').length;
  ok(puts >= 1, 'PUT 次数 ≥1（seeded=false 时不重复写种子）', String(puts));

  console.log('\n[5] 云端保存已有种子文章（seeded 分支验证）');
  /* 直接把 seeded 置回 true 模拟：云端原本为空时的首次保存 */
  S.seeded = true;
  $('#edTitle').value = '第三篇';
  $('#edTitle').dispatchEvent(new w.Event('input', { bubbles: true }));
  $('#edBody').value = 'x';
  $('#edBody').dispatchEvent(new w.Event('input', { bubbles: true }));
  $('#edSave').click();
  await sleep(400);
  ok(cloud.posts.some(p => p.slug === 'rainy-math'), '种子文章随首次保存写入云端');
  ok(S.posts.length === 5, '本地列表 5 篇');
  ok(S.seeded === false, 'seeded 已清');
  const rainy = cloud.posts.find(p => p.slug === 'rainy-math');
  ok(rainy && rainy.body.includes('火鸡面'), '种子 Markdown 正文完整');

  console.log('\n[6] 无报错');
  ok(errors.length === 0, '无未捕获错误', errors.join(' || '));

  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
  dom.window.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('崩溃:', e); process.exit(2); });
