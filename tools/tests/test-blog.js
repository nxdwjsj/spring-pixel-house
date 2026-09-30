/* 春风像素屋回归测试（jsdom，本地降级模式） */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const HTML = fs.readFileSync(require('path').join(__dirname, '..', '..', 'index.html'), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => {
  if (/Not implemented/.test(e.message)) return;   // jsdom 缺 scrollTo 等
  errors.push('jsdomError: ' + e.message);
});
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dom = new JSDOM(HTML, {
    url: 'http://localhost:8080/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.IntersectionObserver = class {
        constructor(cb) { this.cb = cb; }
        observe() {} unobserve() {} disconnect() {}
      };
      window.fetch = () => Promise.reject(new Error('no backend (test)'));
      window.scrollTo = () => {};
      window.confirm = () => true;
      window.URL.createObjectURL = () => 'blob:test';
      window.Element.prototype.scrollIntoView = function () {};
      window.URL.revokeObjectURL = () => {};
      window.addEventListener('error', e => errors.push('window.onerror: ' + e.message));
    }
  });
  const w = dom.window, d = w.document;
  const $ = s => d.querySelector(s);
  const $$ = s => Array.from(d.querySelectorAll(s));

  console.log('\n[1] 启动与文章渲染');
  for (let i = 0; i < 60 && !w.Store; i++) await sleep(50);
  await sleep(300);
  const S = w.eval('Store');
  ok(!!S, 'Store 已初始化');
  ok(S.cloud === false, '无后端时降级为本地模式');
  const cards = $$('#postGrid .card');
  ok(cards.length === 1, '文章卡片 1 张', '实际 ' + cards.length);
  ok(cards[0] && cards[0].dataset.slug === 'rainy-math', 'slug 为 rainy-math');
  ok(cards[0] && cards[0].querySelector('.post-full').innerHTML.includes('火鸡面'), '正文含种子文章内容');
  ok(S.posts.length === 1 && S.posts[0].body.includes('## 上午'), 'Store 种子为 Markdown 源文');

  console.log('\n[2] 阅读页路由（回归：不再跳到恋爱存档点）');
  w.location.hash = '#/post/rainy-math';
  await sleep(150);
  ok($('#postDetail').hidden === false, '阅读页显示');
  ok($('#hero').hidden === true, 'hero 隐藏');
  ok($('#love').hidden === true, '恋爱存档点隐藏（原 bug）');
  ok($('#dTitle').textContent === '雨天、数学与火鸡面', '标题正确');
  ok($('#dBody').innerHTML.includes('肉夹馍'), '正文注入');
  ok($('#postDetail').className.includes('t-pink'), '阅读页跟随主题色 t-pink');
  ok($('#dPrev').className === 'off' && $('#dNext').className === 'off', '只有一篇时上下篇 disabled');
  w.location.hash = '#posts';
  await sleep(150);
  ok($('#love').hidden === false, '返回列表后恋爱存档点恢复');
  ok($('#postDetail').hidden === true, '阅读页关闭');

  console.log('\n[3] 恋爱存档渲染（种子从静态 HTML 读取）');
  ok($$('#loveLine li').length === 7, '心动轨迹 7 条', '实际 ' + $$('#loveLine li').length);
  ok($$('#annivList .anniv').length === 4, '纪念日 4 条', '实际 ' + $$('#annivList .anniv').length);
  ok($$('#memList .sweet').length === 3, '回忆便签 3 条');
  ok(!!$('#albumGrid .album-empty'), '相册空态存在');
  const dday = $$('#annivList .anniv').map(a => a.querySelector('.d-day').textContent);
  ok(dday.every(t => t && t !== '正在读取…'), '纪念日倒计时已计算', dday.join(' | '));
  /* 新目标里程碑：第 520/1314 天、二周年，全部按时间升序展开 */
  const dates = $$('#loveLine li').map(li => li.dataset.date);
  ok(dates.every((x, i) => x && (!i || dates[i - 1] <= x)), '轨迹按时间升序展开', dates.join(','));
  ok($$('#loveLine li').some(li => li.dataset.days === '520') &&
    $$('#loveLine li').some(li => li.dataset.days === '1314'), '含第 520 天 / 第 1314 天');
  ok($$('#loveLine li').some(li => li.dataset.days === '100' && li.dataset.days), '第 100 天挂上天数属性');
  ok($$('#loveLine li').some(li => li.textContent.includes('二周年')), '含二周年');
  /* 中秋：按农历展示、倒计时带今年公历 */
  const mid = $$('#annivList .anniv').find(a => a.dataset.lunar === '08-15');
  ok(!!mid, '中秋挂了农历属性');
  ok(mid && mid.querySelector('time').textContent === '农历八月十五', '农历时间文案',
    mid && mid.querySelector('time').textContent);
  ok(mid && /还有 \d+ 天（今年 \d+月\d+日）/.test(mid.querySelector('.d-day').textContent),
    '农历倒计时带今年公历日期', mid && mid.querySelector('.d-day').textContent);
  ok(!$('#loveNext').textContent.includes('NaN'), '下一个存档点无 NaN', $('#loveNext').textContent);
  ok(S.love.v === 2, '种子版本号 v=2（避免旧存档顶掉新种子）', 'v=' + S.love.v);

  console.log('\n[4] 真实访客（本地降级）');
  await sleep(100);
  ok($('#visitorNum').textContent === '1', '本机到访 1 次', $('#visitorNum').textContent);
  ok($('#visitorUni').textContent === '—', '未连云时独立访客显示 —');
  ok($$('#visitorList li').length >= 1, '到访记录有 1 条');
  ok($('#visitorMode').textContent.includes('本地模式'), '降级文案说明本地模式');

  console.log('\n[5] Markdown 渲染');
  const md = w.eval('mdToHtml')('## 标题\n\n第一段 **加粗** `行内`\n\n- 甲\n- 乙\n\n> 引用\n\n```\ncode()\n```');
  ok(md.includes('<h2>标题</h2>'), '小标题');
  ok(md.includes('<strong>加粗</strong>') && md.includes('<code>行内</code>'), '行内格式');
  ok(md.includes('<li>甲</li>') && md.includes('</ul>'), '列表');
  ok(md.includes('<blockquote>引用</blockquote>'), '引用');
  ok(md.includes('<pre><code>code()'), '代码块');
  ok(!/<script/i.test(w.eval("mdToHtml('<script>alert(1)</script>')")), 'HTML 被转义（防注入）');

  console.log('\n[6] 搜索过滤');
  const si = $('#searchInput');
  si.value = '火鸡面';
  si.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok($$('#postGrid .card:not(.hide)').length === 1, '关键词命中 1 篇');
  si.value = 'zzz不存在';
  si.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok($$('#postGrid .card:not(.hide)').length === 0 && $('#noResult').style.display === 'block', '无结果提示');
  si.value = '';
  si.dispatchEvent(new w.Event('input', { bubbles: true }));

  console.log('\n[7] 站长模式：本地登录 + 发文章 + 删除');
  $('#adminBtn').click();
  await sleep(50);
  ok($('#adminMask').hidden === false, '弹窗打开');
  ok($('#loginPane').hidden === false && $('#adminPanes').hidden === true, '先显示登录页');
  $('#keyInput').value = 'k123';
  $('#loginBtn').click();
  await sleep(150);
  ok($('#adminPanes').hidden === false, '登录后进入面板');
  ok(S.unlocked && S.adminKey === 'k123', '密钥已保存');
  ok($('#edSwatches').querySelectorAll('.sw').length === 8, '8 个主题色');
  ok($('#edAnimal').options.length === 9, '9 种小动物');
  $('#edTitle').value = '测试新文章';
  $('#edTitle').dispatchEvent(new w.Event('input', { bubbles: true }));
  $('#edBody').value = '## 小节\n\n这是正文。';
  $('#edBody').dispatchEvent(new w.Event('input', { bubbles: true }));
  ok($('#edCardPreview').querySelector('h3').textContent === '测试新文章', '卡片实时预览');
  ok($('#edBodyPreview').innerHTML.includes('<h2>小节</h2>'), '正文实时预览');
  $('#edSave').click();
  await sleep(300);
  ok(S.posts.length === 2, '保存后 Store 有 2 篇');
  ok($$('#postGrid .card').length === 2, '列表重渲染为 2 张卡');
  ok($('#edMsg').hidden === false && $('#edMsg').className.includes('ok'), '保存成功提示');
  const newCard = $$('#postGrid .card').find(c => c.dataset.slug === 'post-');
  ok($$('#postGrid .card').some(c => c.dataset.slug.startsWith('post-')), 'slug 自动生成',
    $$('#postGrid .card').map(c => c.dataset.slug).join(','));

  console.log('\n[8] 管理文章：改标题 + 删除');
  $$('.tab').find(t => t.dataset.page === 'list').click();
  await sleep(50);
  ok($$('#postAdminList .mrow').length === 2, '列表 2 行');
  const newRow = $$('#postAdminList .mrow').find(r => r.dataset.slug.startsWith('post-'));
  newRow.querySelector('[data-f="title"]').value = '改过的标题';
  $('#listSave').click();
  await sleep(300);
  ok(S.posts.some(p => p.title === '改过的标题'), '标题已保存');
  const delRow = $$('#postAdminList .mrow').find(r => r.dataset.slug.startsWith('post-'));
  delRow.querySelector('[data-act="del"]').click();
  await sleep(300);
  ok(S.posts.length === 1 && $$('#postGrid .card').length === 1, '删除后回到 1 篇');
  ok(S.posts[0].slug === 'rainy-math', '保留的是 rainy-math');

  console.log('\n[9] 站长模式：编辑恋爱存档（公历 / 第N天 / 农历）');
  $$('.tab').find(t => t.dataset.page === 'love').click();
  await sleep(50);
  ok($$('#msList .mrow').length === 7, '轨迹编辑行 7 行', '实际 ' + $$('#msList .mrow').length);
  ok($$('#anList .mrow').length === 4, '纪念日编辑行 4 行', '实际 ' + $$('#anList .mrow').length);
  /* 轨迹加一条“第 300 天” */
  $('#addMs').click();
  const msNew = $$('#msList .mrow').pop();
  msNew.querySelector('[data-f="days"]').value = '300';
  msNew.querySelector('[data-f="title"]').value = '第 300 天';
  /* 纪念日加公历“跨年” */
  $('#addAn').click();
  const anNew = $$('#anList .mrow').pop();
  anNew.querySelector('[data-f="date"]').value = '2026-12-31';
  anNew.querySelector('[data-f="title"]').value = '跨年';
  anNew.querySelector('[data-f="note"]').value = '一起倒数';
  anNew.querySelector('[data-f="yearly"]').checked = true;
  /* 纪念日加农历“春节”（每年农历正月初一） */
  $('#addAn').click();
  const anL = $$('#anList .mrow').pop();
  anL.querySelector('[data-f="islunar"]').checked = true;
  anL.querySelector('[data-f="islunar"]').dispatchEvent(new w.Event('change', { bubbles: true }));
  ok(anL.querySelector('[data-f="date"]').disabled && anL.querySelector('[data-f="date"]').className.includes('dim'),
    '勾选农历后公历输入置灰');
  anL.querySelector('[data-f="lmonth"]').value = '1';
  anL.querySelector('[data-f="lday"]').value = '1';
  anL.querySelector('[data-f="title"]').value = '春节';
  anL.querySelector('[data-f="note"]').value = '回外婆家';
  anL.querySelector('[data-f="yearly"]').checked = true;
  $('#loveSave').click();
  await sleep(300);
  ok(!$('#loveMsg').hidden && $('#loveMsg').className.includes('ok'), '存档保存成功提示',
    $('#loveMsg').textContent);
  ok($$('#annivList .anniv').length === 6, '页面纪念日 6 条', '实际 ' + $$('#annivList .anniv').length);
  const kuai = $$('#annivList .anniv').find(a => a.querySelector('b').textContent === '跨年');
  ok(!!kuai, '新纪念日已渲染');
  ok(kuai && kuai.dataset.yearly === '1', '每年标记保留');
  const spring = $$('#annivList .anniv').find(a => a.querySelector('b').textContent === '春节');
  ok(!!spring && spring.dataset.lunar === '01-01' && spring.dataset.yearly === '1',
    '农历纪念日已渲染（data-lunar + 每年）', spring ? spring.outerHTML.slice(0, 160) : '未找到');
  ok(spring && spring.querySelector('time').textContent === '农历正月初一', '春节农历时间文案',
    spring && spring.querySelector('time').textContent);
  ok(spring && /还有 \d+ 天（今年 \d+月\d+日）/.test(spring.querySelector('.d-day').textContent),
    '春节倒计时带今年公历', spring && spring.querySelector('.d-day').textContent);
  const ms300 = $$('#loveLine li').find(li => li.dataset.days === '300');
  ok(!!ms300 && /^\d{4}-\d{2}-\d{2}$/.test(ms300.dataset.date), '第 300 天推算出公历日期',
    ms300 ? ms300.dataset.date : '未找到');
  ok(S.love.anniversaries.length === 6 && S.love.milestones.length === 8, 'Store 已保存',
    S.love.anniversaries.length + '/' + S.love.milestones.length);
  const saved = JSON.parse(w.localStorage.getItem('pf-love'));
  ok(saved && saved.anniversaries.length === 6, 'localStorage 已写入 pf-love');
  ok(saved && saved.anniversaries.some(a => a.lunar === '01-01') &&
    saved.milestones.some(m => m.days === 300), 'lunar / days 字段已落盘');
  ok(saved && saved.v === 2, '种子版本号 v 落盘（删除的种子不再复活）', 'v=' + (saved && saved.v));

  console.log('\n[10] 键盘 Esc 关闭弹窗');
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(30);
  ok($('#adminMask').hidden === true, 'Esc 关闭站长弹窗');

  console.log('\n[11] 刷新恢复（localStorage 数据回读）');
  const postsRaw = w.localStorage.getItem('pf-posts');
  const savedPosts = postsRaw ? JSON.parse(postsRaw) : null;
  ok(savedPosts && savedPosts.length === 1 && savedPosts[0].slug === 'rainy-math', 'pf-posts 落盘 1 篇', String(postsRaw).slice(0, 80));
  ok(!!w.localStorage.getItem('pf-vid'), '访客 ID 已生成');

  console.log('\n[12] 运行期无 JS 报错');
  ok(errors.length === 0, '无未捕获错误', errors.join(' || '));

  console.log('\n[13] 天气装扮帧不被随机动画打回');
  const sp = $('#weatherSpr .spr');
  ok(!sp.hasAttribute('data-alts'), 'weatherSpr 不再写死 data-alts');
  w.eval('setFrame(document.getElementById("weatherSpr"), "cat-idle")');
  w.eval('tickClock()');
  const wxWant = w.eval('WX[getWxKey(new Date().getHours())].frame');
  ok(sp.dataset.cur === wxWant, 'tickClock 恢复当前天气帧', sp.dataset.cur + ' vs ' + wxWant);
  ok(sp.dataset.day === wxWant, '白天常态帧 data-day 与天气同步', sp.dataset.day + ' vs ' + wxWant);

  console.log('\n[14] 农历推算：与 solarlunar 对拍 + 关键日期');
  const sl = require('solarlunar').default;
  let lunarDiff = 0, lunarTotal = 0;
  for (let y = 1950; y <= 2050; y++) {
    const lm = w.eval('lLeapMonth(' + y + ')');
    for (let m = 1; m <= 12; m++) {
      for (const leap of (lm === m ? [false, true] : [false])) {
        const dim = leap ? w.eval('lLeapDays(' + y + ')') : w.eval('lMonthDays(' + y + ',' + m + ')');
        for (let dd = 1; dd <= dim; dd++) {
          lunarTotal++;
          const mine = w.eval('lunar2solar(' + y + ',' + m + ',' + dd + ',' + leap + ')');
          const lib = sl.lunar2solar(y, m, dd, leap);
          if (lib && lib.cYear) {
            if (!(mine && mine.y === lib.cYear && mine.m === lib.cMonth && mine.d === lib.cDay))
              lunarDiff++;
          } else if (mine && !(leap && dd === 30)) {
            lunarDiff++;   /* solarlunar 对“闰月 30 天”误判无效，此处应一致为有值 */
          }
        }
      }
    }
  }
  ok(lunarDiff === 0, '农历对拍 solarlunar 1950-2050 全量（' + lunarTotal + ' 天）零差异',
    'diff=' + lunarDiff);
  ok(w.eval('isoDate(msDate({days:1}))') === '2026-03-15', '第 1 天 = 2026-03-15');
  ok(w.eval('isoDate(msDate({days:100}))') === '2026-06-22', '第 100 天 = 2026-06-22');
  ok(w.eval('isoDate(msDate({days:200}))') === '2026-09-30', '第 200 天 = 2026-09-30');
  ok(w.eval('isoDate(msDate({days:520}))') === '2027-08-16', '第 520 天 = 2027-08-16');
  ok(w.eval('isoDate(msDate({days:1314}))') === '2029-10-18', '第 1314 天 = 2029-10-18');
  ok(/^20(2[6-9]|[3-9]\d)-09-1[45]$/.test(w.eval('isoDate(msDate({lunar:"08-15"}))')),
    'msDate 农历推算出最近中秋（9/14-15）', w.eval('isoDate(msDate({lunar:"08-15"}))'));
  ok(w.eval('isoDate(nextLunar(8,15,false,new Date(2026,0,1)))') === '2026-09-25',
    '2026 年内中秋 = 2026-09-25');
  ok(w.eval('isoDate(nextLunar(8,15,false,new Date(2026,8,30)))') === '2027-09-15',
    '2026 中秋过后，下次中秋 = 2027-09-15');
  ok(w.eval('lunarLabel(8,15,false)') === '农历八月十五', '农历文案');
  ok(w.eval('lunarLabel(4,1,true)') === '农历闰四月初一', '闰月文案');

  console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
  dom.window.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试崩溃:', e); process.exit(2); });
