/* ============================================================
   春风像素屋 · Cloudflare Worker 后端
   ------------------------------------------------------------
   - 静态资源由 [assets] 提供，只有 /api/* 进入本文件
   - 需要一个 KV 命名空间，绑定名 DATA，内部四把 key：
       posts      文章列表      [{slug,title,date,tags,summary,body,animal,theme,deco}]
       love       恋爱存档内容  {milestones,anniversaries,memories}
       photos     回忆相册      [{id,date,caption,data}]   data 为 dataURL(base64)
       visitors   访客统计      {total,unique,recent[],vids{}}
   - 管理接口必须带请求头 X-Admin-Key，值等于环境变量 ADMIN_KEY
     （wrangler secret put ADMIN_KEY 设置，不设则管理接口全部关闭）
   - 隐私：不存 IP，只记国家/地区（Cloudflare cf.country）、
     来源站点、设备类型与自生成的访客 ID
   ============================================================ */
'use strict';

const json = (obj, status) => new Response(JSON.stringify(obj), {
  status: status || 200,
  headers: {
    'content-type': 'application/json;charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type,x-admin-key',
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS'
  }
});
const err = (msg, status) => json({ error: msg }, status || 400);

async function getJSON(env, key, fallback) {
  try {
    const v = await env.DATA.get(key, 'json');
    return v === null || v === undefined ? fallback : v;
  } catch (e) { return fallback; }
}
async function setJSON(env, key, value) {
  await env.DATA.put(key, JSON.stringify(value));
}

/* 恒定时间比较，避免把管理员密钥逐字节泄露给计时攻击 */
function adminOK(request, env) {
  const want = env.ADMIN_KEY || '';
  const got = request.headers.get('X-Admin-Key') || '';
  if (!want || got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const slugOk = s => /^[a-z0-9][a-z0-9-]{1,60}$/.test(s);

const ANIMALS = ['cat', 'dog', 'rabbit', 'fox', 'bear', 'frog', 'owl', 'hamster', 'bird'];
const THEMES = ['pink', 'mint', 'sky', 'honey', 'purple', 'peach', 'rose', 'night'];
const DECOS = ['d-topright', 'd-peek', 'd-title', 'd-corner', 'd-walk'];

function sanitizePost(input) {
  if (!input || typeof input !== 'object') return null;
  const slug = str(input.slug, 64).trim();
  const title = str(input.title, 200).trim();
  const body = str(input.body, 120000);
  if (!slugOk(slug) || !title || !body.trim()) return null;
  const tags = Array.isArray(input.tags)
    ? input.tags.slice(0, 8).map(t => str(t, 20).trim()).filter(Boolean) : [];
  return {
    slug, title, body,
    date: /^\d{4}-\d{2}-\d{2}$/.test(input.date || '') ? input.date : new Date().toISOString().slice(0, 10),
    tags,
    summary: str(input.summary, 500),
    animal: ANIMALS.indexOf(input.animal) >= 0 ? input.animal : 'cat',
    theme: THEMES.indexOf(input.theme) >= 0 ? input.theme : 'mint',
    deco: DECOS.indexOf(input.deco) >= 0 ? input.deco : 'd-topright',
    updated: Date.now()
  };
}

const dateOk = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

/* —— 访客 —— */
const MAX_RECENT = 40, MAX_VIDS = 20000;

function deviceOf(ua) {
  ua = ua || '';
  if (/iPad|Tablet/i.test(ua)) return '平板';
  if (/Mobile|Android|iPhone/i.test(ua)) return '手机';
  return '电脑';
}
function hostOf(url) {
  if (!url) return '';
  try { return new URL(url).host.replace(/^www\./, ''); } catch (e) { return ''; }
}

async function handleVisit(request, env) {
  let body = {};
  try { body = await request.json(); } catch (e) {}
  const vid = typeof body.vid === 'string' && body.vid ? body.vid.slice(0, 64) : '';
  const now = Date.now();
  const st = (await getJSON(env, 'visitors', null)) || { total: 0, unique: 0, recent: [], vids: {} };
  if (!st.vids || typeof st.vids !== 'object') st.vids = {};
  if (!Array.isArray(st.recent)) st.recent = [];

  st.total = (st.total || 0) + 1;
  let known = vid && typeof st.vids[vid] === 'object';
  let n = known ? (st.vids[vid].n || 0) + 1 : 1;
  if (vid) {
    if (!known) st.unique = (st.unique || 0) + 1;
    st.vids[vid] = { n: n, first: known ? st.vids[vid].first : now, last: now };
    const keys = Object.keys(st.vids);
    if (keys.length > MAX_VIDS) {                      // 超量时保留最近活跃的一半
      keys.sort((a, b) => (st.vids[b].last || 0) - (st.vids[a].last || 0));
      keys.slice(Math.floor(MAX_VIDS / 2)).forEach(k => delete st.vids[k]);
    }
  }
  st.recent.unshift({
    t: now,
    c: (request.cf && request.cf.country) || body.c || '未知',
    v: known ? 'old' : 'new',
    n: n,
    r: str(body.r, 80),
    d: deviceOf(request.headers.get('user-agent'))
  });
  if (st.recent.length > MAX_RECENT) st.recent.length = MAX_RECENT;

  await setJSON(env, 'visitors', st);
  return json({ total: st.total, unique: st.unique, recent: st.recent.slice(0, 12), mine: n });
}

/* —— 管理：文章 —— */
async function adminPosts(request, env, url) {
  if (!adminOK(request, env)) return err('管理员密钥不正确', 401);
  const method = request.method.toUpperCase();

  if (method === 'PUT') {
    const post = sanitizePost(await request.json().catch(() => null));
    if (!post) return err('文章内容不合法（标题/正文/slug 必填）');
    const list = (await getJSON(env, 'posts', [])) || [];
    const i = list.findIndex(p => p.slug === post.slug);
    if (i >= 0) list[i] = post; else list.push(post);
    await setJSON(env, 'posts', list);
    return json({ ok: true, slug: post.slug, count: list.length });
  }

  if (method === 'DELETE') {
    const slug = decodeURIComponent(url.pathname.split('/').pop() || '');
    const list = (await getJSON(env, 'posts', [])) || [];
    const next = list.filter(p => p.slug !== slug);
    if (next.length === list.length) return err('没有找到这篇文章', 404);
    await setJSON(env, 'posts', next);
    return json({ ok: true, count: next.length });
  }

  return err('不支持的方法', 405);
}

/* —— 管理：恋爱存档正文（轨迹 / 纪念日 / 便签） —— */
/* 轨迹日期三选一：公历 date / 在一起第 N 天 days / 农历 lunar(MM-DD, 可 leap 闰月)
   纪念日二选一：公历 date / 农历 lunar（yearly 每年按农历重算） */
function lunarOk(s) {
  return /^\d{2}-\d{2}$/.test(s) &&
    +s.slice(0, 2) >= 1 && +s.slice(0, 2) <= 12 &&
    +s.slice(3) >= 1 && +s.slice(3) <= 30;
}
const daysOk = n => Number.isInteger(n) && n >= 1 && n <= 99999;

async function adminLove(request, env) {
  if (!adminOK(request, env)) return err('管理员密钥不正确', 401);
  const input = await request.json().catch(() => null);
  if (!input || typeof input !== 'object') return err('内容格式不正确');

  const txt = (v, n) => str(v, n).trim();
  const withLunar = (o, x) => {
    const lunar = txt(x && x.lunar, 8);
    if (lunarOk(lunar)) o.lunar = lunar;
    if (o.lunar && x && x.leap === true) o.leap = true;
    return o;
  };

  const msSrc = Array.isArray(input.milestones) ? input.milestones : [];
  const anSrc = Array.isArray(input.anniversaries) ? input.anniversaries : [];
  const love = {
    /* 种子合并版本号（前端据此判断是否要把新种子补进旧存档） */
    v: Number.isInteger(input.v) && input.v >= 0 ? input.v : 0,
    milestones: msSrc.slice(0, 120).map(x => withLunar({
      date: txt(x && x.date, 40),
      title: txt(x && x.title, 120),
      desc: txt(x && x.desc, 300),
      days: (x && daysOk(x.days)) ? x.days : 0
    }, x)).map(o => {
      if (!o.days) delete o.days;
      return o;
    }).filter(o => o.title && (dateOk(o.date) || o.lunar || o.days)),
    anniversaries: anSrc.slice(0, 120).map(x => {
      const o = withLunar({
        date: txt(x && x.date, 40),
        title: txt(x && x.title, 120),
        note: txt(x && x.note, 300),
        yearly: !!(x && x.yearly)
      }, x);
      return o;
    }).filter(o => o.title && (dateOk(o.date) || o.lunar)),
    memories: (Array.isArray(input.memories) ? input.memories : []).slice(0, 200)
      .map(x => ({ title: txt(x && x.title, 120), text: txt(x && x.text, 300) }))
      .filter(o => o.title)
  };
  await setJSON(env, 'love', love);
  return json({ ok: true });
}

/* —— 管理：相册 —— */
async function adminPhotos(request, env) {
  if (!adminOK(request, env)) return err('管理员密钥不正确', 401);
  const input = await request.json().catch(() => null);
  if (!input || !Array.isArray(input.photos)) return err('照片格式不正确');
  if (input.photos.length > 60) return err('照片太多了，最多 60 张');
  for (const p of input.photos) {
    if (!p || typeof p.data !== 'string' || !p.data.startsWith('data:image/') || p.data.length > 1500000)
      return err('存在不合法或过大的照片（单张 base64 上限约 1.1MB）');
  }
  const photos = input.photos.map(p => ({
    id: str(p.id, 40) || 'p' + Math.random().toString(36).slice(2, 10),
    date: dateOk(p.date) ? p.date : '',
    caption: str(p.caption, 120),
    album: str(p.album, 40),
    data: p.data
  }));
  await setJSON(env, 'photos', photos);
  return json({ ok: true, count: photos.length });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/' || url.pathname.startsWith('/api/')) {
      if (request.method === 'OPTIONS') return json({ ok: true }, 204);
      const p = url.pathname.replace(/\/+$/, '');

      if (request.method === 'GET' && p === '/api/ping')
        return json({ ok: true, cloud: true, admin: !!(env.ADMIN_KEY) });

      if (request.method === 'GET' && p === '/api/posts')
        return json({ posts: (await getJSON(env, 'posts', [])) || [] });

      if (request.method === 'GET' && p === '/api/love') {
        const [love, photos] = await Promise.all([
          getJSON(env, 'love', null), getJSON(env, 'photos', [])
        ]);
        return json({
          v: (love && love.v) || 0,
          milestones: (love && love.milestones) || [],
          anniversaries: (love && love.anniversaries) || [],
          memories: (love && love.memories) || [],
          photos: photos || []
        });
      }

      if (request.method === 'GET' && p === '/api/visitors') {
        const st = (await getJSON(env, 'visitors', null)) ||
          { total: 0, unique: 0, recent: [] };
        return json({ total: st.total || 0, unique: st.unique || 0, recent: st.recent || [] });
      }

      if (request.method === 'POST' && p === '/api/visit')
        return handleVisit(request, env);

      if (request.method === 'GET' && p === '/api/admin/ping') {
        if (!adminOK(request, env)) return err('管理员密钥不正确', 401);
        return json({ ok: true });
      }
      if (p.startsWith('/api/admin/posts'))
        return adminPosts(request, env, url);
      if (request.method === 'PUT' && p === '/api/admin/love')
        return adminLove(request, env);
      if (request.method === 'PUT' && p === '/api/admin/photos')
        return adminPhotos(request, env);

      return err('接口不存在', 404);
    }

    /* 其余路径交给静态资源（index.html 等） */
    return env.ASSETS.fetch(request);
  }
};
