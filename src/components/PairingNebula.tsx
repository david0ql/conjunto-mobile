import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * Firma de emparejamiento viva ("particle cloud" estilo Apple Watch).
 * Nebulosa determinista: se re-siembra desde hash(seed + ventana de 10s),
 * así toda la nube muta con cada token (anti-replay) y es única por residente.
 * El código NUNCA se muestra: viaja en los destellos croma (magenta/verde)
 * y en el núcleo de arcos opcional que leerá el escáner del portero.
 */
export function PairingNebula({
  seed,
  showCore = false,
  style,
}: {
  seed: string;
  showCore?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const html = useMemo(() => buildHtml(seed, showCore), [seed, showCore]);

  return (
    <View style={[styles.frame, style]}>
      <WebView
        source={{ html }}
        style={styles.web}
        containerStyle={styles.web}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        javaScriptEnabled
        domStorageEnabled={false}
        allowsLinkPreview={false}
        setSupportMultipleWindows={false}
        androidLayerType="hardware"
      />
    </View>
  );
}

function buildHtml(seed: string, showCore: boolean): string {
  // El motor usa solo concatenación de strings (sin template literals),
  // así el HTML puede inyectarse en este template sin escapes.
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">' +
    '<style>html,body{margin:0;padding:0;background:#000104;overflow:hidden;height:100%}canvas{position:absolute;inset:0;width:100%;height:100%;display:block}</style>' +
    '</head><body><canvas id="c"></canvas><script>' +
    ENGINE_JS.replace('__SEED__', JSON.stringify(seed)).replace('__CORE__', String(showCore)) +
    '</script></body></html>'
  );
}

// ── Motor canvas (validado en el demo web aprobado) ─────────────────────────
// Paleta y dinámica medidas del "particle cloud" clásico del Apple Watch:
// cascarón hueco con limb brightening, turbulencia dominante (~1.6s por rasgo),
// respiración ±5% @3.5s, capa interna contra-rotando, glints croma US9022291.
const ENGINE_JS = `
(function () {
  "use strict";
  var SEED = __SEED__;
  var SHOW_CORE = __CORE__;

  function fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(r) { return (r() + r() + r() + r() + r() - 2.5) / 1.2; }

  var B32 = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  var PERIOD = 10000;
  function counterNow() { return Math.floor(Date.now() / PERIOD); }
  function deriveCode(counter) {
    var r = mulberry32(fnv1a(SEED + ":" + counter));
    var s = "";
    for (var i = 0; i < 6; i++) s += B32[Math.floor(r() * B32.length)];
    return s;
  }

  var COLS = [
    [49, 52, 64], [52, 70, 107], [60, 94, 153], [64, 119, 201],
    [78, 148, 231], [115, 205, 254], [152, 237, 255],
    [197, 95, 201], [63, 191, 127]
  ];
  var FAR = [0, 0, 1, 1, 2, 3, 4, 7, 8];
  function makeSprite(col, soft) {
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d");
    var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    var R = col[0], G = col[1], B = col[2];
    if (soft) {
      gr.addColorStop(0, "rgba(" + R + "," + G + "," + B + ",0.32)");
      gr.addColorStop(0.45, "rgba(" + R + "," + G + "," + B + ",0.12)");
      gr.addColorStop(1, "rgba(" + R + "," + G + "," + B + ",0)");
    } else {
      gr.addColorStop(0, "rgba(" + R + "," + G + "," + B + ",1)");
      gr.addColorStop(0.28, "rgba(" + R + "," + G + "," + B + ",0.55)");
      gr.addColorStop(0.65, "rgba(" + R + "," + G + "," + B + ",0.10)");
      gr.addColorStop(1, "rgba(" + R + "," + G + "," + B + ",0)");
    }
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return c;
  }
  var SHARP = COLS.map(function (c) { return makeSprite(c, false); });
  var SOFT = COLS.map(function (c) { return makeSprite(c, true); });
  function pickColor(r) {
    var x = r();
    if (x < 0.06) return 0;
    if (x < 0.18) return 1;
    if (x < 0.35) return 2;
    if (x < 0.65) return 3;
    if (x < 0.89) return 4;
    if (x < 0.97) return 5;
    return 6;
  }

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var N_DUST = 1500, N_MIST = 150;

  var ri = mulberry32(fnv1a(SEED));
  var dust = [], mist = [];
  for (var i = 0; i < N_DUST; i++) {
    var cr = ri();
    var cls = cr < 0.70 ? 0 : (cr < 0.90 ? 1 : 2);
    var near = pickColor(ri);
    if (cls === 2) near = ri() < 0.6 ? 0 : 1;
    var spark = near >= 5;
    var su = ri();
    var s0 = su < 0.85 ? (0.55 + ri() * 0.55) : (su < 0.97 ? (1.1 + ri() * 0.9) : (2.0 + ri() * 1.2));
    dust.push({
      cls: cls, near: near, far: FAR[near], spark: spark,
      s0: s0, wisp: s0 > 2.0,
      x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, b: 0.6, tb: 0.6,
      lp: ri() * Math.PI * 2, lf: 2.5 + ri() * 2.0,
      p1: ri() * Math.PI * 2, p2: ri() * Math.PI * 2, wf: 0.35 + ri() * 0.8,
      twp: ri() * Math.PI * 2, twf: 5 + ri() * 7,
      gl: spark && ri() < 0.5, glp: ri(), glc: 7
    });
  }
  for (var j = 0; j < N_MIST; j++) {
    var mr = ri();
    mist.push({
      col: mr < 0.15 ? 0 : (mr < 0.55 ? 1 : (mr < 0.9 ? 2 : 3)),
      s0: 0.16 + ri() * 0.18, a0: 0.028 + ri() * 0.03,
      x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0,
      lp: ri() * Math.PI * 2, lf: 1.2 + ri() * 1.2,
      p1: ri() * Math.PI * 2, wf: 0.2 + ri() * 0.4
    });
  }

  var par = { rot: 0.14, trot: 0.14, tilt: 0.32, ttilt: 0.32, nod: 0.07, tnod: 0.07, wob: 0.06, twob: 0.06 };
  var noiseC = [{ a: 2, b: 1, c: 1, p: 0, w: 0.55 }, { a: 4, b: 2, c: 3, p: 1, w: 0.3 }, { a: 7, b: 5, c: 2, p: 2, w: 0.18 }];
  function noiseDir(x, y, z) {
    var v = 0;
    for (var o = 0; o < 3; o++) {
      var c = noiseC[o];
      v += c.w * Math.sin(c.a * x + c.b * y + c.c * z + c.p);
    }
    return v;
  }

  var code = "";
  function reseed(counter, snap) {
    var r = mulberry32(fnv1a(SEED + ":" + counter));
    par.trot = (r() < 0.5 ? -1 : 1) * (0.10 + r() * 0.12);
    par.ttilt = 0.22 + r() * 0.26;
    par.tnod = 0.05 + r() * 0.05;
    par.twob = 0.045 + r() * 0.04;
    var ringR = 0.58 + r() * 0.16, sig = 0.13 + r() * 0.09;
    noiseC = [];
    var fq = [2.3, 4.1, 7.3], wt = [0.55, 0.3, 0.18];
    for (var o = 0; o < 3; o++) {
      var th0 = r() * Math.PI * 2, ph0 = Math.acos(2 * r() - 1), f = fq[o] * (0.8 + r() * 0.5);
      noiseC.push({
        a: Math.sin(ph0) * Math.cos(th0) * f,
        b: Math.cos(ph0) * f,
        c: Math.sin(ph0) * Math.sin(th0) * f,
        p: r() * Math.PI * 2, w: wt[o]
      });
    }
    code = deriveCode(counter);
    for (var i = 0; i < dust.length; i++) {
      var p = dust[i];
      var u = 2 * r() - 1, th = r() * Math.PI * 2, rad = Math.sqrt(Math.max(0, 1 - u * u));
      var dx = rad * Math.cos(th), dy = u, dz = rad * Math.sin(th);
      var rr;
      if (p.cls === 0) rr = ringR + gauss(r) * sig;
      else if (p.cls === 1) rr = 0.92 + Math.abs(gauss(r)) * 0.10;
      else rr = 0.14 + Math.abs(gauss(r)) * 0.22;
      rr = Math.min(1.12, Math.max(0.05, rr));
      p.tx = dx * rr; p.ty = dy * rr; p.tz = dz * rr;
      var cl = noiseDir(dx, dy, dz);
      var b = (p.cls === 2 ? 0.30 : 0.62) + 0.6 * Math.max(0, cl);
      if (p.cls === 1) b *= 0.65;
      p.tb = Math.min(1.25, b);
      if (p.gl) {
        var ch = B32.indexOf(code[i % code.length]);
        p.glc = ((ch >> (i % 5)) & 1) ? 7 : 8;
      }
      if (snap) { p.x = p.tx; p.y = p.ty; p.z = p.tz; p.b = p.tb; }
    }
    for (var m2 = 0; m2 < mist.length; m2++) {
      var m = mist[m2];
      var bx = 0, by = 1, bz = 0, bv = -9;
      for (var k2 = 0; k2 < 3; k2++) {
        var u2 = 2 * r() - 1, th2 = r() * Math.PI * 2, rad2 = Math.sqrt(Math.max(0, 1 - u2 * u2));
        var x2 = rad2 * Math.cos(th2), y2 = u2, z2 = rad2 * Math.sin(th2);
        var v2 = noiseDir(x2, y2, z2);
        if (v2 > bv) { bv = v2; bx = x2; by = y2; bz = z2; }
      }
      var rr2 = Math.max(0.1, ringR * 0.9 + gauss(r) * 0.2);
      m.tx = bx * rr2; m.ty = by * rr2; m.tz = bz * rr2;
      if (snap) { m.x = m.tx; m.y = m.ty; m.z = m.tz; }
    }
    if (snap) { par.rot = par.trot; par.tilt = par.ttilt; par.nod = par.tnod; par.wob = par.twob; }
  }

  var W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.max(1, Math.floor(W * DPR));
    canvas.height = Math.max(1, Math.floor(H * DPR));
  }
  resize();
  window.addEventListener("resize", resize);

  var qual = 1, ema = 16.7, lastT = 0, bad = 0, good = 0;

  function draw(t) {
    var k = 0.055;
    par.rot += (par.trot - par.rot) * k;
    par.tilt += (par.ttilt - par.tilt) * k;
    par.nod += (par.tnod - par.nod) * k;
    par.wob += (par.twob - par.wob) * k;

    var cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.40;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = "#000104";
    ctx.fillRect(0, 0, W, H);

    var breathe = 1 + 0.05 * Math.sin(t * 1.8);
    var scale = 1 + 0.012 * Math.sin(t * 1.5);
    var tiltE = par.tilt + par.nod * Math.sin(t * 0.45);
    var ct = Math.cos(tiltE), st = Math.sin(tiltE);
    var aO = t * par.rot, aI = -t * par.rot * 1.4;
    var cO = Math.cos(aO), sO = Math.sin(aO), cI = Math.cos(aI), sI = Math.sin(aI);

    ctx.globalCompositeOperation = "lighter";

    var nM = Math.floor(mist.length * qual);
    for (var i = 0; i < nM; i++) {
      var m = mist[i];
      m.x += (m.tx - m.x) * k; m.y += (m.ty - m.y) * k; m.z += (m.tz - m.z) * k;
      var innerM = (i % 3 === 0);
      var caM = innerM ? cI : cO, saM = innerM ? sI : sO;
      var wxM = m.x + par.wob * 1.6 * Math.sin(t * m.wf + m.p1);
      var wzM = m.z + par.wob * 1.6 * Math.cos(t * m.wf * 0.8 + m.p1);
      var xM = wxM * caM - wzM * saM, zM = wxM * saM + wzM * caM, yM = m.y;
      var y2M = yM * ct - zM * st, z2M = yM * st + zM * ct;
      var persM = 1 / (1 - z2M * 0.16), dM = Math.max(0, Math.min(1, (z2M + 1.15) / 2.3));
      var sxM = cx + xM * R * persM * scale, syM = cy + y2M * R * persM * scale;
      var lifeM = 0.5 + 0.5 * Math.sin(t * m.lf + m.lp);
      var alphaM = m.a0 * (0.35 + 0.65 * lifeM) * (0.45 + 0.55 * dM) * breathe;
      if (alphaM < 0.004) continue;
      var sizeM = Math.max(6, m.s0 * R * (0.75 + 0.25 * dM) * persM);
      ctx.globalAlpha = alphaM;
      ctx.drawImage(SOFT[dM < 0.4 ? FAR[m.col] : m.col], sxM - sizeM, syM - sizeM, sizeM * 2, sizeM * 2);
    }

    var nD = Math.floor(dust.length * qual);
    for (var n = 0; n < nD; n++) {
      var p = dust[n];
      p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; p.z += (p.tz - p.z) * k; p.b += (p.tb - p.b) * k;
      var inner = (n % 4 === 0);
      var ca = inner ? cI : cO, sa = inner ? sI : sO;
      var wob = par.wob;
      var wx = p.x + wob * Math.sin(t * p.wf + p.p1);
      var wy = p.y + wob * 0.6 * Math.sin(t * p.wf * 1.31 + p.p2);
      var wz = p.z + wob * Math.cos(t * p.wf * 0.77 + p.p1 + p.p2);
      var x = wx * ca - wz * sa, z = wx * sa + wz * ca;
      var y2 = wy * ct - z * st, z2 = wy * st + z * ct;
      var pers = 1 / (1 - z2 * 0.16), d = Math.max(0, Math.min(1, (z2 + 1.15) / 2.3));
      var sx = cx + x * R * pers * scale, sy = cy + y2 * R * pers * scale;
      var life = 0.2 + 0.8 * Math.pow(0.5 + 0.5 * Math.sin(t * p.lf + p.lp), 1.4);
      var dep = 0.4 + 0.6 * d;
      var alpha = p.b * life * dep * dep * breathe;
      if (alpha < 0.008) continue;
      var size = Math.max(0.5, p.s0 * R * 0.012 * (0.7 + 0.3 * d) * pers);
      var idx = d < 0.42 ? p.far : p.near;
      if (p.spark) {
        var flash = Math.max(0, Math.sin(t * p.twf + p.twp));
        alpha = Math.min(1, alpha * (1 + 2.2 * Math.pow(flash, 24)));
        ctx.globalAlpha = alpha * 0.28;
        var hs = size * 3;
        ctx.drawImage(SHARP[idx], sx - hs, sy - hs, hs * 2, hs * 2);
        if (p.gl && ((t * (0.6 + p.glp) + p.glp * 7) % 1) < 0.022) {
          ctx.globalAlpha = Math.min(1, alpha * 1.2);
          var gs = size * 2.2;
          ctx.drawImage(SHARP[p.glc], sx - gs, sy - gs, gs * 2, gs * 2);
        }
      }
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.drawImage(p.wisp ? SOFT[idx] : SHARP[idx], sx - size, sy - size, size * 2, size * 2);
    }
    ctx.globalAlpha = 1;

    if (SHOW_CORE && code) {
      var baseR = R * 0.30;
      ctx.beginPath();
      for (var c2 = 0; c2 < code.length; c2++) {
        var val = B32.indexOf(code[c2]);
        var rr3 = baseR - c2 * (R * 0.038);
        for (var s2 = 0; s2 < 6; s2++) {
          if ((val >> s2) & 1) {
            var a0 = (s2 / 6) * Math.PI * 2 + t * 0.6 * (c2 % 2 ? 1 : -1);
            var a1 = a0 + (Math.PI * 2 / 6) * 0.62;
            ctx.moveTo(cx + Math.cos(a0) * rr3, cy + Math.sin(a0) * rr3);
            ctx.arc(cx, cy, rr3, a0, a1);
          }
        }
      }
      ctx.lineWidth = Math.max(1.2, R * 0.028);
      ctx.strokeStyle = "rgba(152,237,255,0.85)";
      ctx.shadowColor = "rgba(115,205,254,0.9)";
      ctx.shadowBlur = 7;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function loop(nowMs) {
    var t = nowMs / 1000;
    if (lastT) {
      var dt = nowMs - lastT;
      ema = ema * 0.9 + dt * 0.1;
      if (ema > 20) { bad++; good = 0; }
      else { if (bad > 0) bad--; if (ema < 17.5) good++; }
      if (bad > 45 && qual > 0.45) { qual *= 0.85; bad = 20; }
      else if (good > 300 && qual < 1) { qual = Math.min(1, qual / 0.85); good = 0; }
    }
    lastT = nowMs;
    draw(t);
    requestAnimationFrame(loop);
  }

  var lastCounter = counterNow();
  reseed(lastCounter, true);
  setInterval(function () {
    var c = counterNow();
    if (c !== lastCounter) { lastCounter = c; reseed(c, false); }
  }, 250);
  requestAnimationFrame(loop);
})();
`;

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#000104',
    overflow: 'hidden',
  },
  web: {
    flex: 1,
    backgroundColor: '#000104',
  },
});
