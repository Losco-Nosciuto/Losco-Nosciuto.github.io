/* ==========================================================================
   SISTEMA — grafico orbitale in Canvas 2D con griglia spaziotempo deformata.
   Nessuna dipendenza. Proiezione 3D custom, orbite lente, pianeti cliccabili.

   - Il sole è "Who's Chris".
   - I pianeti sono le aree; le lune sono le competenze.
   - La griglia si piega in base alla massa di ogni corpo.
   ========================================================================== */
(function () {
  "use strict";

  var stage = document.querySelector("[data-solar]");
  if (!stage) return;

  var canvas = stage.querySelector(".system-canvas");
  if (!canvas || !canvas.getContext) return;

  var ctx = canvas.getContext("2d");
  var veil = document.querySelector("[data-veil]");
  var hint = stage.querySelector("[data-hint]");

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --- Dati del sistema ---------------------------------------------------
     radius/orbit in unità mondo; mass guida la piega della griglia.
     tone = quanto il colore del pianeta tende al bianco (0 = accento pieno).
     ---------------------------------------------------------------------- */
  var BODIES = [
    {
      id: "chris", label: "Chris", href: "contatti.html",
      kind: "sun", radius: 52, mass: 4.2, orbit: 0, speed: 0, phase: 0, labelAbove: true
    },
    {
      id: "it", label: "PC & Linux", href: "pc-linux.html",
      radius: 28, mass: 1.5, orbit: 165, speed: 0.012, phase: -0.5,
      tone: 0.68, halo: true, moons: ["Linux", "Windows", "Troubleshooting", "System Adaptation"]
    },
    {
      id: "ai", label: "Code & AI", href: "vibe-coding.html",
      radius: 32, mass: 1.7, orbit: 265, speed: 0.009, phase: 2.3,
      tone: 0.48, moons: ["AI Implementation", "Agent Orchestration", "Context Engineering"]
    },
    {
      id: "video", label: "Video", href: "video.html",
      radius: 38, mass: 2.4, orbit: 380, speed: 0.007, phase: 3.7,
      tone: 0.28, moons: ["Premiere Pro", "After Effects", "DaVinci Resolve", "Shooting", "AI Video Gen"]
    },
    {
      id: "3d", label: "3D & MSFS", href: "3d-msfs.html",
      radius: 48, mass: 3.2, orbit: 505, speed: 0.0055, phase: 5.3,
      tone: 0.02, gas: true, moons: ["Blender", "Substance Painter", "Substance Sampler", "MSFS 2024"]
    }
  ];

  var byId = {};
  BODIES.forEach(function (b) { byId[b.id] = b; });

  var labelEls = {};
  stage.querySelectorAll("[data-body]").forEach(function (el) {
    labelEls[el.getAttribute("data-body")] = el;
  });

  /* --- Stato -------------------------------------------------------------- */
  var accent = "#ff7100";
  var accentRgb = "255,113,0";
  var w = 0, h = 0, dpr = 1, focal = 1;
  var baseDist = 1100;
  var sizeBias = 1;

  var cam = {
    yaw: -0.55,
    pitch: 0.9,
    zoom: 1,
    target: { x: 0, y: 0, z: 0 }
  };

  var hovered = null;
  var leaving = false;
  var drag = null;
  var visible = true;
  var raf = null;
  var lastTime = 0;
  var tween = null;
  var hintHidden = false;

  var GRID_HALF = 1000;
  var GRID_DIV = 32;
  var EYE = { x: 0, y: 0, z: 0 };
  var AXIS = { right: null, up: null, fwd: null };

  /* --- Colore ------------------------------------------------------------- */
  function readAccent() {
    var v = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    return v || "#ff7100";
  }

  function hexToRgb(hex) {
    var s = hex.replace("#", "");
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    var n = parseInt(s, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(c) {
    var f = function (v) {
      var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
      return s.length < 2 ? "0" + s : s;
    };
    return "#" + f(c.r) + f(c.g) + f(c.b);
  }

  function mix(a, b, t) {
    var A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex({
      r: A.r + (B.r - A.r) * t,
      g: A.g + (B.g - A.g) * t,
      b: A.b + (B.b - A.b) * t
    });
  }

  function rgba(hex, alpha) {
    var c = hexToRgb(hex);
    return "rgba(" + c.r + "," + c.g + "," + c.b + "," + alpha + ")";
  }

  function applyPalette() {
    accent = readAccent();
    var c = hexToRgb(accent);
    accentRgb = c.r + "," + c.g + "," + c.b;

    BODIES.forEach(function (b) {
      if (b.kind === "sun") {
        b.color = "#f1f1ee";
        b.light = "#ffffff";
        b.dark = "#b9b9b4";
        return;
      }
      b.color = mix(accent, "#ffffff", b.tone);
      b.light = mix(b.color, "#ffffff", 0.45);
      b.dark = mix(b.color, "#000000", 0.35);
    });
  }

  /* --- Griglia e deformazione --------------------------------------------- */
  function warp(x, z) {
    var depth = 0;
    for (var i = 0; i < BODIES.length; i++) {
      var b = BODIES[i];
      var dx = x - b.x;
      var dz = z - b.z;
      depth += (b.mass * 260000) / (dx * dx + dz * dz + 6500);
    }
    return Math.min(depth, 170);
  }

  /* --- Camera e proiezione ------------------------------------------------- */
  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function buildCamera() {
    var dist = baseDist * cam.zoom;
    var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    var cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    var t = cam.target;

    EYE.x = t.x + dist * cp * sy;
    EYE.y = t.y + dist * sp;
    EYE.z = t.z + dist * cp * cy;

    var fx = t.x - EYE.x, fy = t.y - EYE.y, fz = t.z - EYE.z;
    var fl = Math.sqrt(fx * fx + fy * fy + fz * fz) || 1;
    fx /= fl; fy /= fl; fz /= fl;

    // right = fwd × up(0,1,0)
    var rx = fz, ry = 0, rz = -fx;
    var rl = Math.sqrt(rx * rx + rz * rz) || 1;
    rx /= rl; rz /= rl;

    // up = right × fwd
    var ux = ry * fz - rz * fy;
    var uy = rz * fx - rx * fz;
    var uz = rx * fy - ry * fx;

    AXIS.fwd = { x: fx, y: fy, z: fz };
    AXIS.right = { x: rx, y: ry, z: rz };
    AXIS.up = { x: ux, y: uy, z: uz };
  }

  function project(x, y, z) {
    var dx = x - EYE.x, dy = y - EYE.y, dz = z - EYE.z;
    var zc = dx * AXIS.fwd.x + dy * AXIS.fwd.y + dz * AXIS.fwd.z;
    if (zc < 24) return null;
    var xc = dx * AXIS.right.x + dy * AXIS.right.y + dz * AXIS.right.z;
    var yc = dx * AXIS.up.x + dy * AXIS.up.y + dz * AXIS.up.z;
    var s = focal / zc;
    return { x: w / 2 + xc * s, y: h / 2 - yc * s, z: zc, scale: s };
  }

  /* --- Dimensioni ---------------------------------------------------------- */
  function resize() {
    var rect = stage.getBoundingClientRect();
    w = Math.max(320, rect.width);
    h = Math.max(320, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    focal = (h / 2) / Math.tan((25 * Math.PI) / 180);

    // deve entrare l'orbita più esterna + margine per le etichette
    var need = w < 700 ? 660 : 620;
    var fit = need / (Math.tan((25 * Math.PI) / 180) * (w / h));
    baseDist = Math.max(1100, fit);
    sizeBias = w < 700 ? 1.35 : 1;

    stage.classList.add("is-live");
  }

  /* --- Disegno ------------------------------------------------------------- */
  function drawGrid() {
    var step = (GRID_HALF * 2) / GRID_DIV;
    var pts = [];
    var i, j, x, z, p;

    for (i = 0; i <= GRID_DIV; i++) {
      pts[i] = [];
      for (j = 0; j <= GRID_DIV; j++) {
        x = -GRID_HALF + j * step;
        z = -GRID_HALF + i * step;
        p = project(x, -warp(x, z), z);
        pts[i][j] = p;
      }
    }

    ctx.lineWidth = 1;

    // righe
    for (i = 0; i <= GRID_DIV; i++) {
      var zLine = -GRID_HALF + i * step;
      var fade = 1 - Math.pow(Math.min(1, Math.abs(zLine) / GRID_HALF), 1.4);
      var alpha = 0.13 * fade;
      if (alpha < 0.006) continue;
      ctx.strokeStyle = "rgba(255,255,255," + alpha + ")";
      ctx.beginPath();
      var started = false;
      for (j = 0; j <= GRID_DIV; j++) {
        p = pts[i][j];
        if (!p) { started = false; continue; }
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // colonne
    for (j = 0; j <= GRID_DIV; j++) {
      var xLine = -GRID_HALF + j * step;
      var fade2 = 1 - Math.pow(Math.min(1, Math.abs(xLine) / GRID_HALF), 1.4);
      var alpha2 = 0.13 * fade2;
      if (alpha2 < 0.006) continue;
      ctx.strokeStyle = "rgba(255,255,255," + alpha2 + ")";
      ctx.beginPath();
      var started2 = false;
      for (i = 0; i <= GRID_DIV; i++) {
        p = pts[i][j];
        if (!p) { started2 = false; continue; }
        if (!started2) { ctx.moveTo(p.x, p.y); started2 = true; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }

  function orbitPath(b) {
    var segments = 110;
    ctx.beginPath();
    var started = false;
    for (var i = 0; i <= segments; i++) {
      var a = (i / segments) * Math.PI * 2;
      var p = project(Math.cos(a) * b.orbit, 0, Math.sin(a) * b.orbit);
      if (!p) { started = false; continue; }
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
  }

  function drawOrbits() {
    BODIES.forEach(function (b) {
      if (!b.orbit) return;
      var active = hovered === b;
      orbitPath(b);
      ctx.strokeStyle = active ? rgba(accent, 0.5) : "rgba(255,255,255,0.1)";
      ctx.lineWidth = active ? 1.2 : 1;
      ctx.stroke();
    });
  }

  function drawGlow(b, p, r) {
    var g = ctx.createRadialGradient(p.x, p.y, r * 0.5, p.x, p.y, r * 2.15);
    g.addColorStop(0, rgba(b.color, b.kind === "sun" ? 0.26 : 0.17));
    g.addColorStop(0.42, rgba(b.color, 0.07));
    g.addColorStop(1, rgba(b.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.15, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDisc(b, p, r) {
    var grad = ctx.createRadialGradient(
      p.x - r * 0.36, p.y - r * 0.4, r * 0.1,
      p.x, p.y, r
    );
    grad.addColorStop(0, b.light);
    grad.addColorStop(0.55, b.color);
    grad.addColorStop(1, b.dark);

    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawRing(b, p, r, front) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-0.34);
    ctx.scale(1, 0.4);
    ctx.beginPath();
    if (front) ctx.arc(0, 0, r * 1.85, 0, Math.PI);
    else ctx.arc(0, 0, r * 1.85, Math.PI, Math.PI * 2);
    ctx.strokeStyle = front ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.16)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    if (front) ctx.arc(0, 0, r * 2.05, 0, Math.PI);
    else ctx.arc(0, 0, r * 2.05, Math.PI, Math.PI * 2);
    ctx.strokeStyle = front ? rgba(b.color, 0.35) : rgba(b.color, 0.12);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function drawMoons(b) {
    if (!b.moons) return;
    var active = hovered === b;

    b.moons.forEach(function (m) {
      var p = project(m.wx, 0, m.wz);
      if (!p) return;

      if (active) {
        var od = m.dist * p.scale;
        ctx.beginPath();
        ctx.arc(p.x, p.y, od, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.09)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, active ? 2.6 : 2, 0, Math.PI * 2);
      ctx.fillStyle = active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.45)";
      ctx.fill();

      if (active) {
        ctx.font = '10px "Space Grotesk", sans-serif';
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.textAlign = "left";
        ctx.fillText(m.name, p.x + 7, p.y - 6);
      }
    });
  }

  function drawBodies() {
    var sorted = BODIES.map(function (b) {
      var p = project(b.x, 0, b.z);
      return { b: b, p: p };
    }).filter(function (o) { return o.p; });

    sorted.sort(function (a, b) { return b.p.z - a.p.z; });

    sorted.forEach(function (o) {
      var b = o.b, p = o.p;
      var active = hovered === b;
      var r = b.radius * p.scale * sizeBias * (active ? 1.07 : 1);

      if (b.gas) drawRing(b, p, r, false);
      drawGlow(b, p, r);

      if (b.kind === "sun") {
        var g = ctx.createRadialGradient(p.x, p.y, r * 0.2, p.x, p.y, r);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.7, "#f2f2ef");
        g.addColorStop(1, "#cfcfc9");
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        drawDisc(b, p, r);
      }

      if (b.halo) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 1.55, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(b.color, 0.4);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 1.85, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(b.color, 0.14);
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (b.gas) drawRing(b, p, r, true);

      drawMoons(b);
    });
  }

  /* --- Etichette HTML ------------------------------------------------------ */
  function positionLabels() {
    BODIES.forEach(function (b) {
      var el = labelEls[b.id];
      if (!el) return;
      var p = project(b.x, 0, b.z);
      if (!p) { el.style.opacity = "0"; return; }
      var r = b.radius * p.scale * sizeBias;
      var x = p.x;
      var above = !!b.labelAbove;
      var y = above ? Math.max(18, p.y - r - 12) : Math.min(h - 26, p.y + r + 16);
      x = clamp(x, 70, w - 70);
      el.style.opacity = "1";
      el.style.transform = "translate(-50%, " + (above ? "-100%" : "0") + ") translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
      el.classList.toggle("is-active", hovered === b);
    });
  }

  /* --- Animazione ---------------------------------------------------------- */
  function updateBodies(dt) {
    BODIES.forEach(function (b) {
      if (b.kind === "sun") { b.x = 0; b.z = 0; return; }
      var speed = hovered === b ? b.speed * 0.15 : b.speed;
      b.phase += speed * dt;
      b.x = Math.cos(b.phase) * b.orbit;
      b.z = Math.sin(b.phase) * b.orbit;

      if (b.moons) {
        b.moons.forEach(function (m, i) {
          m.phase += m.speed * dt * (hovered === b ? 0.15 : 1);
          m.wx = b.x + Math.cos(m.phase) * m.dist;
          m.wz = b.z + Math.sin(m.phase) * m.dist;
        });
      }
    });
  }

  function updateTween(dt) {
    if (!tween) return;
    tween.t = Math.min(1, tween.t + dt / tween.dur);
    var e = 1 - Math.pow(1 - tween.t, 3);
    cam.target.x = tween.from.x + (tween.to.x - tween.from.x) * e;
    cam.target.z = tween.from.z + (tween.to.z - tween.from.z) * e;
    cam.zoom = tween.from.zoom + (tween.to.zoom - tween.from.zoom) * e;
    if (tween.t >= 1) tween = null;
  }

  function render() {
    ctx.clearRect(0, 0, w, h);
    buildCamera();
    drawGrid();
    drawOrbits();
    drawBodies();
    positionLabels();
  }

  function frame(ts) {
    if (!visible) { raf = null; return; }
    if (!lastTime) lastTime = ts;
    var dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;

    if (!reducedMotion) {
      updateBodies(dt);
      updateTween(dt);
    }

    render();
    raf = window.requestAnimationFrame(frame);
  }

  function start() {
    if (raf || !visible) return;
    lastTime = 0;
    raf = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = null;
  }

  /* --- Interazione --------------------------------------------------------- */
  function hitTest(mx, my) {
    var best = null;
    var bestD = Infinity;
    BODIES.forEach(function (b) {
      var p = project(b.x, 0, b.z);
      if (!p) return;
      var r = b.radius * p.scale * sizeBias;
      var d = Math.hypot(mx - p.x, my - p.y);
      if (d < r + 14 && d < bestD) { best = b; bestD = d; }
    });
    return best;
  }

  function hideHint() {
    if (hintHidden) return;
    hintHidden = true;
    if (hint) hint.classList.add("is-hidden");
  }

  function go(b) {
    if (!b || leaving) return;
    leaving = true;
    hideHint();

    if (reducedMotion || !veil) {
      if (veil) veil.classList.add("is-on");
      window.setTimeout(function () { window.location.href = b.href; }, veil ? 120 : 0);
      return;
    }

    tween = {
      t: 0,
      dur: 0.55,
      from: { x: cam.target.x, z: cam.target.z, zoom: cam.zoom },
      to: { x: b.x, z: b.z, zoom: 0.72 }
    };

    // il velo parte quando lo zoom è già a metà
    window.setTimeout(function () {
      veil.classList.add("is-on");
    }, 300);

    window.setTimeout(function () {
      window.location.href = b.href;
    }, 640);
  }

  canvas.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    drag = {
      x: e.clientX,
      y: e.clientY,
      yaw: cam.yaw,
      pitch: cam.pitch,
      moved: false
    };
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    stage.classList.add("is-dragging");
    hideHint();
  });

  canvas.addEventListener("pointermove", function (e) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;

    if (drag) {
      var dx = e.clientX - drag.x;
      var dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      cam.yaw = drag.yaw - dx * 0.005;
      cam.pitch = clamp(drag.pitch + dy * 0.004, 0.2, 1.38);
      return;
    }

    hovered = hitTest(mx, my);
    stage.classList.toggle("is-hovering", !!hovered);
    Object.keys(labelEls).forEach(function (id) {
      labelEls[id].classList.toggle("is-active", !!hovered && hovered.id === id);
    });
  });

  function endDrag(e) {
    if (!drag) return;
    var wasClick = !drag.moved;
    drag = null;
    stage.classList.remove("is-dragging");

    if (wasClick && e) {
      var rect = canvas.getBoundingClientRect();
      var b = hitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (b) go(b);
    }
  }

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", function () {
    drag = null;
    stage.classList.remove("is-dragging");
  });

  canvas.addEventListener("pointerleave", function () {
    if (drag) return;
    hovered = null;
    stage.classList.remove("is-hovering");
    Object.keys(labelEls).forEach(function (id) {
      labelEls[id].classList.remove("is-active");
    });
  });

  stage.addEventListener(
    "wheel",
    function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      hideHint();
      cam.zoom = clamp(cam.zoom * (e.deltaY > 0 ? 1.09 : 0.92), 0.62, 1.85);
    },
    { passive: false }
  );

  stage.querySelectorAll("[data-zoom]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dir = btn.getAttribute("data-zoom");
      hideHint();
      cam.zoom = clamp(cam.zoom * (dir === "in" ? 0.88 : 1.14), 0.62, 1.85);
    });
  });

  Object.keys(labelEls).forEach(function (id) {
    var el = labelEls[id];
    var b = byId[id];
    if (!b) return;

    el.addEventListener("mouseenter", function () { hovered = b; });
    el.addEventListener("mouseleave", function () {
      if (hovered === b) hovered = null;
    });
    el.addEventListener("focus", function () { hovered = b; });
    el.addEventListener("blur", function () {
      if (hovered === b) hovered = null;
    });

    el.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      go(b);
    });
  });

  /* --- Accento ------------------------------------------------------------- */
  document.addEventListener("accentchange", applyPalette);

  /* --- Ciclo di vita ------------------------------------------------------- */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start();
      else stop();
    }, { threshold: 0 }).observe(stage);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else if (visible) start();
  });

  window.addEventListener("resize", function () {
    resize();
    if (visible) render();
  });

  /* --- Avvio --------------------------------------------------------------- */
  applyPalette();
  resize();

  // posizioni iniziali e lune
  BODIES.forEach(function (b) {
    if (b.kind === "sun") { b.x = 0; b.z = 0; return; }
    b.x = Math.cos(b.phase) * b.orbit;
    b.z = Math.sin(b.phase) * b.orbit;

    if (b.moons) {
      b.moons = b.moons.map(function (name, i) {
        return {
          name: name,
          dist: b.radius * 1.35 + i * b.radius * 0.3,
          phase: i * 1.7 + b.phase,
          speed: 0.06 / (1 + i * 0.45),
          wx: b.x,
          wz: b.z
        };
      });
      b.moons.forEach(function (m) {
        m.wx = b.x + Math.cos(m.phase) * m.dist;
        m.wz = b.z + Math.sin(m.phase) * m.dist;
      });
    }
  });

  render();
  start();

})();
