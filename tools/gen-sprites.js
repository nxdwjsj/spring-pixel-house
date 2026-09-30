/* ============================================================
 * 像素元素生成器 · 32x32 高清版
 * 用矩形 DSL 绘制 32x32 像素动物 / 图标 / 春日装饰，
 * 输出纯 CSS box-shadow（不使用图片 / SVG / canvas）。
 *
 * 说明：绘制网格等价于 grid-template-columns:repeat(32,2px) ——
 * 每个逻辑像素渲染为 2px x 2px 的实心方块（box-shadow 步长为 2px），
 * 因为帧需要靠 class 切换（DOM 子节点无法随 class 变化），
 * 所以用「2px 步长的 box-shadow 网格」实现同样的 32x32 网格几何。
 *
 * 用法: node tools/gen-sprites.js
 * 会把 CSS 注入 index.html 中
 *   /*__SPRITES_START__* / ... /*__SPRITES_END__* /
 * 标记之间（重复执行可覆盖），并生成 tools/sprites.css 与 tools/sheet.html
 * ============================================================ */
const fs = require('fs');
const path = require('path');

const W = 32, H = 32;

/* ---------- 通用调色板 ---------- */
const C = {
  k: '#37474f',   // 眼睛 / 嘴（深灰绿）
  k2: '#263238',  // 更深（眼镜框 / 鼻头）
  w: '#ffffff',
  p: '#f48fb1',   // 樱花粉
  n: '#f8bbd0',   // 浅粉
  y: '#fff59d',   // 月光黄
  o: '#78909c',   // 中灰
  cap: '#9575cd', // 通用睡帽（紫）
  capD: '#7e57c2',
  ocap: '#5c6bc0', // 猫头鹰蓝色尖顶睡帽
  ocapD: '#3f51b5',
  leaf: '#66bb6a',
  leafD: '#43a047',
  beak: '#ffb74d',
  beakD: '#f57c00',
  glass: '#2f3b52',
  scarf: '#ef5350',
  iris: '#ff9e4a',
  cheek: '#f7e3a8',  // brownie 脸颊奶黄斑
  bEye: '#6d4c41',   // brownie 深棕大眼
  bEyeD: '#4e342e',
  bNose: '#8d6e63',  // brownie 小棕鼻
  arm: '#b7a99b',    // 灰棕手臂
  armD: '#9e948a',
  bibHi: '#fbd3e2',  // 粉围兜高光
  bibD: '#ec6f99',   // 粉围兜暗部
  bbib: '#b08968',   // belle 棕围兜
  bbibD: '#96705a',
  bbibHi: '#d8b896',
  bubble: '#9ec5e8', // 鼻涕泡
  bubbleD: '#7fa8d6',
};

/* ---------- 画布 ---------- */
function create() {
  const m = new Map();
  const set = (x, y, c) => {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && x < W && y >= 0 && y < H) m.set(y * W + x, c);
  };
  const r = (x, y, w, h, c) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c);
  };
  /* 圆角/椭圆矩形：上下边缘按距离内缩 */
  const blob = (x, y, w, h, c, round) => {
    round = round === undefined ? 4 : round;
    for (let j = 0; j < h; j++) {
      const t = Math.min(j, h - 1 - j);
      let ins = 0;
      if (t === 0) ins = Math.min(round, Math.floor((w - 1) / 2));
      else if (t === 1) ins = Math.min(Math.ceil(round / 2), Math.floor((w - 1) / 2));
      if (w - 2 * ins > 0) r(x + ins, y + j, w - 2 * ins, 1, c);
    }
  };
  return { m, r, set, blob };
}

/* ---------- 颜色工具：生成比主体深 2-3 色阶的描边色 ---------- */
function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const R = Math.round(((n >> 16) & 255) * f);
  const G = Math.round(((n >> 8) & 255) * f);
  const B = Math.round((n & 255) * f);
  return '#' + ((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1);
}

/* 自动描边：所有空白像素只要有 8 邻域实心像素，
   就填上「邻居颜色加深 62%」的描边色 —— 得到统一的深色轮廓 */
function autoOutline(a) {
  const add = new Map();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const key = y * W + x;
      if (a.m.has(key)) continue;
      let nb = null;
      for (let j = -1; j <= 1 && !nb; j++) {
        for (let i = -1; i <= 1; i++) {
          if (!i && !j) continue;
          const c = a.m.get((y + j) * W + (x + i));
          if (c) { nb = c; break; }
        }
      }
      if (nb) add.set(key, darken(nb, 0.62));
    }
  }
  add.forEach((c, key) => a.m.set(key, c));
}

/* ---------- 各物种调色板 ---------- */
const P = {
  cat:     { m: '#ffc980', l: '#fff6e9', o: '#f0a860' },
  dog:     { m: '#f6c99b', l: '#fff6ea', o: '#d9a066' },
  rabbit:  { m: '#fffdfb', l: '#eef3fb', o: '#dbe3f0' },
  fox:     { m: '#ff9e6b', l: '#fff3e8', o: '#e8814a' },
  bear:    { m: '#e0b087', l: '#f7e3cf', o: '#c9925f' },
  frog:    { m: '#8fd9a8', l: '#d9f5e4', o: '#66bb6a' },
  owl:     { m: '#cdb4db', l: '#f3e8ff', o: '#a98cc0' },
  hamster: { m: '#ffe0b2', l: '#fff8ec', o: '#f0c08a' },
  bird:    { m: '#9fd3ff', l: '#ffffff', o: '#6fb6ef' },
  brownie: { m: '#c9925f', l: '#f3e2c6', o: '#a87642' },
  belle:   { m: '#f5e9c8', l: '#fffaf0', o: '#ddc79a' },
};

/* ---------- 通用五官部件 ---------- */
/* 大眼（4x5，左上 2x2 白色高光 + 右下 1px 小反光） */
const eyesBig = (xl, xr, y) => a => {
  a.r(xl, y, 4, 5, C.k); a.r(xr, y, 4, 5, C.k);
  a.r(xl, y, 2, 2, C.w); a.r(xr, y, 2, 2, C.w);
  a.set(xl + 3, y + 4, C.w); a.set(xr + 3, y + 4, C.w);
};
/* 瞪大（高光上移，表现惊讶） */
const eyesWide = (xl, xr, y) => a => {
  a.r(xl, y, 4, 5, C.k); a.r(xr, y, 4, 5, C.k);
  a.r(xl + 1, y, 2, 2, C.w); a.r(xr + 1, y, 2, 2, C.w);
};
/* 视线偏移 dx = -1 / 0 / 1 */
const eyesLook = (xl, xr, y, dx) => a => {
  a.r(xl, y, 4, 5, C.k); a.r(xr, y, 4, 5, C.k);
  a.r(Math.max(0, xl + dx), y, 2, 2, C.w);
  a.r(Math.max(0, xr + dx), y, 2, 2, C.w);
};
/* 闭眼（下弯的“‿”） */
const eyesShut = (xl, xr, y) => a => {
  a.r(xl, y + 3, 4, 1, C.k); a.r(xr, y + 3, 4, 1, C.k);
  a.set(xl, y + 2, C.k); a.set(xl + 3, y + 2, C.k);
  a.set(xr, y + 2, C.k); a.set(xr + 3, y + 2, C.k);
};
/* 开心眯眼（“⌒”） */
const eyesArc = (xl, xr, y) => a => {
  [xl, xr].forEach(x => {
    a.set(x, y + 1, C.k); a.r(x + 1, y, 2, 1, C.k); a.set(x + 3, y + 1, C.k);
  });
};
/* 腮红 */
const blush = (xl, xr, y) => a => {
  a.r(xl, y, 3, 2, C.p); a.r(xr, y, 3, 2, C.p);
};
const nose = (x, y, c) => a => { a.r(x, y, 3, 2, c || C.p); };
/* ω 嘴：两段小弧线 */
const mouthW = (cx, y) => a => {
  a.set(cx - 2, y, C.k); a.set(cx, y, C.k); a.set(cx + 2, y, C.k);
  a.set(cx - 1, y + 1, C.k); a.set(cx + 1, y + 1, C.k);
};
/* 微笑嘴（两端上翘） */
const mouthSmile = (cx, y, w) => a => {
  a.set(cx - w, y, C.k); a.set(cx + w, y, C.k);
  a.r(cx - w + 1, y + 1, 2 * w - 1, 1, C.k);
};
/* 张嘴（开心） */
const mouthOpen = (cx, y) => a => {
  a.r(cx - 2, y, 5, 2, C.k); a.r(cx - 1, y + 1, 3, 1, C.p);
};
/* 小圆 O 嘴（惊讶） */
const mouthO = (cx, y) => a => { a.r(cx - 1, y, 3, 2, C.k); };

/* 通用紫色睡帽（cy = 帽檐所在行） */
const nightcap = cy => a => {
  a.r(8, cy, 14, 2, C.capD);
  a.r(10, cy - 2, 10, 2, C.cap);
  a.r(12, cy - 4, 7, 2, C.cap);
  a.r(14, cy - 6, 4, 2, C.cap);
  a.r(17, cy - 8, 3, 2, C.y);   // 末端小球
};
/* zzz（右上角小 Z） */
const zzz = a => {
  a.r(25, 0, 5, 2, C.o);
  a.r(28, 2, 2, 2, C.o);
  a.r(26, 4, 2, 2, C.o);
  a.r(25, 6, 5, 2, C.o);
};

/* ============================================================
 *  物种
 * ============================================================ */

/* ---------- 猫（坐姿 · 尖耳内耳粉 · 橘色条纹 · 卷尾） ---------- */
const catEars = a => {
  const p = P.cat;
  a.r(10, 2, 2, 1, p.m); a.r(9, 3, 4, 2, p.m); a.r(8, 4, 5, 1, p.m);
  a.r(7, 5, 6, 3, p.m);                                   // 左耳
  a.r(20, 2, 2, 1, p.m); a.r(19, 3, 4, 2, p.m); a.r(19, 4, 5, 1, p.m);
  a.r(19, 5, 6, 3, p.m);                                  // 右耳
  a.r(10, 4, 2, 2, C.n); a.r(9, 6, 3, 2, C.n);            // 左耳内粉
  a.r(20, 4, 2, 2, C.n); a.r(20, 6, 3, 2, C.n);           // 右耳内粉
};
const catHead = a => {
  const p = P.cat;
  catEars(a);
  a.blob(7, 7, 18, 13, p.m, 3);                           // 头 x7..24 y7..19
  a.r(10, 8, 2, 3, p.o); a.r(15, 8, 2, 3, p.o); a.r(20, 8, 2, 3, p.o); // 橘色条纹
  a.r(7, 12, 2, 2, p.o); a.r(23, 12, 2, 2, p.o);          // 脸颊条纹
};
const catFace = a => {
  eyesBig(9, 19, 11)(a);
  nose(15, 16)(a);
  mouthW(16, 18)(a);
  blush(8, 21, 16)(a);
};
const catWhiskers = a => {                                // 描边后绘制（细线不加轮廓）
  a.r(4, 14, 3, 1, C.k); a.r(4, 18, 3, 1, C.k);
  a.r(25, 14, 3, 1, C.k); a.r(25, 18, 3, 1, C.k);
};
const catBody = a => {
  const p = P.cat;
  a.r(11, 20, 10, 1, p.m); a.r(10, 21, 12, 1, p.m);
  a.r(9, 22, 14, 5, p.m); a.r(8, 27, 16, 2, p.m);         // 身体 + 底盘
  a.r(12, 23, 8, 4, p.l);                                 // 奶白肚皮
  a.r(11, 27, 4, 2, p.l); a.r(17, 27, 4, 2, p.l);         // 前爪
};
const catTailLow = a => {
  const p = P.cat;
  a.r(24, 27, 5, 2, p.m); a.r(27, 23, 2, 4, p.m);
  a.r(24, 22, 4, 2, p.m); a.r(24, 20, 2, 2, p.m);         // 卷尾（收起）
};
const catTailUp = a => {
  const p = P.cat;
  a.r(22, 25, 9, 2, p.m); a.r(28, 15, 3, 10, p.m);
  a.r(26, 13, 5, 2, p.m); a.r(25, 11, 4, 2, p.m);         // 尾巴竖起卷向头顶
};
const catBow = a => {                                     // 蝴蝶结（左耳下）
  a.r(7, 6, 4, 3, C.p); a.r(12, 6, 4, 3, C.p);
  a.r(11, 6, 1, 3, C.n);
};
/* 胖橘猫：躺平（头在左，身体横陈，奶白肚皮，短粗四肢） */
const fatCat = a => {
  const p = P.cat;
  a.blob(3, 8, 16, 13, p.m, 3);                           // 头 x3..18 y8..20
  a.r(6, 9, 2, 3, p.o); a.r(10, 9, 2, 3, p.o);            // 条纹
  a.r(4, 2, 2, 1, p.m); a.r(3, 3, 4, 2, p.m); a.r(2, 4, 5, 1, p.m);
  a.r(1, 5, 6, 3, p.m);                                   // 左耳
  a.r(12, 2, 2, 1, p.m); a.r(12, 3, 4, 2, p.m); a.r(12, 4, 5, 1, p.m);
  a.r(11, 5, 6, 3, p.m);                                  // 右耳
  a.r(4, 4, 2, 2, C.n); a.r(3, 6, 3, 2, C.n);
  a.r(12, 4, 2, 2, C.n); a.r(12, 6, 3, 2, C.n);
  a.blob(16, 14, 14, 13, p.m, 4);                         // 横着的身体 x16..29 y14..26
  a.blob(19, 17, 10, 8, p.l, 3);                          // 奶白肚皮
  a.r(6, 21, 5, 3, p.l); a.r(13, 21, 4, 3, p.l);          // 短粗前肢
  a.r(21, 25, 5, 3, p.l); a.r(26, 22, 4, 3, p.l);         // 短粗后肢
  a.r(27, 8, 3, 6, p.m); a.r(25, 6, 4, 3, p.m);           // 翘起的尾巴
  a.r(24, 4, 3, 3, p.m);
};
const fatCatFace = a => {
  eyesShut(5, 11, 12)(a);
  nose(8, 16)(a);
  mouthW(9, 18)(a);
  blush(4, 14, 17)(a);
};

/* ---------- 小狗（下垂长耳 · 黑框眼镜 · 黑鼻 · 吐舌 · 坐姿） ---------- */
const dogEars = a => {
  const p = P.dog;
  a.r(4, 6, 5, 3, p.m); a.r(3, 9, 6, 6, p.m); a.r(4, 15, 4, 2, p.m);
  a.r(23, 6, 5, 3, p.m); a.r(23, 9, 6, 6, p.m); a.r(24, 15, 4, 2, p.m);
  a.r(4, 10, 3, 4, p.o); a.r(25, 10, 3, 4, p.o);          // 耳内深色
};
const dogHead = a => {
  const p = P.dog;
  dogEars(a);
  a.blob(7, 7, 18, 13, p.m, 3);                           // 头 x7..24 y7..19
  a.r(10, 8, 2, 3, p.o); a.r(20, 8, 2, 3, p.o);           // 额头花纹
  a.r(14, 7, 4, 2, p.l);                                  // 眉心白毛
};
const dogGlasses = a => {                                 // 黑框眼镜
  a.r(8, 9, 7, 1, C.glass); a.r(8, 15, 7, 1, C.glass);
  a.r(8, 10, 1, 5, C.glass); a.r(14, 10, 1, 5, C.glass);
  a.r(17, 9, 7, 1, C.glass); a.r(17, 15, 7, 1, C.glass);
  a.r(17, 10, 1, 5, C.glass); a.r(23, 10, 1, 5, C.glass);
  a.r(15, 11, 2, 1, C.glass);                             // 鼻梁
  a.r(5, 11, 3, 1, C.glass); a.r(24, 11, 3, 1, C.glass);  // 镜腿
};
const dogFaceOpen = a => {
  eyesBig(9, 18, 10)(a);                                 // 镜片内的眼睛
  a.r(14, 16, 4, 2, C.k2); a.set(14, 16, '#90a4ae');      // 黑鼻 + 高光
  mouthSmile(15, 18, 3)(a);
  a.r(14, 19, 3, 2, C.p);                                 // 吐出的小粉舌
};
const dogFaceArc = a => {
  eyesArc(9, 18, 10)(a);
  a.r(14, 16, 4, 2, C.k2); a.set(14, 16, '#90a4ae');
  mouthOpen(15, 19)(a);
};
const dogBody = a => {
  const p = P.dog;
  a.r(11, 20, 10, 1, p.m); a.r(10, 21, 12, 1, p.m);
  a.r(9, 22, 14, 5, p.m); a.r(8, 27, 16, 2, p.m);
  a.r(12, 23, 8, 4, p.l);
  a.r(11, 27, 4, 2, p.l); a.r(17, 27, 4, 2, p.l);
};
const dogBodyRun = a => {
  const p = P.dog;
  a.r(9, 21, 14, 5, p.m); a.r(12, 22, 8, 3, p.l);
  a.r(4, 24, 5, 3, p.m); a.r(23, 24, 5, 3, p.m);          // 腿伸开
  a.r(4, 26, 5, 2, p.l); a.r(23, 26, 5, 2, p.l);
};
const dogBodyTuck = a => {
  const p = P.dog;
  a.r(9, 21, 14, 6, p.m); a.r(12, 22, 8, 4, p.l);
  a.r(11, 26, 4, 3, p.l); a.r(17, 26, 4, 3, p.l);         // 腿收起
};
const dogTailLow = a => { a.r(23, 25, 5, 3, P.dog.m); a.r(21, 24, 3, 2, P.dog.m); };
const dogTailUp = a => {
  a.r(23, 24, 5, 2, P.dog.m); a.r(26, 17, 4, 8, P.dog.m);
};

/* ---------- 兔子（长耳一耷拉 · 大眼 · 粉鼻 · 三瓣嘴 · 白身体 · 圆尾） ---------- */
const rabbitEarUp = a => {
  const p = P.rabbit;
  a.blob(10, 0, 4, 8, p.m, 1);                            // 左耳竖起
  a.r(11, 2, 2, 5, C.n);
};
const rabbitEarDroop = a => {                             // 右耳耷拉（画在头之后）
  const p = P.rabbit;
  a.r(20, 4, 4, 4, p.m); a.r(24, 7, 5, 4, p.m);
  a.r(25, 10, 5, 6, p.m);                                 // 垂到脸侧
  a.blob(25, 14, 5, 4, p.m, 2);
  a.r(26, 10, 3, 5, C.n); a.r(26, 14, 3, 2, C.n);         // 内耳粉
};
const rabbitHead = a => {
  const p = P.rabbit;
  rabbitEarUp(a);
  a.blob(7, 7, 18, 13, p.m, 3);                           // 头 x7..24 y7..19
};
const rabbitFace = a => {
  eyesBig(9, 19, 11)(a);
  nose(15, 16)(a);
  mouthW(16, 18)(a);                                      // 三瓣嘴
  blush(8, 21, 16)(a);
};
const rabbitBody = a => {
  const p = P.rabbit;
  a.r(11, 20, 10, 1, p.m); a.r(10, 21, 12, 1, p.m);
  a.r(9, 22, 14, 5, p.m); a.r(8, 27, 16, 2, p.m);
  a.r(12, 23, 8, 4, p.l);
  a.r(11, 27, 4, 2, p.l); a.r(17, 27, 4, 2, p.l);
  a.blob(23, 21, 6, 6, C.w, 3);                           // 圆尾巴
};
const rabbitSit = a => {                                  // 坐下：露出后腿
  const p = P.rabbit;
  a.r(11, 20, 10, 1, p.m); a.r(10, 21, 12, 1, p.m);
  a.r(9, 22, 14, 4, p.m);
  a.blob(6, 25, 7, 4, p.m, 2); a.blob(19, 25, 7, 4, p.m, 2);  // 后腿
  a.r(8, 27, 16, 2, p.m);
  a.r(12, 23, 8, 3, p.l);
  a.r(6, 27, 5, 2, p.l); a.r(21, 27, 5, 2, p.l);          // 大脚掌
  a.blob(23, 21, 6, 6, C.w, 3);
};
const rabbitHopBody = a => {                              // 起跳：身体拉长、后腿蹬开
  const p = P.rabbit;
  a.r(11, 20, 10, 1, p.m); a.r(9, 21, 14, 4, p.m);
  a.r(7, 24, 18, 4, p.m);
  a.r(12, 22, 8, 3, p.l);
  a.blob(4, 25, 7, 4, p.l, 2); a.blob(21, 25, 7, 4, p.l, 2);  // 蹬开的后腿
  a.blob(24, 20, 6, 5, C.w, 3);
};
const rabbitBothUp = a => {                               // 双耳竖起（动耳动作）
  const p = P.rabbit;
  a.blob(9, 0, 4, 8, p.m, 1); a.r(10, 2, 2, 5, C.n);
  a.blob(19, 0, 4, 8, p.m, 1); a.r(20, 2, 2, 5, C.n);
};

/* ---------- 狐狸（尖耳 · 尖吻 · 蓬松大尾 · 橙毛白肚） ---------- */
const foxHead = a => {
  const p = P.fox;
  a.r(9, 1, 2, 1, p.m); a.r(8, 2, 4, 2, p.m); a.r(7, 4, 6, 3, p.m);   // 左尖耳
  a.r(21, 1, 2, 1, p.m); a.r(20, 2, 4, 2, p.m); a.r(19, 4, 6, 3, p.m); // 右尖耳
  a.r(9, 3, 2, 4, p.l); a.r(21, 3, 2, 4, p.l);            // 耳内白毛
  a.blob(7, 7, 18, 12, p.m, 3);                           // 头 x7..24 y7..18
  a.r(7, 8, 2, 3, p.o); a.r(23, 8, 2, 3, p.o);            // 耳根深斑
  /* 尖吻：白色三角 */
  a.r(9, 13, 14, 1, p.l); a.r(10, 14, 12, 1, p.l);
  a.r(11, 15, 10, 1, p.l); a.r(12, 16, 8, 1, p.l);
  a.r(13, 17, 6, 1, p.l);
};
const foxFace = a => {
  eyesBig(9, 19, 9)(a);
  a.r(14, 15, 4, 2, C.k2); a.set(14, 15, '#90a4ae');      // 黑鼻头
  mouthW(16, 17)(a);
};
const foxBody = a => {
  const p = P.fox;
  a.r(11, 19, 10, 1, p.m); a.r(10, 20, 12, 1, p.m);
  a.blob(8, 21, 16, 8, p.m, 3);                           // 身体
  a.r(11, 22, 10, 5, p.l);                                // 白肚皮
  a.r(9, 27, 4, 2, p.o); a.r(19, 27, 4, 2, p.o);          // 爪子
  a.blob(24, 16, 7, 10, p.m, 3);                          // 蓬松大尾
  a.blob(26, 12, 5, 5, p.l, 2);                           // 尾巴白尖
};
const foxTailWag = a => {                                 // 尾巴竖起
  const p = P.fox;
  a.r(11, 19, 10, 1, p.m); a.r(10, 20, 12, 1, p.m);
  a.blob(8, 21, 16, 8, p.m, 3);
  a.r(11, 22, 10, 5, p.l);
  a.r(9, 27, 4, 2, p.o); a.r(19, 27, 4, 2, p.o);
  a.r(24, 18, 4, 6, p.m);
  a.blob(25, 10, 6, 9, p.m, 3);
  a.blob(26, 7, 5, 4, p.l, 2);
};

/* ---------- 小熊（白厨师帽 · 圆耳 · 大眼 · 棕鼻 · 微笑 · 站姿抬爪） ---------- */
const bearHead = a => {
  const p = P.bear;
  a.blob(6, 3, 6, 6, p.m, 2); a.r(8, 5, 2, 2, p.l);       // 左圆耳
  a.blob(20, 3, 6, 6, p.m, 2); a.r(22, 5, 2, 2, p.l);     // 右圆耳
  a.blob(7, 7, 18, 13, p.m, 3);                           // 头 x7..24 y7..19
  a.blob(11, 14, 10, 5, p.l, 2);                          // 口鼻白毛
};
const bearFace = a => {
  eyesBig(9, 19, 11)(a);
  a.r(14, 15, 4, 2, '#9c6b4c'); a.set(14, 15, '#c9a68a'); // 棕鼻 + 高光
  mouthSmile(16, 17, 3)(a);
  blush(8, 21, 16)(a);
};
const bearBody = a => {                                   // 站姿 + 抬爪
  const p = P.bear;
  a.blob(8, 20, 16, 9, p.m, 3);                           // 身体 x8..23 y20..28
  a.r(11, 22, 10, 5, p.l);                                // 肚皮
  a.r(9, 27, 5, 2, p.o); a.r(18, 27, 5, 2, p.o);          // 脚
  a.r(5, 21, 4, 5, p.m); a.r(5, 25, 4, 2, p.l);           // 左臂下垂
  a.r(23, 19, 3, 4, p.m); a.r(25, 16, 4, 4, p.m);         // 右臂抬起（连到身体）
  a.blob(26, 12, 4, 5, p.l, 1);                           // 挥手的小爪
};
const chefHat = a => {
  a.blob(9, 0, 14, 5, C.w, 3);                            // 蓬松帽顶
  a.r(8, 4, 16, 2, '#eceff1'); a.r(8, 6, 16, 1, '#b0bec5'); // 帽檐
};

/* ---------- 青蛙（头顶荷叶 · 凸大眼 · 宽微笑 · 蹲坐前爪） ---------- */
const frogParts = a => {
  const p = P.frog;
  a.blob(7, 4, 7, 7, p.m, 2); a.blob(18, 4, 7, 7, p.m, 2); // 眼睛鼓包
  a.r(8, 5, 5, 5, C.w); a.r(19, 5, 5, 5, C.w);            // 眼白
  a.r(9, 6, 3, 3, C.k); a.r(20, 6, 3, 3, C.k);            // 瞳孔
  a.set(9, 6, C.w); a.set(20, 6, C.w);                    // 高光
  a.blob(5, 11, 22, 13, p.m, 4);                          // 蹲坐身体 x5..26 y11..23
  a.set(14, 12, C.k); a.set(17, 12, C.k);                 // 鼻孔
  a.blob(9, 16, 14, 6, p.l, 3);                           // 白肚皮
  a.r(11, 16, 10, 1, C.k); a.r(10, 15, 2, 1, C.k); a.r(20, 15, 2, 1, C.k); // 宽微笑（两端上翘）
  a.blob(3, 17, 5, 6, p.m, 2); a.blob(24, 17, 5, 6, p.m, 2); // 后腿鼓包
  a.r(2, 22, 6, 2, p.o); a.r(24, 22, 6, 2, p.o);          // 后脚掌
  a.r(10, 23, 5, 2, p.l); a.r(17, 23, 5, 2, p.l);         // 前爪在前
};
const frogLeaf = a => {                                   // 头顶荷叶
  a.r(10, 1, 12, 1, C.leaf); a.r(7, 2, 18, 1, C.leaf);
  a.r(5, 3, 22, 1, C.leaf); a.r(7, 4, 18, 1, C.leaf);
  a.r(15, 2, 2, 2, C.leafD); a.r(15, 0, 2, 1, C.leafD);   // 叶脉 + 叶柄
};
const frogPuff = a => {                                   // 鼓腮
  const p = P.frog;
  a.r(3, 14, 3, 5, p.m); a.r(26, 14, 3, 5, p.m);
};

/* ---------- 猫头鹰（蓝色尖顶睡帽 · 超大橙虹膜眼 · 黄喙 · 收翅） ---------- */
const owlParts = a => {
  const p = P.owl;
  a.blob(5, 4, 22, 20, p.m, 4);                           // 身体 x5..26 y4..23
  a.r(5, 11, 3, 8, p.o); a.r(24, 11, 3, 8, p.o);          // 收拢的翅膀
  a.blob(7, 7, 9, 9, C.w, 3); a.blob(16, 7, 9, 9, C.w, 3);// 超大眼圈
  a.blob(9, 9, 5, 5, C.iris, 2); a.blob(18, 9, 5, 5, C.iris, 2); // 橙色虹膜
  a.r(10, 10, 3, 3, C.k); a.r(19, 10, 3, 3, C.k);         // 瞳孔
  a.set(10, 10, C.w); a.set(19, 10, C.w);                 // 高光
  a.r(14, 16, 4, 1, C.beak); a.r(15, 17, 2, 2, C.beak);   // 黄三角喙
  a.blob(9, 19, 14, 4, p.l, 2);                           // 肚皮
  a.set(11, 20, p.o); a.set(14, 21, p.o); a.set(17, 20, p.o); a.set(20, 21, p.o);
  a.r(11, 23, 3, 2, C.beak); a.r(18, 23, 3, 2, C.beak);   // 爪子
  /* 蓝色尖顶睡帽（末端白球） */
  a.r(6, 3, 19, 2, C.ocapD);
  a.r(8, 2, 10, 1, C.ocap); a.r(9, 1, 8, 1, C.ocap); a.r(11, 0, 5, 1, C.ocap);
  a.blob(16, 0, 5, 4, C.w, 1);
};
const owlEyesShut = a => {                                // 闭眼版（完整帧）
  const p = P.owl;
  a.blob(5, 4, 22, 20, p.m, 4);                          // 身体
  a.r(5, 11, 3, 8, p.o); a.r(24, 11, 3, 8, p.o);         // 收拢的翅膀
  a.blob(7, 7, 9, 9, C.w, 3); a.blob(16, 7, 9, 9, C.w, 3);
  a.r(8, 11, 7, 1, C.k); a.r(17, 11, 7, 1, C.k);
  a.set(8, 10, C.k); a.set(14, 10, C.k);
  a.set(17, 10, C.k); a.set(23, 10, C.k);
  a.r(14, 16, 4, 1, C.beak); a.r(15, 17, 2, 2, C.beak);
  a.blob(9, 19, 14, 4, p.l, 2);
  a.r(11, 23, 3, 2, C.beak); a.r(18, 23, 3, 2, C.beak);
  a.r(6, 3, 19, 2, C.ocapD);
  a.r(8, 2, 10, 1, C.ocap); a.r(9, 1, 8, 1, C.ocap); a.r(11, 0, 5, 1, C.ocap);
  a.blob(16, 0, 5, 4, C.w, 1);
};
const owlCap = a => {                                     // 仅帽子（供 owl-happy 覆盖用）
  a.r(6, 3, 19, 2, C.ocapD);
  a.r(8, 2, 10, 1, C.ocap); a.r(9, 1, 8, 1, C.ocap); a.r(11, 0, 5, 1, C.ocap);
  a.blob(16, 0, 5, 4, C.w, 1);
};

/* ---------- 仓鼠（圆滚滚 · 小圆耳 · 鼓腮帮 · 小短腿） ---------- */
const hamsterParts = a => {
  const p = P.hamster;
  a.blob(8, 3, 6, 5, p.m, 2); a.blob(19, 3, 6, 5, p.m, 2); // 小圆耳
  a.r(10, 4, 2, 2, C.n); a.r(21, 4, 2, 2, C.n);
  a.blob(4, 5, 24, 22, p.m, 6);                           // 圆身体 x4..27 y5..26
  a.r(2, 14, 3, 6, p.m); a.r(27, 14, 3, 6, p.m);          // 鼓腮帮
  a.blob(9, 16, 14, 8, p.l, 3);                           // 白肚皮
  a.r(6, 15, 3, 2, C.n); a.r(23, 15, 3, 2, C.n);          // 腮红
  a.r(15, 15, 2, 1, C.p);                                 // 小粉鼻
};
const hamsterFace = a => {
  eyesBig(10, 18, 10)(a);
  mouthW(16, 17)(a);
};
const hamsterFeet = a => { a.r(10, 26, 4, 2, P.hamster.o); a.r(18, 26, 4, 2, P.hamster.o); };
const hamsterRunFeet = a => { a.r(4, 25, 5, 3, P.hamster.o); a.r(23, 25, 5, 3, P.hamster.o); };

/* ---------- 小鸟（回到顶部 / 分区标题） ---------- */
const birdBody = a => {
  const p = P.bird;
  a.blob(9, 12, 14, 11, p.m, 4);                          // 身体
  a.r(12, 16, 8, 5, p.l);                                 // 白肚皮
  a.blob(10, 5, 12, 10, p.m, 4);                          // 头
  a.r(7, 14, 3, 6, p.o); a.r(22, 14, 3, 6, p.o);          // 收着的翅膀
  a.r(12, 7, 3, 3, C.k); a.r(17, 7, 3, 3, C.k);           // 大眼
  a.set(12, 7, C.w); a.set(17, 7, C.w);
  a.r(21, 10, 4, 1, C.beak); a.r(21, 11, 3, 1, C.beak); a.r(21, 12, 4, 1, C.beak);
  a.r(12, 22, 2, 2, C.beak); a.r(17, 22, 2, 2, C.beak);   // 小脚
};
const birdFly = a => {
  const p = P.bird;
  a.blob(9, 12, 14, 11, p.m, 4);
  a.r(12, 16, 8, 5, p.l);
  a.blob(10, 5, 12, 10, p.m, 4);
  a.r(7, 6, 4, 6, p.o); a.r(21, 6, 4, 6, p.o);            // 翅膀上扬
  a.r(12, 7, 3, 3, C.k); a.r(17, 7, 3, 3, C.k);
  a.set(12, 7, C.w); a.set(17, 7, C.w);
  a.r(21, 10, 4, 1, C.beak); a.r(21, 11, 3, 1, C.beak); a.r(21, 12, 4, 1, C.beak);
  a.r(13, 22, 6, 1, C.beak);                              // 收起的脚
};

/* ---------- 小工具：挖洞（画月牙 / 镜片用） ---------- */
const del = (a, x, y, w, h) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) a.m.delete((y + j) * W + (x + i));
};
const blobDel = (a, x, y, w, h, round) => {
  round = round === undefined ? 4 : round;
  for (let j = 0; j < h; j++) {
    const t = Math.min(j, h - 1 - j);
    let ins = 0;
    if (t === 0) ins = Math.min(round, Math.floor((w - 1) / 2));
    else if (t === 1) ins = Math.min(Math.ceil(round / 2), Math.floor((w - 1) / 2));
    if (w - 2 * ins > 0) del(a, x + ins, y + j, w - 2 * ins, 1);
  }
};

/* ---------- 天气装备（叠加在猫身上） ---------- */
const wxSunGlasses = a => {                               // 墨镜
  a.r(8, 11, 6, 5, C.k2); a.r(18, 11, 6, 5, C.k2);
  a.r(14, 12, 4, 1, C.k2);
  a.r(9, 12, 3, 1, '#78909c'); a.r(19, 12, 3, 1, '#78909c'); // 镜片反光
};
const wxLeafUmbrella = a => {                             // 荷叶伞
  a.r(11, 0, 10, 1, C.leaf); a.r(8, 1, 16, 1, C.leaf);
  a.r(7, 2, 18, 1, C.leaf); a.r(15, 1, 2, 1, C.leafD);
};
const wxScarf = a => {                                    // 围巾
  a.r(11, 20, 10, 3, C.scarf); a.r(19, 23, 3, 4, C.scarf);
  a.r(19, 27, 3, 1, '#c62828');
};

/* ---------- 图标 ---------- */
const ICONS = {
  sun: a => {
    a.blob(11, 11, 10, 10, '#ffca28', 3);
    a.r(14, 5, 4, 4, '#ffca28'); a.r(14, 23, 4, 4, '#ffca28');
    a.r(5, 14, 4, 4, '#ffca28'); a.r(23, 14, 4, 4, '#ffca28');
    a.r(8, 8, 3, 3, '#ffca28'); a.r(21, 8, 3, 3, '#ffca28');
    a.r(8, 21, 3, 3, '#ffca28'); a.r(21, 21, 3, 3, '#ffca28');
  },
  moon: a => {
    a.blob(8, 7, 17, 18, C.y, 5);
    blobDel(a, 13, 3, 19, 24, 6);                       // 右侧挖圆 → 月牙
    a.r(4, 9, 2, 2, C.w); a.r(6, 24, 2, 2, C.w);         // 小星星
  },
  paw: a => {
    a.blob(4, 9, 5, 6, C.p, 2); a.blob(10, 5, 6, 7, C.p, 2);
    a.blob(16, 5, 6, 7, C.p, 2); a.blob(22, 9, 5, 6, C.p, 2);
    a.blob(9, 16, 13, 9, C.p, 4);                         // 肉垫
  },
  search: a => {
    a.blob(6, 5, 15, 15, C.k, 5);                         // 镜圈
    blobDel(a, 9, 8, 9, 9, 4);
    a.r(19, 19, 4, 4, C.k); a.r(22, 22, 4, 4, C.k); a.r(25, 25, 4, 4, C.k); // 手柄
  },
  heart: a => {
    a.r(7, 8, 7, 1, C.p); a.r(18, 8, 7, 1, C.p);
    a.r(6, 9, 9, 1, C.p); a.r(17, 9, 9, 1, C.p);
    a.r(5, 10, 22, 4, C.p);
    a.r(5, 14, 22, 1, C.p); a.r(6, 15, 20, 1, C.p);
    a.r(7, 16, 18, 1, C.p); a.r(8, 17, 16, 1, C.p);
    a.r(9, 18, 14, 1, C.p); a.r(10, 19, 12, 1, C.p);
    a.r(12, 20, 8, 1, C.p); a.r(14, 21, 4, 1, C.p);
    a.r(8, 10, 3, 2, C.w);                                // 高光
  },
  hash: a => {
    a.r(11, 7, 3, 19, C.k); a.r(19, 7, 3, 19, C.k);
    a.r(5, 13, 23, 3, C.k); a.r(5, 20, 23, 3, C.k);
  },
};

/* ---------- 春日背景装饰 ---------- */
const butterflyBody = a => {
  a.r(15, 12, 2, 9, C.k2);
  a.set(14, 10, C.k2); a.set(13, 9, C.k2);
  a.set(17, 10, C.k2); a.set(18, 9, C.k2);                // 触角
};
const DECOR = {
  /* 蝴蝶：翅膀张开 / 收起（两帧用 CSS 切换 opacity 实现扇翅） */
  'butterfly-a': a => {
    butterflyBody(a);
    a.blob(6, 6, 9, 8, '#f48fb1', 3); a.blob(17, 6, 9, 8, '#f48fb1', 3);   // 上翅
    a.blob(8, 14, 7, 7, '#f8bbd0', 3); a.blob(17, 14, 7, 7, '#f8bbd0', 3); // 下翅
    a.r(9, 8, 3, 3, C.w); a.r(20, 8, 3, 3, C.w);          // 翅斑
    a.set(11, 16, C.w); a.set(20, 16, C.w);
  },
  'butterfly-b': a => {
    a.r(15, 10, 2, 11, C.k2);
    a.set(14, 8, C.k2); a.set(13, 7, C.k2);
    a.set(17, 8, C.k2); a.set(18, 7, C.k2);
    a.blob(10, 6, 6, 14, '#f48fb1', 3); a.blob(16, 6, 6, 14, '#f48fb1', 3); // 收起的翅
    a.blob(11, 8, 4, 5, '#f8bbd0', 2); a.blob(17, 8, 4, 5, '#f8bbd0', 2);
  },
  /* 蜜蜂：翅膀上扬 / 收下 */
  'bee-a': a => {
    a.blob(9, 13, 14, 9, '#ffd54f', 4);                   // 身体
    a.r(13, 13, 3, 9, C.k2); a.r(18, 14, 3, 7, C.k2);     // 黑黄条纹
    a.r(7, 16, 3, 2, C.k2);                               // 尾针
    a.set(21, 16, C.k); a.set(22, 16, C.k);               // 眼
    a.set(20, 11, C.k2); a.set(21, 10, C.k2);             // 触角
    a.blob(12, 4, 7, 7, '#e1f5fe', 3);                    // 翅膀上扬
  },
  'bee-b': a => {
    a.blob(9, 13, 14, 9, '#ffd54f', 4);
    a.r(13, 13, 3, 9, C.k2); a.r(18, 14, 3, 7, C.k2);
    a.r(7, 16, 3, 2, C.k2);
    a.set(21, 16, C.k); a.set(22, 16, C.k);
    a.set(20, 11, C.k2); a.set(21, 10, C.k2);
    a.blob(12, 9, 7, 5, '#e1f5fe', 3);                    // 翅膀收下
  },
  /* 像素云朵（半透明慢飘） */
  'cloud-s': a => {
    a.blob(6, 13, 20, 8, C.w, 4); a.blob(10, 9, 10, 6, C.w, 3);
  },
  'cloud-m': a => {
    a.blob(3, 14, 26, 8, C.w, 4); a.blob(8, 9, 12, 7, C.w, 3);
    a.blob(17, 10, 10, 6, C.w, 3);
  },
  'cloud-l': a => {
    a.blob(1, 14, 30, 8, C.w, 3); a.blob(6, 8, 14, 8, C.w, 4);
    a.blob(18, 10, 12, 7, C.w, 3);
  },
  /* 垂柳枝条（左右摇曳） */
  'willow': a => {
    a.r(15, 0, 2, 22, '#7cb342'); a.r(16, 21, 2, 2, '#7cb342');
    a.r(17, 22, 2, 10, '#7cb342');                        // 枝条下垂微弯
    a.blob(10, 3, 6, 3, C.leaf, 2); a.blob(16, 6, 6, 3, C.leaf, 2);
    a.blob(10, 9, 6, 3, C.leaf, 2); a.blob(16, 12, 6, 3, C.leaf, 2);
    a.blob(10, 15, 6, 3, C.leaf, 2); a.blob(16, 18, 6, 3, C.leaf, 2);
    a.blob(11, 24, 6, 3, C.leaf, 2); a.blob(17, 27, 6, 3, C.leaf, 2);
    a.r(12, 4, 1, 1, C.leafD); a.r(17, 7, 1, 1, C.leafD);
    a.r(12, 10, 1, 1, C.leafD); a.r(17, 13, 1, 1, C.leafD);
  },
  /* 摇曳的小草 */
  'tuft': a => {
    a.r(7, 26, 2, 5, C.leaf); a.r(6, 25, 1, 1, C.leaf);
    a.r(13, 21, 2, 10, C.leafD); a.r(15, 23, 2, 8, C.leaf);
    a.r(20, 24, 2, 7, C.leafD); a.r(24, 27, 2, 4, C.leaf);
    a.set(12, 20, C.leafD); a.set(22, 23, C.leafD);
  },
  /* 雏菊 */
  'daisy': a => {
    a.blob(13, 5, 6, 7, C.w, 2); a.blob(13, 20, 6, 7, C.w, 2);
    a.blob(5, 13, 7, 6, C.w, 2); a.blob(20, 13, 7, 6, C.w, 2);
    a.blob(7, 7, 6, 6, C.w, 2); a.blob(19, 7, 6, 6, C.w, 2);
    a.blob(7, 19, 6, 6, C.w, 2); a.blob(19, 19, 6, 6, C.w, 2);
    a.blob(13, 13, 6, 6, '#ffd54f', 2);                   // 花心
    a.r(15, 16, 2, 14, C.leafD);                          // 茎
  },
  /* 郁金香（粉 / 红 / 黄） */
  tulip: (c) => a => {
    a.r(15, 15, 2, 15, C.leafD);                          // 茎
    a.blob(8, 21, 7, 4, C.leaf, 2);                       // 叶
    a.blob(17, 24, 7, 4, C.leaf, 2);
    a.blob(10, 6, 12, 9, c, 2);                           // 花杯
    a.r(10, 4, 4, 3, c); a.r(18, 4, 4, 3, c);             // 两瓣侧花瓣
    a.r(14, 3, 4, 4, c);                                  // 中间更高
    a.r(14, 7, 2, 7, darken(c, 0.85));                    // 花瓣纹理
  },
  /* 蒲公英绒球 */
  'dandelion': a => {
    a.r(15, 15, 2, 15, C.leafD);
    a.blob(11, 6, 10, 10, C.w, 4);
    a.r(10, 4, 2, 2, C.w); a.r(15, 3, 2, 2, C.w); a.r(20, 4, 2, 2, C.w);
    a.r(22, 8, 2, 2, C.w); a.r(23, 13, 2, 2, C.w); a.r(21, 17, 2, 2, C.w);
    a.r(16, 18, 2, 2, C.w); a.r(10, 17, 2, 2, C.w); a.r(7, 13, 2, 2, C.w);
    a.r(7, 8, 2, 2, C.w);
    a.set(15, 10, '#ffe082'); a.set(16, 11, '#ffe082');   // 绒心
  },
  /* 小蘑菇（红伞白点） */
  'mushroom': a => {
    a.blob(6, 8, 20, 9, '#ef5350', 5);                    // 伞盖
    a.r(11, 11, 3, 3, C.w); a.r(17, 10, 4, 3, C.w); a.r(13, 14, 3, 2, C.w);
    a.r(12, 16, 8, 8, '#fff3e0');                         // 菌柄
    a.r(18, 17, 2, 6, '#e8d5c0'); a.r(11, 23, 10, 1, '#e8d5c0');
  },
  /* 背景散落小野花（白 / 粉 / 黄 / 紫） */
  mini: (c, core) => a => {
    a.r(15, 18, 2, 12, C.leafD);
    a.blob(8, 20, 6, 4, C.leaf, 2);
    a.blob(18, 23, 6, 4, C.leaf, 2);
    a.blob(12, 6, 8, 6, c, 2); a.blob(12, 19, 8, 6, c, 2);
    a.blob(6, 12, 6, 8, c, 2); a.blob(20, 12, 6, 8, c, 2);
    a.blob(13, 13, 6, 6, core, 2);
  },
};

/* ============================================================
 *  组装所有帧
 * ============================================================ */
const frames = {};
const NO_OUTLINE = new Set(['cloud-s', 'cloud-m', 'cloud-l']);  // 云朵不描边，保持柔软
function F(name, parts, post) {
  const a = create();
  parts.forEach(f => f(a));
  if (!NO_OUTLINE.has(name)) autoOutline(a);
  if (post) post.forEach(f => f(a));                     // 细节层：描边后再画（胡须等）
  frames[name] = a.m;
}

/* —— 猫 —— */
const catFaceHappy = a => {
  eyesArc(9, 19, 11)(a); nose(15, 16)(a); mouthOpen(16, 18)(a); blush(8, 21, 16)(a);
};
const catFaceShy = a => {
  eyesShut(9, 19, 11)(a); nose(15, 16)(a); mouthW(16, 18)(a); blush(8, 21, 16)(a);
};
const catFaceSurprise = a => {
  eyesWide(9, 19, 10)(a); nose(15, 16)(a); mouthO(16, 18)(a);
};
const catFaceBlush = a => {
  eyesArc(9, 19, 11)(a); nose(15, 16)(a); mouthOpen(16, 18)(a);
  a.r(7, 16, 4, 2, C.p); a.r(21, 16, 4, 2, C.p);         // 红扑扑的脸蛋
};
const catWinkFace = a => {
  a.r(9, 14, 4, 1, C.k); a.set(9, 13, C.k); a.set(12, 13, C.k); // 左眼眨
  eyesBig(19, 19, 11)(a);
  nose(15, 16)(a); mouthW(16, 18)(a); blush(8, 21, 16)(a);
};
const catLook = dx => a => {
  eyesLook(9, 19, 11, dx)(a); nose(15, 16)(a); mouthW(16, 18)(a); blush(8, 21, 16)(a);
};

F('cat-idle',     [catHead, catBody, catTailLow, catFace], [catWhiskers]);
F('cat-wag',      [catHead, catBody, catTailUp, catFace], [catWhiskers]);
F('cat-happy',    [catHead, catBody, catTailUp, catFaceHappy], [catWhiskers]);
F('cat-shy',      [catHead, catBody, catTailUp, catFaceShy], [catWhiskers]);
F('cat-surprise', [catHead, catBody, catTailUp, catFaceSurprise], [catWhiskers]);
F('cat-wink',     [catHead, catBody, catTailLow, catWinkFace], [catWhiskers]);
F('cat-blush',    [catHead, catBody, catTailUp, catFaceBlush], [catWhiskers]);
F('cat-sleep',    [catHead, catBody, catTailLow, eyesShut(9, 19, 11), nose(15, 16),
                   mouthW(16, 18), nightcap(9), zzz], [catWhiskers]);
F('cat-lie',      [fatCat, fatCatFace]);
F('cat-lie-wag',  [fatCat, a => {
  eyesBig(5, 11, 12)(a); nose(8, 16)(a); mouthOpen(9, 18)(a); blush(4, 14, 17)(a);
}]);
F('cat-bow-idle',    [catHead, catBow, catBody, catTailLow, catFace], [catWhiskers]);
F('cat-bow-shy',     [catHead, catBow, catBody, catTailUp, catFaceShy], [catWhiskers]);
F('cat-bow-surprise',[catHead, catBow, catBody, catTailUp, catFaceSurprise], [catWhiskers]);
F('cat-bow-wink',    [catHead, catBow, catBody, catTailLow, catWinkFace], [catWhiskers]);
F('cat-lookl', [catHead, catBody, catTailLow, catLook(-1)], [catWhiskers]);
F('cat-lookr', [catHead, catBody, catTailLow, catLook(1)], [catWhiskers]);

/* —— 狗 —— */
const dogFaceBark = a => {
  eyesBig(9, 18, 10)(a);
  a.r(14, 16, 4, 2, C.k2); a.set(14, 16, '#90a4ae');
  mouthO(15, 18)(a);
};
F('dog-idle',  [dogHead, dogGlasses, dogBody, dogTailLow, dogFaceOpen]);
F('dog-happy', [dogHead, dogGlasses, dogBody, dogTailUp, dogFaceArc]);
F('dog-run',   [dogHead, dogGlasses, dogBodyRun, dogTailUp, dogFaceOpen]);
F('dog-jump',  [dogHead, dogGlasses, dogBodyTuck, dogTailUp, dogFaceArc]);
F('dog-bark',  [dogHead, dogGlasses, dogBodyTuck, dogTailUp, dogFaceBark]);
F('dog-sleep', [dogHead, dogGlasses, dogBody, dogTailLow, eyesShut(9, 18, 10),
                a => a.r(14, 16, 4, 2, C.k2), mouthSmile(15, 18, 3), nightcap(9), zzz]);
F('dog-coder', [dogHead, dogGlasses, dogBody, dogTailLow, dogFaceOpen, a => {
  a.r(10, 0, 8, 1, '#66bb6a'); a.r(11, 2, 7, 1, '#4fc3f7'); a.r(9, 4, 6, 1, '#ffd54f');
}]);
F('dog-blush', [dogHead, dogGlasses, dogBody, dogTailUp, eyesArc(9, 18, 10),
                a => a.r(14, 16, 4, 2, C.k2), mouthOpen(15, 19),
                a => { a.r(7, 16, 4, 2, C.p); a.r(21, 16, 4, 2, C.p); }]);

/* —— 兔子 —— */
const rabbitHeadBlob = a => a.blob(7, 7, 18, 13, P.rabbit.m, 3);
F('rabbit-idle', [rabbitEarDroop, rabbitHead, rabbitBody, rabbitFace]);
F('rabbit-sit',  [rabbitEarDroop, rabbitHead, rabbitSit, rabbitFace]);
F('rabbit-ear',  [rabbitBothUp, rabbitHeadBlob, rabbitBody, rabbitFace]);
F('rabbit-hop',  [rabbitEarDroop, rabbitHead, rabbitHopBody,
                  eyesBig(9, 19, 11), nose(15, 16), mouthOpen(16, 18), blush(8, 21, 16)]);
F('rabbit-happy',[rabbitEarDroop, rabbitHead, rabbitBody,
                  eyesArc(9, 19, 11), nose(15, 16), mouthOpen(16, 18), blush(8, 21, 16)]);
F('rabbit-sleep',[rabbitEarDroop, rabbitHead, rabbitBody, eyesShut(9, 19, 11),
                  nose(15, 16), mouthW(16, 18), nightcap(9), zzz]);

/* —— 狐狸 —— */
const foxNose = a => { a.r(14, 15, 4, 2, C.k2); a.set(14, 15, '#90a4ae'); };
F('fox-idle',  [foxHead, foxBody, foxFace]);
F('fox-wag',   [foxHead, foxTailWag, foxFace]);
F('fox-happy', [foxHead, foxTailWag, eyesArc(9, 19, 9), foxNose, mouthOpen(16, 17)]);
F('fox-sleep', [foxHead, foxBody, eyesShut(9, 19, 9), foxNose, mouthW(16, 17),
                nightcap(8), zzz]);

/* —— 小熊 —— */
const bearNose = a => { a.r(14, 15, 4, 2, '#9c6b4c'); a.set(14, 15, '#c9a68a'); };
F('bear-idle',  [bearHead, bearBody, bearFace]);
F('bear-chef',  [bearHead, chefHat, bearBody, bearFace]);
F('bear-yawn',  [bearHead, bearBody, eyesShut(9, 19, 11), bearNose,
                 a => { a.r(13, 15, 7, 3, C.k); a.r(14, 17, 5, 1, C.p);
                        a.r(7, 16, 4, 2, C.p); a.r(21, 16, 4, 2, C.p); }]);
F('bear-sleep', [bearHead, bearBody, eyesShut(9, 19, 11), bearNose,
                 mouthSmile(16, 17, 3), nightcap(9), zzz]);
F('bear-blush', [bearHead, bearBody, eyesArc(9, 19, 11), bearNose, mouthOpen(16, 17),
                 a => { a.r(7, 16, 4, 2, C.p); a.r(21, 16, 4, 2, C.p); }]);
F('bear-happy', [bearHead, bearBody, eyesArc(9, 19, 11), bearNose, mouthOpen(16, 17),
                 blush(8, 21, 16)]);

/* —— 棕熊 brownie（男主「我」· 圆脸短吻 · 奶黄脸颊斑 · 深棕大眼无镜框 ·
      抱胸手臂 · 粉围兜梯形 · 坐姿小脚，头 y6-19 / 身体 y20-29 与 dog-idle 对齐） —— */
/* 深棕大眼：3x4 圆角块 + 白色小高光（参考 owl 的眼层次，但无任何外框/镜腿） */
const brownieEye = (x, y) => a => {
  a.r(x + 1, y, 1, 1, C.bEye);
  a.r(x, y + 1, 3, 2, C.bEye);
  a.r(x + 1, y + 3, 1, 1, C.bEyeD);      // 下缘深一阶，做出眼的层次
  a.set(x + 1, y + 1, C.w);
  a.set(x + 2, y + 2, C.w);              // 两粒白色高光
};
const brownieHead = a => {
  const p = P.brownie;
  a.blob(6, 3, 6, 6, p.m, 2); a.r(8, 4, 2, 2, p.l);        // 左圆耳 + 浅色内耳
  a.blob(20, 3, 6, 6, p.m, 2); a.r(22, 4, 2, 2, p.l);      // 右圆耳
  a.blob(7, 6, 18, 14, p.m, 3);                            // 大圆脸 x7..24 y6..19
  /* 脸颊两侧奶黄斑（4x5 圆角块，眼尾外侧偏下，最醒目的花纹） */
  a.r(7, 15, 4, 3, C.cheek); a.r(8, 14, 2, 1, C.cheek); a.r(8, 18, 2, 1, C.cheek);
  a.r(21, 15, 4, 3, C.cheek); a.r(22, 14, 2, 1, C.cheek); a.r(22, 18, 2, 1, C.cheek);
};
const brownieNose = a => {                                  // 小棕鼻 + 一个浅色高光点
  a.r(14, 15, 4, 2, C.bNose); a.set(14, 15, P.brownie.l);
};
const brownieFace = a => {
  brownieEye(10, 10)(a); brownieEye(19, 10)(a);            // 双大眼（对称中心 x15.5）
  brownieNose(a);
  mouthW(16, 17)(a);                                        // 浅浅的 ω 微笑嘴（不吐舌）
  a.r(8, 16, 3, 2, C.n); a.r(21, 16, 3, 2, C.n);            // 眼睛外侧下方的粉腮红
};
const brownieBody = a => {                                  // 坐姿身体（y20..28，描边后到 29）
  const p = P.brownie;
  a.r(11, 20, 10, 1, p.m); a.r(10, 21, 12, 1, p.m);
  a.r(9, 22, 14, 5, p.m); a.r(8, 27, 16, 2, p.m);
};
const BIB_ROWS = [                                          // 上宽 15 → 收至 7 → 底尖 5
  [9, 20, 15], [9, 21, 15], [10, 22, 13], [11, 23, 11],
  [12, 24, 9], [13, 25, 7], [13, 26, 7], [14, 27, 5]
];
const bibPaint = (main, dark, hi) => a => {                  // 梯形口水巾（上宽下窄）
  BIB_ROWS.forEach(([x, y, w]) => {
    a.r(x, y, w, 1, main);
    a.r(x + w - 2, y, 2, 1, dark);                          // 右侧暗部
    if (y <= 21) a.r(x, y, 2, 1, hi);                       // 左上高光
  });
};
const brownieBib = a => {                                   // 粉围兜 + 兜面白花小方块
  bibPaint(C.p, C.bibD, C.bibHi)(a);
  [[12, 20], [18, 20], [13, 21], [17, 21],
   [14, 24], [18, 24], [15, 25], [14, 26]]
    .forEach(([x, y]) => a.set(x, y, '#fffaf0'));
};
const armPaint = (m, d, l) => a => {                        // 双臂横抱身前、在围兜上方交叠
  a.r(20, 21, 5, 3, m);                                    // 右肩 + 右前臂（先画，被左臂压住）
  a.r(15, 22, 6, 2, m);
  a.r(7, 21, 5, 3, m);                                     // 左肩 + 左前臂（后画 → 交叠在右臂上）
  a.r(11, 22, 6, 2, m);
  a.set(17, 22, d);                                        // 交叠分界：左臂压在右臂上的投影
  a.r(7, 23, 10, 1, d); a.r(17, 23, 8, 1, d);              // 手臂下缘阴影
  a.set(14, 23, l); a.set(15, 23, l);                      // 左爪爪垫
  a.set(17, 23, l); a.set(18, 23, l);                      // 右爪爪垫
};
const brownieArms = a => armPaint(C.arm, C.armD, P.brownie.l)(a);
const brownieFeet = a => {                                  // 底部两只小脚（与 dog-idle 齐平）
  a.r(11, 27, 4, 2, P.brownie.l); a.r(17, 27, 4, 2, P.brownie.l);
};
const brownieFaceHappy = a => {                             // 眯眼 ⌒ 笑，腮红更明显
  eyesArc(9, 19, 10)(a);
  brownieNose(a);
  mouthSmile(16, 17, 3)(a);
  a.r(8, 16, 3, 2, C.p); a.r(21, 16, 3, 2, C.p);
};
const brownieFaceBlush = a => {                             // 保持睁眼，脸更红
  brownieEye(10, 10)(a); brownieEye(19, 10)(a);
  brownieNose(a);
  mouthSmile(16, 17, 3)(a);
  a.r(8, 15, 4, 3, C.p); a.r(20, 15, 4, 3, C.p);
};
const brownieFaceSleep = a => {                             // 闭眼 + 复用紫睡帽 + zzz
  eyesShut(9, 19, 10)(a);
  brownieNose(a);
  mouthW(16, 17)(a);
  a.r(8, 16, 3, 2, C.n); a.r(21, 16, 3, 2, C.n);
};
const brownieBase = f => [brownieHead, brownieBody, brownieBib, brownieArms, f, brownieFeet];
F('brownie-idle',  brownieBase(brownieFace));
F('brownie-happy', brownieBase(brownieFaceHappy));
F('brownie-blush', brownieBase(brownieFaceBlush));
F('brownie-sleep', brownieBase(brownieFaceSleep).concat([nightcap(9), zzz]));

/* —— 奶油熊 belle（女主「她」· 闭眼打瞌睡 · 鼻侧鼻涕泡 · 棕围兜 · 体型与 brownie 一致） —— */
const belleShut = (xl, xr, y) => a => {                     // 暖棕灰闭眼弧线（柔和非黑）
  const c = P.belle.o;
  a.r(xl, y + 3, 4, 1, c); a.r(xr, y + 3, 4, 1, c);
  a.set(xl, y + 2, c); a.set(xl + 3, y + 2, c);
  a.set(xr, y + 2, c); a.set(xr + 3, y + 2, c);
};
const belleArc = (xl, xr, y) => a => {                      // 弯弯的笑眼 ⌒
  const c = P.belle.o;
  [xl, xr].forEach(x => {
    a.set(x, y + 1, c); a.r(x + 1, y, 2, 1, c); a.set(x + 3, y + 1, c);
  });
};
const belleHead = a => {
  const p = P.belle;
  a.blob(6, 3, 6, 6, p.m, 2); a.r(8, 4, 2, 2, C.n);        // 圆耳 + 粉内耳
  a.blob(20, 3, 6, 6, p.m, 2); a.r(22, 4, 2, 2, C.n);
  a.blob(7, 6, 18, 14, p.m, 3);                             // 奶油大圆脸（蓝色绝不画眼睛）
};
const belleBubble = a => {                                  // 鼻侧打瞌睡鼻涕泡（贴鼻不进脸颊中央）
  a.r(18, 16, 1, 1, C.bubbleD); a.r(18, 17, 1, 1, C.bubbleD); // 中蓝小泡串连到鼻侧
  a.r(19, 17, 2, 2, C.bubble);                              // 浅蓝主泡
  a.set(19, 17, C.w);                                       // 白色高光
};
const belleFace = a => {
  belleShut(9, 19, 10)(a);                                  // 闭眼瞌睡
  a.r(14, 15, 4, 2, C.p);                                   // 小粉鼻
  a.set(15, 17, C.k); a.set(16, 18, C.k); a.set(17, 17, C.k);// 安静的小嘴
  a.r(8, 16, 3, 2, C.n); a.r(21, 16, 3, 2, C.n);            // 粉腮红
  belleBubble(a);
};
const belleBody = a => {                                    // 坐姿身体（与 brownie 同尺寸）
  const p = P.belle;
  a.r(11, 20, 10, 1, p.m); a.r(10, 21, 12, 1, p.m);
  a.r(9, 22, 14, 5, p.m); a.r(8, 27, 16, 2, p.m);
};
const belleBib = a => {                                     // 棕围兜 + 少量奶白小方块
  bibPaint(C.bbib, C.bbibD, C.bbibHi)(a);
  [[13, 20], [18, 20], [15, 24], [16, 25], [14, 26]]
    .forEach(([x, y]) => a.set(x, y, P.belle.l));
};
const belleArms = a => armPaint(P.belle.o, darken(P.belle.o, 0.85), P.belle.l)(a);
const belleFeet = a => {
  a.r(11, 27, 4, 2, P.belle.l); a.r(17, 27, 4, 2, P.belle.l);
};
const belleFaceHappy = a => {                               // 被逗醒的甜笑：弯弯笑眼、泡消失
  belleArc(9, 19, 10)(a);
  a.r(14, 15, 4, 2, C.p);
  mouthSmile(16, 17, 3)(a);
  a.r(8, 16, 3, 2, C.n); a.r(21, 16, 3, 2, C.n);
};
const belleFaceBlush = a => {                               // 闭眼 + 大粉腮红 + 泡缩小保留
  belleShut(9, 19, 10)(a);
  a.r(14, 15, 4, 2, C.p);
  a.set(15, 17, C.k); a.set(16, 18, C.k); a.set(17, 17, C.k);
  a.r(7, 15, 4, 3, C.n); a.r(21, 15, 4, 3, C.n);            // 大粉腮红（贴脸缘，与鼻隔开 3 格不糊成一条）
  a.r(18, 16, 1, 1, C.bubbleD); a.r(19, 17, 1, 1, C.bubble);// 缩小的鼻涕泡
};
const belleBase = f => [belleHead, belleBody, belleBib, belleArms, f, belleFeet];
F('belle-idle',  belleBase(belleFace));
F('belle-happy', belleBase(belleFaceHappy));
F('belle-blush', belleBase(belleFaceBlush));
F('belle-sleep', belleBase(belleFace));                     // 夜间直接复用闭眼泡组合

/* —— 青蛙 —— */
const frogSleep = a => {
  const p = P.frog;
  a.blob(7, 4, 7, 7, p.m, 2); a.blob(18, 4, 7, 7, p.m, 2);
  a.r(8, 5, 5, 5, C.w); a.r(19, 5, 5, 5, C.w);
  a.r(8, 7, 5, 1, C.k); a.r(19, 7, 5, 1, C.k);            // 闭眼
  a.blob(5, 11, 22, 13, p.m, 4);
  a.set(14, 12, C.k); a.set(17, 12, C.k);
  a.blob(9, 16, 14, 6, p.l, 3);
  a.r(14, 15, 5, 1, C.k);                                 // 睡着的小嘴
  a.blob(3, 17, 5, 6, p.m, 2); a.blob(24, 17, 5, 6, p.m, 2);
  a.r(2, 22, 6, 2, p.o); a.r(24, 22, 6, 2, p.o);
  a.r(10, 23, 5, 2, p.l); a.r(17, 23, 5, 2, p.l);
};
const frogNightcap = a => {                               // 歪戴在左眼包上
  a.r(6, 3, 11, 2, C.capD); a.r(7, 1, 9, 2, C.cap); a.r(9, 0, 6, 1, C.cap);
  a.blob(13, 0, 4, 3, C.y, 1);
};
F('frog-idle',  [frogParts, frogLeaf]);
F('frog-leaf',  [frogParts, frogLeaf]);
F('frog-puff',  [frogParts, frogPuff, frogLeaf]);
F('frog-blush', [frogParts, frogLeaf, a => { a.r(6, 14, 4, 2, C.p); a.r(22, 14, 4, 2, C.p); }]);
F('frog-sleep', [frogSleep, frogNightcap, zzz]);

/* —— 猫头鹰 —— */
const owlHappyEyes = a => {
  a.blob(7, 7, 9, 9, C.w, 3); a.blob(16, 7, 9, 9, C.w, 3);
  a.set(8, 11, C.k); a.r(9, 10, 4, 1, C.k); a.set(13, 11, C.k);
  a.set(17, 11, C.k); a.r(18, 10, 4, 1, C.k); a.set(22, 11, C.k);
};
F('owl-idle',  [owlParts]);
F('owl-blink', [owlEyesShut]);
F('owl-night', [owlEyesShut, zzz]);
F('owl-happy', [owlParts, owlHappyEyes]);
F('owl-blush', [owlParts, a => { a.r(8, 14, 4, 2, C.p); a.r(21, 14, 4, 2, C.p); }]);

/* —— 仓鼠 —— */
F('hamster-idle', [hamsterParts, hamsterFace, hamsterFeet]);
F('hamster-run',  [hamsterParts, hamsterFace, hamsterRunFeet,
                   a => { a.r(0, 15, 3, 1, '#90a4ae'); a.r(1, 20, 3, 1, '#90a4ae'); }]);
F('hamster-sleep',[hamsterParts, eyesShut(10, 18, 10), a => a.r(15, 15, 2, 1, C.p),
                   hamsterFeet, nightcap(7), zzz]);

/* —— 小鸟 —— */
const birdCloseEyes = a => {
  a.r(12, 7, 3, 3, P.bird.m); a.r(17, 7, 3, 3, P.bird.m); // 盖住眼睛
  a.r(12, 8, 3, 1, C.k); a.r(17, 8, 3, 1, C.k);           // 闭眼
};
const birdOpenBeak = a => {
  a.r(21, 10, 4, 3, '#ef5350');                           // 张开的嘴
  a.r(21, 9, 4, 1, C.beak); a.r(21, 13, 4, 1, C.beak);
};
F('bird-idle',  [birdBody]);
F('bird-fly',   [birdFly]);
F('bird-chirp', [birdBody, birdOpenBeak]);
F('bird-spin',  [birdFly, birdOpenBeak]);
F('bird-sleep', [birdBody, birdCloseEyes, nightcap(6), zzz]);

/* —— 天气装备 —— */
F('wx-sun',  [catHead, wxSunGlasses, mouthW(16, 18), blush(8, 21, 16),
              catBody, catTailLow], [catWhiskers]);
F('wx-rain', [catHead, wxLeafUmbrella, catBody, catTailLow, catFace], [catWhiskers]);
F('wx-dusk', [catHead, catBody, wxScarf, catTailLow, catFace], [catWhiskers]);

/* —— 图标 —— */
F('sun', [ICONS.sun]); F('moon', [ICONS.moon]); F('paw', [ICONS.paw]);
F('search', [ICONS.search]); F('heart', [ICONS.heart]); F('hash', [ICONS.hash]);

/* —— 春日装饰 —— */
F('butterfly-a', [DECOR['butterfly-a']]);
F('butterfly-b', [DECOR['butterfly-b']]);
F('bee-a', [DECOR['bee-a']]);
F('bee-b', [DECOR['bee-b']]);
F('cloud-s', [DECOR['cloud-s']]);
F('cloud-m', [DECOR['cloud-m']]);
F('cloud-l', [DECOR['cloud-l']]);
F('willow', [DECOR.willow]);
F('tuft', [DECOR.tuft]);
F('daisy', [DECOR.daisy]);
F('tulip-pink',   [DECOR.tulip('#f48fb1')]);
F('tulip-red',    [DECOR.tulip('#ef5350')]);
F('tulip-yellow', [DECOR.tulip('#ffd54f')]);
F('dandelion', [DECOR.dandelion]);
F('mushroom', [DECOR.mushroom]);
F('f-white',   [DECOR.mini('#ffffff', '#ffd54f')]);
F('f-pink',    [DECOR.mini('#f8bbd0', '#ffe082')]);
F('f-yellow',  [DECOR.mini('#ffe082', '#ffb74d')]);
F('f-purple',  [DECOR.mini('#ce93d8', '#fff59d')]);

/* ============================================================
 *  输出 CSS（每个逻辑像素 = 2px x 2px 实心方块）
 * ============================================================ */
function toCss(name, m) {
  const shadows = [];
  let bg = 'transparent';
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = m.get(y * W + x);
      if (!c) continue;
      if (x === 0 && y === 0) { bg = c; continue; }   // (0,0) 会被元素底盒裁掉，用背景色补
      shadows.push(`${x * 2}px ${y * 2}px 0 0 ${c}`);
    }
  }
  if (!shadows.length) return '';
  return `.s-${name}{background:${bg};box-shadow:${shadows.join(',')};}`;
}

let css = Object.keys(frames).map(n => toCss(n, frames[n])).filter(Boolean).join('\n');
const names = Object.keys(frames);

const htmlPath = path.join(__dirname, '..', 'index.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const START = '/*__SPRITES_START__*/';
  const END = '/*__SPRITES_END__*/';
  const i = html.indexOf(START), j = html.indexOf(END);
  if (i >= 0 && j > i) {
    const out = html.slice(0, i + START.length) + '\n' + css + '\n' + html.slice(j);
    fs.writeFileSync(htmlPath, out, 'utf8');
    console.log(`注入 ${names.length} 个帧 -> index.html (${css.length} bytes)`);
  } else {
    console.log('index.html 缺少标记，仅输出 tools/sprites.css');
  }
} else {
  console.log('index.html 不存在，仅输出 tools/sprites.css');
}
fs.writeFileSync(path.join(__dirname, 'sprites.css'), css, 'utf8');

/* ---------- 检查用大图页：tools/sheet.html ---------- */
const sheet = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>精灵帧检查表 · ${names.length} 帧</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#e8f5e9;font:14px/1.4 "Microsoft YaHei",sans-serif;color:#37474f;padding:16px}
h1{font-size:18px;margin-bottom:12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.cell{background:rgba(255,255,255,.85);border:2px solid #5d8a6a;padding:8px;text-align:center}
.spr{--s:2;position:relative;display:inline-block;vertical-align:middle;
  width:calc(var(--s)*64px);height:calc(var(--s)*64px);
  background-image:linear-gradient(45deg,#dfe8df 25%,transparent 25%,transparent 75%,#dfe8df 75%),
  linear-gradient(45deg,#dfe8df 25%,transparent 25%,transparent 75%,#dfe8df 75%);
  background-size:16px 16px;background-position:0 0,8px 8px}
.spr>i{position:absolute;left:0;top:0;width:2px;height:2px;
  transform:scale(var(--s));transform-origin:0 0}
b{display:block;margin-top:6px;font-size:12px;font-weight:600}
</style></head><body>
<h1>32x32 像素帧检查表（共 ${names.length} 帧，每格 128px = 2px/像素 × 4 缩放用于检查细节）</h1>
<div class="grid">
${names.map(n => `<div class="cell"><span class="spr"><i class="s-${n}"></i></span><b>${n}</b></div>`).join('\n')}
</div>
<style>${css}</style>
</body></html>`;
fs.writeFileSync(path.join(__dirname, 'sheet.html'), sheet, 'utf8');
console.log('帧列表:', names.join(', '));






