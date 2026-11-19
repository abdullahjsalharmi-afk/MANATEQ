/* Manateq One — sketch kit (requires rough.js loaded first).
   Every element with a data-sk attribute gets a hand-drawn outline; .note[data-to] gets a hand-drawn arrow.
   Drawing is seeded, so the same HTML always produces the same sketch. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var C = { ink: '#2a2624', pencil: '#77706a', faint: '#b9b1a6', accent: '#862633', gold: '#a98b3c', hl: '#f7e39a', ok: '#2e7d4f', paper: '#fbf8f1' };

  var ICONS = {
    home: 'M3 11 L12 3 L21 11 M5.5 10 V20 H18.5 V10 M10 20 V14 H14 V20',
    grid: 'M4 4 H10 V10 H4 Z M14 4 H20 V10 H14 Z M4 14 H10 V20 H4 Z M14 14 H20 V20 H14 Z',
    list: 'M4 6 H20 M4 12 H20 M4 18 H14',
    pin: 'M12 21 C7 15 5 12 5 9 A7 7 0 0 1 19 9 C19 12 17 15 12 21 Z M9.5 9 a2.5 2.5 0 1 0 5 0 a2.5 2.5 0 1 0 -5 0',
    user: 'M8 8 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M4 21 C4 16.5 8 14.5 12 14.5 C16 14.5 20 16.5 20 21',
    bell: 'M6 17 V11 A6 6 0 0 1 18 11 V17 L20 19 H4 Z M10 21.5 H14',
    search: 'M5 11 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 M15.5 15.5 L21 21',
    camera: 'M4 8 H8 L10 5 H14 L16 8 H20 V19 H4 Z M8.5 13.5 a3.5 3.5 0 1 0 7 0 a3.5 3.5 0 1 0 -7 0',
    doc: 'M6 3 H14 L19 8 V21 H6 Z M14 3 V8 H19 M9 13 H16 M9 17 H14',
    card: 'M3 6 H21 V18 H3 Z M3 10 H21 M6 15 H10',
    key: 'M4 15 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M11 12 L20 3.5 M16.5 7 L19 9.5',
    check: 'M4 12.5 L10 18 L20 6',
    cross: 'M6 6 L18 18 M18 6 L6 18',
    back: 'M9 6 L15 12 L9 18',
    fwd: 'M15 6 L9 12 L15 18',
    plus: 'M12 5 V19 M5 12 H19',
    wrench: 'M5 19 L13.5 10.5 M13.5 10.5 A4.5 4.5 0 1 1 19 5 L16 8 L17 10 L13.5 10.5',
    shield: 'M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z M8.5 12 L11 14.5 L15.5 9.5',
    clock: 'M4 12 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M12 7 V12 L15.5 14',
    chat: 'M4 5 H20 V16 H12 L7 20 V16 H4 Z',
    pen: 'M4 20 L8 19 L19 8 L16 5 L5 16 Z M14 7 L17 10',
    factory: 'M3 21 V11 L9 14 V11 L15 14 V6 H20 V21 Z M7 17.5 H9 M12 17.5 H14',
    truck: 'M2 7 H14 V17 H2 Z M14 10 H19 L22 13 V17 H14 M5 17 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 M15 17 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0',
    globe: 'M4 12 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M4 12 H20 M12 4 C8 8 8 16 12 20 M12 4 C16 8 16 16 12 20',
    bolt: 'M13 3 L5 14 H11 L10 21 L19 9 H13 Z',
    star: 'M12 3 L14.6 9 L21 9.6 L16.2 13.9 L17.7 20.3 L12 17 L6.3 20.3 L7.8 13.9 L3 9.6 L9.4 9 Z',
    mic: 'M9 5 a3 3 0 0 1 6 0 V11 a3 3 0 0 1 -6 0 Z M6 11 a6 6 0 0 0 12 0 M12 17 V21',
    upload: 'M12 16 V4 M7 9 L12 4 L17 9 M4 20 H20',
    alert: 'M12 3 L22 20 H2 Z M12 9 V14 M12 17 V17.5',
    wallet: 'M3 7 H19 V19 H3 Z M3 7 L15 3 V7 M15 13 H19',
    calendar: 'M4 6 H20 V20 H4 Z M4 10 H20 M8 3 V7 M16 3 V7',
    phone: 'M6 3 H10 L11 8 L8.5 9.5 C9.5 12 12 14.5 14.5 15.5 L16 13 L21 14 V18 C21 20 19 21 17 21 C10 20 4 14 3 7 C3 5 4 3 6 3 Z',
    layers: 'M12 3 L21 8 L12 13 L3 8 Z M3 12 L12 17 L21 12 M3 16 L12 21 L21 16',
    spark: 'M12 3 V9 M12 15 V21 M3 12 H9 M15 12 H21 M6 6 L9 9 M15 15 L18 18 M18 6 L15 9 M9 15 L6 18',
    lock: 'M6 11 H18 V21 H6 Z M8.5 11 V7.5 a3.5 3.5 0 0 1 7 0 V11',
    eye: 'M2 12 C6 5 18 5 22 12 C18 19 6 19 2 12 Z M9.5 12 a2.5 2.5 0 1 0 5 0 a2.5 2.5 0 1 0 -5 0'
  };

  // A schematic outline of the Qatar peninsula in a 100 x 170 box (not to scale).
  var QATAR = 'M50 4 C56 6 60 16 62 26 C64 36 70 40 69 50 C68 58 74 66 75 78 C76 88 72 96 72 106 C72 114 68 120 64 126 C60 130 56 128 55 134 C54 142 48 152 42 160 L24 150 C22 140 18 134 19 124 C20 112 14 106 15 94 C16 86 24 84 22 76 C20 70 18 66 20 58 C22 46 26 38 30 28 C34 18 42 6 50 4 Z';

  function hashSeed(str) { var h = 7; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 2147483000; return h + 1; }

  function drawBoard(board, bi) {
    var old = board.querySelectorAll('svg.sk-layer'); for (var o = 0; o < old.length; o++) old[o].remove();
    var under = document.createElementNS(NS, 'svg'); under.setAttribute('class', 'sk-layer sk-under');
    var over = document.createElementNS(NS, 'svg'); over.setAttribute('class', 'sk-layer sk-over');
    board.insertBefore(under, board.firstChild); board.appendChild(over);
    var rcU = rough.svg(under), rcO = rough.svg(over);
    var B = board.getBoundingClientRect();
    var counter = 0;
    function box(el) { var r = el.getBoundingClientRect(); return { x: r.left - B.left, y: r.top - B.top, w: r.width, h: r.height, cx: r.left - B.left + r.width / 2, cy: r.top - B.top + r.height / 2 }; }
    function opts(extra) { counter++; var base = { roughness: 1.15, bowing: 1.3, stroke: C.ink, strokeWidth: 1.35, seed: hashSeed((board.id || 'b' + bi) + ':' + counter) }; for (var k in extra) base[k] = extra[k]; return base; }
    function rrect(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); return 'M' + (x + r) + ' ' + y + ' H' + (x + w - r) + ' Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + ' V' + (y + h - r) + ' Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - r) + ' ' + (y + h) + ' H' + (x + r) + ' Q' + x + ' ' + (y + h) + ' ' + x + ' ' + (y + h - r) + ' V' + (y + r) + ' Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + ' Z'; }
    // `layer` is one of the two rough.js instances; each draws into its own <svg> (under = fills, over = strokes).
    function add(layer, node) { (layer === rcU ? under : over).appendChild(node); return node; }
    function icon(layer, rc, name, b, color, sw) {
      var d = ICONS[name]; if (!d) return;
      var s = Math.min(b.w, b.h) / 24;
      var g = rc.path(d, opts({ stroke: color || C.ink, strokeWidth: (sw || 1.5) / s, roughness: 0.55, bowing: 0.6 }));
      g.setAttribute('transform', 'translate(' + (b.cx - 12 * s) + ' ' + (b.cy - 12 * s) + ') scale(' + s + ')');
      add(layer, g);
    }

    var els = board.querySelectorAll('[data-sk]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], kind = el.getAttribute('data-sk'), b = box(el), v, n, k, p;
      if (b.w < 1 || b.h < 1) continue;
      switch (kind) {
        case 'phone':
          add(rcO, rcO.path(rrect(b.x, b.y, b.w, b.h, 36), opts({ strokeWidth: 2.3, roughness: 0.9 })));
          add(rcO, rcO.path(rrect(b.x + 3.5, b.y + 4.5, b.w, b.h, 36), opts({ strokeWidth: 0.9, stroke: C.faint, roughness: 1.4 })));
          add(rcO, rcO.path(rrect(b.cx - 36, b.y + 12, 72, 15, 8), opts({ strokeWidth: 1.2, roughness: 0.7, fill: C.ink, fillStyle: 'solid' })));
          break;
        case 'card': add(rcO, rcO.path(rrect(b.x, b.y, b.w, b.h, 13), opts({ stroke: C.pencil }))); break;
        case 'card-a': add(rcO, rcO.path(rrect(b.x, b.y, b.w, b.h, 13), opts({ stroke: C.accent, strokeWidth: 1.6 }))); break;
        case 'card-fill':
          add(rcU, rcU.path(rrect(b.x, b.y, b.w, b.h, 13), opts({ stroke: 'none', fill: 'rgba(134,38,51,0.10)', fillStyle: 'solid', roughness: 0.6 })));
          add(rcO, rcO.path(rrect(b.x, b.y, b.w, b.h, 13), opts({ stroke: C.accent, strokeWidth: 1.5 })));
          break;
        case 'card-dash': add(rcO, rcO.path(rrect(b.x, b.y, b.w, b.h, 13), opts({ stroke: C.pencil, strokeLineDash: [6, 6] }))); break;
        case 'box': add(rcO, rcO.rectangle(b.x, b.y, b.w, b.h, opts({ stroke: C.pencil }))); break;
        case 'btn':
          add(rcU, rcU.path(rrect(b.x, b.y, b.w, b.h, 12), opts({ stroke: C.accent, strokeWidth: 1.4, fill: C.accent, fillStyle: 'solid', roughness: 0.8 })));
          break;
        case 'btn-ink':
          add(rcU, rcU.path(rrect(b.x, b.y, b.w, b.h, 12), opts({ stroke: C.ink, strokeWidth: 1.4, fill: C.ink, fillStyle: 'solid', roughness: 0.8 })));
          break;
        case 'btn2': add(rcO, rcO.path(rrect(b.x, b.y, b.w, b.h, 12), opts({ stroke: C.accent, strokeWidth: 1.5 }))); break;
        case 'chip': add(rcO, rcO.path(rrect(b.x, b.y, b.w, b.h, 13), opts({ stroke: C.pencil, strokeWidth: 1.1 }))); break;
        case 'chip-on': add(rcU, rcU.path(rrect(b.x, b.y, b.w, b.h, 13), opts({ stroke: C.ink, fill: C.ink, fillStyle: 'solid', roughness: 0.7 }))); break;
        case 'chip-a': add(rcU, rcU.path(rrect(b.x, b.y, b.w, b.h, 13), opts({ stroke: C.accent, fill: C.accent, fillStyle: 'solid', roughness: 0.7 }))); break;
        case 'badge': add(rcU, rcU.ellipse(b.cx, b.cy, b.w + 3, b.h + 3, opts({ stroke: C.accent, fill: C.accent, fillStyle: 'solid', roughness: 0.6 }))); break;
        case 'circle': add(rcO, rcO.ellipse(b.cx, b.cy, b.w, b.h, opts({ stroke: el.classList.contains('n') || el.classList.contains('board-no') ? C.accent : C.pencil, strokeWidth: el.classList.contains('board-no') ? 1.9 : 1.3 }))); break;
        case 'circle-fill':
          add(rcU, rcU.ellipse(b.cx, b.cy, b.w, b.h, opts({ stroke: C.accent, fill: 'rgba(134,38,51,0.14)', fillStyle: 'solid', roughness: 0.7 })));
          break;
        case 'img':
          add(rcO, rcO.path(rrect(b.x, b.y, b.w, b.h, 10), opts({ stroke: C.pencil })));
          add(rcO, rcO.line(b.x + 6, b.y + 6, b.x + b.w - 6, b.y + b.h - 6, opts({ stroke: C.faint, strokeWidth: 1 })));
          add(rcO, rcO.line(b.x + b.w - 6, b.y + 6, b.x + 6, b.y + b.h - 6, opts({ stroke: C.faint, strokeWidth: 1 })));
          break;
        case 'hatch':
          add(rcU, rcU.path(rrect(b.x, b.y, b.w, b.h, 10), opts({ stroke: C.pencil, fill: C.faint, fillStyle: 'hachure', hachureGap: 7, fillWeight: 0.7 })));
          break;
        case 'lines':
          n = parseInt(el.getAttribute('data-n') || '3', 10);
          for (k = 0; k < n; k++) {
            var yy = b.y + (b.h / n) * (k + 0.5), ww = b.w * (k === n - 1 && n > 1 ? 0.58 : (k % 2 ? 0.93 : 1));
            var rtl = getComputedStyle(el).direction === 'rtl';
            var x1 = rtl ? b.x + b.w - ww : b.x, x2 = rtl ? b.x + b.w : b.x + ww;
            add(rcO, rcO.line(x1, yy, x2, yy, opts({ stroke: C.faint, strokeWidth: 2.4, roughness: 0.9, bowing: 2.2 })));
          }
          break;
        case 'hr': add(rcO, rcO.line(b.x, b.y + b.h, b.x + b.w, b.y + b.h, opts({ stroke: C.faint, strokeWidth: 1 }))); break;
        case 'sep': add(rcO, rcO.line(b.x, b.cy, b.x + b.w, b.cy, opts({ stroke: C.faint, strokeWidth: 1 }))); break;
        case 'row': add(rcO, rcO.line(b.x, b.y + b.h, b.x + b.w, b.y + b.h, opts({ stroke: C.faint, strokeWidth: 0.9, roughness: 0.8 }))); break;
        case 'underline': add(rcO, rcO.line(b.x - 2, b.y + b.h + 1, b.x + b.w + 2, b.y + b.h + 2, opts({ stroke: C.accent, strokeWidth: 2, bowing: 2.5 }))); break;
        case 'hl': add(rcU, rcU.rectangle(b.x - 4, b.y + b.h * 0.18, b.w + 8, b.h * 0.74, opts({ stroke: 'none', fill: C.hl, fillStyle: 'solid', roughness: 1.6 }))); break;
        case 'strike': add(rcO, rcO.line(b.x - 2, b.cy, b.x + b.w + 2, b.cy + 1, opts({ stroke: C.pencil, strokeWidth: 1.4 }))); break;
        case 'field': add(rcO, rcO.path(rrect(b.x, b.y, b.w, b.h, 9), opts({ stroke: C.pencil, strokeWidth: 1.1 }))); break;
        case 'field-a': add(rcO, rcO.path(rrect(b.x, b.y, b.w, b.h, 9), opts({ stroke: C.accent, strokeWidth: 1.6 }))); break;
        case 'progress':
          v = Math.max(0, Math.min(1, parseFloat(el.getAttribute('data-v') || '0.5')));
          add(rcO, rcO.path(rrect(b.x, b.y, b.w, b.h, b.h / 2), opts({ stroke: C.pencil, strokeWidth: 1 })));
          if (v > 0) {
            var rtl2 = getComputedStyle(el).direction === 'rtl', fw = b.w * v;
            add(rcU, rcU.path(rrect(rtl2 ? b.x + b.w - fw : b.x, b.y, fw, b.h, b.h / 2), opts({ stroke: 'none', fill: el.getAttribute('data-c') === 'ok' ? C.ok : C.accent, fillStyle: 'solid', roughness: 0.5 })));
          }
          break;
        case 'step':
          add(rcU, rcU.path(rrect(b.x, b.y, b.w, b.h, b.h / 2), opts({ stroke: 'none', fill: el.classList.contains('on') ? C.accent : C.faint, fillStyle: 'solid', roughness: 0.5 })));
          break;
        case 'ring':
          v = Math.max(0, Math.min(1, parseFloat(el.getAttribute('data-v') || '0.5')));
          add(rcO, rcO.ellipse(b.cx, b.cy, b.w, b.h, opts({ stroke: C.faint, strokeWidth: 3, roughness: 0.6 })));
          add(rcO, rcO.arc(b.cx, b.cy, b.w, b.h, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v, false, opts({ stroke: C.accent, strokeWidth: 3.4, roughness: 0.6 })));
          break;
        case 'toggle':
          add(rcU, rcU.path(rrect(b.x, b.y, b.w, b.h, b.h / 2), opts({ stroke: C.accent, fill: el.classList.contains('off') ? 'none' : C.accent, fillStyle: 'solid', roughness: 0.6 })));
          add(rcO, rcO.ellipse(el.classList.contains('off') ? b.x + b.w - b.h / 2 : b.x + b.h / 2, b.cy, b.h - 6, b.h - 6, opts({ stroke: C.ink, fill: C.paper, fillStyle: 'solid', roughness: 0.5 })));
          break;
        case 'grip': add(rcU, rcU.path(rrect(b.x, b.y, b.w, b.h, 3), opts({ stroke: 'none', fill: C.faint, fillStyle: 'solid', roughness: 0.4 }))); break;
        case 'sheet':
          add(rcO, rcO.path('M' + b.x + ' ' + (b.y + b.h) + ' V' + (b.y + 20) + ' Q' + b.x + ' ' + b.y + ' ' + (b.x + 20) + ' ' + b.y + ' H' + (b.x + b.w - 20) + ' Q' + (b.x + b.w) + ' ' + b.y + ' ' + (b.x + b.w) + ' ' + (b.y + 20) + ' V' + (b.y + b.h), opts({ strokeWidth: 1.7 })));
          break;
        case 'tabbar': add(rcO, rcO.line(b.x, b.y, b.x + b.w, b.y, opts({ stroke: C.pencil, strokeWidth: 1.1 }))); break;
        case 'icon': icon(rcO, rcO, el.getAttribute('data-icon'), b, el.getAttribute('data-c') === 'a' || (el.closest && el.closest('.on, .t-a')) ? C.accent : (el.getAttribute('data-c') === 'w' ? '#fff' : (el.getAttribute('data-c') === 'p' ? C.pencil : C.ink))); break;
        case 'check': icon(rcO, rcO, 'check', b, C.ok, 2.2); break;
        case 'qr':
          add(rcO, rcO.rectangle(b.x, b.y, b.w, b.h, opts({ stroke: C.ink, strokeWidth: 1.2 })));
          var cells = 9, cs = (b.w - 12) / cells, seed = hashSeed(board.id + 'qr');
          for (var qy = 0; qy < cells; qy++) for (var qx = 0; qx < cells; qx++) {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            var corner = (qx < 3 && qy < 3) || (qx > 5 && qy < 3) || (qx < 3 && qy > 5);
            var on = corner ? (qx % 6 === 0 || qy % 6 === 0 || qx === 2 || qy === 2 || qx === 8 || qy === 8 || (qx % 6 === 1 && qy % 6 === 1) || (qx === 7 && qy === 1) || (qx === 1 && qy === 7)) : seed % 100 < 46;
            if (on) add(rcU, rcU.rectangle(b.x + 6 + qx * cs + 1, b.y + 6 + qy * cs + 1, cs - 2, cs - 2, opts({ stroke: 'none', fill: C.ink, fillStyle: 'solid', roughness: 0.5 })));
          }
          break;
        case 'map':
          var s = Math.min(b.w / 100, b.h / 170) * 0.96, ox = b.cx - 50 * s, oy = b.cy - 85 * s;
          var g = rcO.path(QATAR, opts({ stroke: C.pencil, strokeWidth: 1.4 / s, fill: C.faint, fillStyle: 'hachure', hachureGap: 9 / s, fillWeight: 0.5 / s, roughness: 1.3 }));
          g.setAttribute('transform', 'translate(' + ox + ' ' + oy + ') scale(' + s + ')'); add(rcO, g);
          var pins = [[67, 112], [57, 104], [31, 128], [63, 44], [60, 97], [68, 91], [52, 60], [62, 108], [64, 98], [56, 76], [55, 63], [58, 53], [61, 57]];
          n = parseInt(el.getAttribute('data-pins') || '13', 10);
          var hot = parseInt(el.getAttribute('data-hot') || '-1', 10);
          for (k = 0; k < Math.min(n, pins.length); k++) {
            p = pins[k];
            add(rcO, rcO.circle(ox + p[0] * s, oy + p[1] * s, k === hot ? 15 : 8.5, opts({ stroke: C.accent, fill: C.accent, fillStyle: 'solid', roughness: 0.5, strokeWidth: 1 })));
          }
          break;
        case 'plots':
          var cols = parseInt(el.getAttribute('data-cols') || '6', 10), rows = parseInt(el.getAttribute('data-rows') || '4', 10), gw = b.w / cols, gh = b.h / rows, sd = hashSeed(board.id + 'plots'), sel = el.getAttribute('data-sel') || '2,1';
          for (var py = 0; py < rows; py++) for (var px = 0; px < cols; px++) {
            sd = (sd * 1103515245 + 12345) % 2147483648;
            var isSel = (px + ',' + py) === sel, free = sd % 100 < 34;
            add(isSel || !free ? rcU : rcO, (isSel || !free ? rcU : rcO).rectangle(b.x + px * gw + 2.5, b.y + py * gh + 2.5, gw - 5, gh - 5, opts({ stroke: isSel ? C.accent : C.pencil, strokeWidth: isSel ? 1.8 : 0.9, fill: isSel ? C.accent : (free ? 'none' : C.faint), fillStyle: isSel ? 'solid' : 'hachure', hachureGap: 5, fillWeight: 0.6, roughness: 0.8 })));
          }
          break;
        case 'bars':
          var vals = (el.getAttribute('data-v') || '0.4,0.7,0.5,0.9,0.6').split(','), bw = b.w / vals.length;
          for (k = 0; k < vals.length; k++) { var bh = b.h * parseFloat(vals[k]); add(rcU, rcU.rectangle(b.x + k * bw + 4, b.y + b.h - bh, bw - 8, bh, opts({ stroke: C.pencil, fill: k === vals.length - 1 ? C.accent : C.faint, fillStyle: 'hachure', hachureGap: 4, roughness: 0.8 }))); }
          add(rcO, rcO.line(b.x, b.y + b.h, b.x + b.w, b.y + b.h, opts({ stroke: C.pencil })));
          break;
        case 'arrow-l': arrow(b.x + b.w, b.cy, b.x, b.cy, C.pencil, 0.12); break;
        case 'arrow-r': arrow(b.x, b.cy, b.x + b.w, b.cy, C.pencil, 0.12); break;
        case 'arrow-d': arrow(b.cx, b.y, b.cx, b.y + b.h, C.pencil, 0.1); break;
        case 'signature':
          add(rcO, rcO.curve([[b.x + 6, b.cy + 6], [b.x + b.w * 0.18, b.y + 4], [b.x + b.w * 0.3, b.y + b.h - 4], [b.x + b.w * 0.45, b.cy - 6], [b.x + b.w * 0.6, b.y + b.h - 8], [b.x + b.w * 0.75, b.cy - 2], [b.x + b.w - 8, b.cy + 4]], opts({ stroke: C.accent, strokeWidth: 1.8, roughness: 0.6 })));
          add(rcO, rcO.line(b.x, b.y + b.h, b.x + b.w, b.y + b.h, opts({ stroke: C.pencil, strokeWidth: 1 })));
          break;
      }
    }

    // timelines: dots + connectors
    var tls = board.querySelectorAll('.w-tl');
    for (var t = 0; t < tls.length; t++) {
      var items = tls[t].children, prev = null, rtlT = getComputedStyle(tls[t]).direction === 'rtl';
      for (var j = 0; j < items.length; j++) {
        var ib = box(items[j]), dx = rtlT ? ib.x + ib.w - 10 : ib.x + 10, dy = ib.y + 9, cls = items[j].className;
        if (prev) add(rcO, rcO.line(prev[0], prev[1] + 8, dx, dy - 8, opts({ stroke: cls.indexOf('todo') >= 0 ? C.faint : C.ink, strokeWidth: 1.2, strokeLineDash: cls.indexOf('todo') >= 0 ? [4, 5] : undefined })));
        if (cls.indexOf('done') >= 0) add(rcU, rcU.circle(dx, dy, 13, opts({ stroke: C.ink, fill: C.ink, fillStyle: 'solid', roughness: 0.6 })));
        else if (cls.indexOf('now') >= 0) { add(rcU, rcU.circle(dx, dy, 13, opts({ stroke: C.accent, fill: C.accent, fillStyle: 'solid', roughness: 0.6 }))); add(rcO, rcO.circle(dx, dy, 22, opts({ stroke: C.accent, strokeWidth: 1 }))); }
        else add(rcO, rcO.circle(dx, dy, 13, opts({ stroke: C.faint, strokeWidth: 1.3 })));
        prev = [dx, dy];
      }
    }

    // annotation arrows
    function arrow(x1, y1, x2, y2, color, bend) {
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx2 = x2 - x1, dy2 = y2 - y1, len = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
      var cx = mx - dy2 * (bend === undefined ? 0.18 : bend), cy = my + dx2 * (bend === undefined ? 0.18 : bend);
      add(rcO, rcO.path('M' + x1 + ' ' + y1 + ' Q' + cx + ' ' + cy + ' ' + x2 + ' ' + y2, opts({ stroke: color, strokeWidth: 1.5, roughness: 0.7, bowing: 0.5 })));
      var ang = Math.atan2(y2 - cy, x2 - cx), a1 = ang + Math.PI * 0.84, a2 = ang - Math.PI * 0.84, hl = Math.min(13, len * 0.3);
      add(rcO, rcO.line(x2, y2, x2 + Math.cos(a1) * hl, y2 + Math.sin(a1) * hl, opts({ stroke: color, strokeWidth: 1.6, roughness: 0.5 })));
      add(rcO, rcO.line(x2, y2, x2 + Math.cos(a2) * hl, y2 + Math.sin(a2) * hl, opts({ stroke: color, strokeWidth: 1.6, roughness: 0.5 })));
    }
    var notes = board.querySelectorAll('[data-to]');
    for (var q = 0; q < notes.length; q++) {
      var target = board.querySelector(notes[q].getAttribute('data-to')); if (!target) continue;
      var nb = box(notes[q]), tb = box(target), sx, sy, ex, ey;
      var color = notes[q].classList.contains('ink') ? C.ink : (notes[q].classList.contains('gold') ? C.gold : C.accent);
      // Leave from the side of the note that faces the target and land on the nearest edge of the target,
      // at the height of the note where possible, so arrows stay short and do not cross each other.
      var ny = nb.y + Math.min(nb.h / 2, 15);
      function clampY(y) { return Math.max(tb.y + Math.min(10, tb.h / 2), Math.min(tb.y + tb.h - Math.min(10, tb.h / 2), y)); }
      if (tb.x + tb.w <= nb.x) { sx = nb.x - 8; sy = ny; ex = tb.x + tb.w + 9; ey = clampY(ny); }
      else if (tb.x >= nb.x + nb.w) { sx = nb.x + nb.w + 8; sy = ny; ex = tb.x - 9; ey = clampY(ny); }
      else if (tb.cy > nb.cy) { sx = nb.cx; sy = nb.y + nb.h + 6; ex = tb.cx; ey = tb.y - 9; }
      else { sx = nb.cx; sy = nb.y - 6; ex = tb.cx; ey = tb.y + tb.h + 9; }
      var bendAttr = notes[q].getAttribute('data-bend');
      arrow(sx, sy, ex, ey, color, bendAttr === null ? undefined : parseFloat(bendAttr));
    }
  }

  function drawAll() { var boards = document.querySelectorAll('.board'); for (var i = 0; i < boards.length; i++) drawBoard(boards[i], i); document.documentElement.setAttribute('data-sketch-ready', '1'); }
  function start() { (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { requestAnimationFrame(drawAll); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(drawAll, 150); });
  window.ManateqSketch = { redraw: drawAll, icons: Object.keys(ICONS) };
})();
