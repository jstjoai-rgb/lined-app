/* ══════════════════════════════════════════════════════════════════════
   CTRL+MARKUP  ·  JSTWRLD
   Write on any build, in the browser, on top of the real thing.

   Drop one line into any page you want reviewable:
       <script src="/ctrl-markup.js" defer><\/script>

   Pencil draws. Tap pins a comment to whatever element you tapped, so the
   note travels with that element even after the layout changes. Everything
   saves locally and posts to /api/notes — which means it lands in Supabase,
   in your inbox, and in JSTJO's memory.

   Options (optional, set before the script loads):
       window.CTRL_MARKUP = { endpoint:"/api/notes", project:"LINED.", key:"ctrl:markup" }
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  if (window.__ctrlMarkup) return;
  window.__ctrlMarkup = true;

  var CFG = Object.assign({
    endpoint: "/api/notes",
    project: document.title || "build",
    key: "ctrl:markup:" + location.pathname
  }, window.CTRL_MARKUP || {});

  var state = { on: false, tool: "pin", strokes: [], pins: [], drawing: null, pass: "" };

  /* ---------- storage ---------- */
  function load() {
    try {
      var v = localStorage.getItem(CFG.key);
      if (v) { var d = JSON.parse(v); state.strokes = d.strokes || []; state.pins = d.pins || []; }
    } catch (e) {}
  }
  function save() {
    try { localStorage.setItem(CFG.key, JSON.stringify({ strokes: state.strokes, pins: state.pins })); }
    catch (e) {}
  }

  /* ---------- an address for any element, so a pin survives a redraw ---------- */
  function pathOf(el) {
    if (!el || el === document.body) return "body";
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body && parts.length < 12) {
      var p = el.parentNode, i = 1, sib = el;
      while ((sib = sib.previousElementSibling)) if (sib.tagName === el.tagName) i++;
      parts.unshift(el.tagName.toLowerCase() + ":nth-of-type(" + i + ")");
      el = p;
    }
    return "body > " + parts.join(" > ");
  }
  function find(sel) { try { return document.querySelector(sel); } catch (e) { return null; } }

  /* ---------- chrome ---------- */
  var css = document.createElement("style");
  css.textContent = [
    "#ctrlmk,#ctrlbar,#ctrlpanel{font-family:ui-monospace,'SF Mono',Menlo,monospace;box-sizing:border-box}",
    "#ctrlmk{position:fixed;inset:0;z-index:2147483000;pointer-events:none}",
    "#ctrlmk.on{pointer-events:auto;touch-action:none;cursor:crosshair}",
    "#ctrlmk svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}",
    "#ctrlbar{position:fixed;top:52px;left:50%;transform:translateX(-50%);z-index:2147483100;",
    "  display:flex;gap:5px;background:#12161A;border:1px solid #3E4A55;border-radius:6px;padding:5px;",
    "  box-shadow:0 8px 30px rgba(0,0,0,.45)}",
    "#ctrlbar button{font:inherit;font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;",
    "  background:transparent;color:#E4EAEF;border:1px solid #2E3841;border-radius:3px;padding:8px 11px;cursor:pointer}",
    "#ctrlbar button:hover{border-color:#7E8B95}",
    "#ctrlbar button.on{background:#E5533D;border-color:#E5533D;color:#fff}",
    "#ctrlbar b{color:#7E8B95;font-size:10px;align-self:center;padding:0 6px;letter-spacing:.1em}",
    ".ctrlpin{position:absolute;width:24px;height:24px;border-radius:50% 50% 50% 2px;background:#E5533D;",
    "  color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center;cursor:pointer;",
    "  transform:translate(-50%,-100%);box-shadow:0 3px 10px rgba(0,0,0,.4);pointer-events:auto}",
    ".ctrlpin.done{background:#5FA88C}",
    "#ctrlpanel{position:fixed;top:0;right:0;bottom:0;width:330px;background:#12161A;color:#E4EAEF;",
    "  border-left:1px solid #2E3841;z-index:2147483200;display:none;flex-direction:column;font-size:12.5px}",
    "#ctrlpanel.on{display:flex}",
    "#ctrlpanel header{padding:12px 14px;border-bottom:1px solid #2E3841;display:flex;align-items:center;gap:8px}",
    "#ctrlpanel header span{flex:1;letter-spacing:.16em;font-size:11px}",
    "#ctrlpanel .list{flex:1;overflow:auto;padding:10px 14px}",
    "#ctrlpanel .c{border-bottom:1px solid #1F262C;padding:9px 0;display:flex;gap:9px;align-items:flex-start}",
    "#ctrlpanel .c i{font-style:normal;color:#E5533D;font-weight:700;flex:0 0 18px}",
    "#ctrlpanel .c.done i{color:#5FA88C}",
    "#ctrlpanel .c p{margin:0;flex:1;line-height:1.5;color:#C6CDD4}",
    "#ctrlpanel .c.done p{color:#6C7883;text-decoration:line-through}",
    "#ctrlpanel .c u{cursor:pointer;color:#5A6570;text-decoration:none;font-size:14px}",
    "#ctrlpanel footer{padding:12px 14px;border-top:1px solid #2E3841;display:grid;gap:8px}",
    "#ctrlpanel input{background:#0F1317;border:1px solid #2E3841;color:#E4EAEF;font:inherit;",
    "  padding:8px;border-radius:3px;width:100%}",
    "#ctrlpanel .send{background:#E5533D;border:0;color:#fff;padding:11px;font:inherit;font-size:11px;",
    "  letter-spacing:.14em;text-transform:uppercase;cursor:pointer;border-radius:3px}",
    "#ctrlpanel .msg{font-size:11px;color:#7E8B95;min-height:16px}",
    "@media print{#ctrlbar,#ctrlpanel{display:none!important}}"
  ].join("");
  document.head.appendChild(css);

  var layer = document.createElement("div"); layer.id = "ctrlmk";
  layer.innerHTML = '<svg id="ctrlink"></svg>';
  document.body.appendChild(layer);

  var bar = document.createElement("div"); bar.id = "ctrlbar";
  bar.innerHTML =
    '<b>CTRL+MARKUP</b>' +
    '<button data-t="pin" class="on">Pin a note</button>' +
    '<button data-t="draw">Draw</button>' +
    '<button data-t="erase">Erase</button>' +
    '<button id="ctrl-list">Notes <u id="ctrl-n">0</u></button>' +
    '<button id="ctrl-off">Done</button>';
  document.body.appendChild(bar);

  var panel = document.createElement("div"); panel.id = "ctrlpanel";
  panel.innerHTML =
    '<header><span>NOTES</span><button id="ctrl-close" style="background:none;border:0;color:#7E8B95;cursor:pointer;font-size:16px">\u00d7</button></header>' +
    '<div class="list" id="ctrl-clist"></div>' +
    '<footer><input id="ctrl-who" placeholder="Your name"><input id="ctrl-pass" type="password" placeholder="Passphrase">' +
    '<button class="send" id="ctrl-send">Send them all</button><div class="msg" id="ctrl-msg"></div></footer>';
  document.body.appendChild(panel);

  var svg = document.getElementById("ctrlink");
  var NS = "http://www.w3.org/2000/svg";

  /* ---------- painting ---------- */
  function redraw() {
    var sy = window.scrollY, sx = window.scrollX;
    svg.innerHTML = state.strokes.map(function (s) {
      var d = s.pts.map(function (p, i) {
        return (i ? "L" : "M") + (p[0] - sx).toFixed(1) + " " + (p[1] - sy).toFixed(1);
      }).join(" ");
      return '<path d="' + d + '" fill="none" stroke="#E5533D" stroke-width="2.6" ' +
             'stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>';
    }).join("");

    Array.prototype.slice.call(document.querySelectorAll(".ctrlpin")).forEach(function (n) { n.remove(); });
    state.pins.forEach(function (p, i) {
      var host = find(p.sel), x, y;
      if (host) {
        var r = host.getBoundingClientRect();
        x = r.left + r.width * p.rx; y = r.top + r.height * p.ry;
      } else { x = p.x - sx; y = p.y - sy; }
      var el = document.createElement("div");
      el.className = "ctrlpin" + (p.done ? " done" : "");
      el.textContent = i + 1;
      el.style.left = x + "px"; el.style.top = y + "px";
      el.dataset.i = i;
      layer.appendChild(el);
    });
    document.getElementById("ctrl-n").textContent = state.pins.length;
    renderList();
  }

  function renderList() {
    document.getElementById("ctrl-clist").innerHTML = state.pins.length
      ? state.pins.map(function (p, i) {
          return '<div class="c' + (p.done ? " done" : "") + '" data-ci="' + i + '"><i>' + (i + 1) + '</i>' +
                 '<p>' + String(p.text).replace(/</g, "&lt;") + '</p>' +
                 '<u data-tick="' + i + '">\u2713</u><u data-del="' + i + '">\u00d7</u></div>';
        }).join("")
      : '<div style="color:#5A6570;padding:14px 0">No notes yet. Tap anything on the page.</div>';
  }

  /* ---------- interaction ---------- */
  layer.addEventListener("pointerdown", function (e) {
    if (!state.on) return;
    var pin = e.target.closest(".ctrlpin");
    if (pin) {
      var i = +pin.dataset.i;
      if (state.tool === "erase") { state.pins.splice(i, 1); save(); redraw(); return; }
      var t = prompt("Note " + (i + 1), state.pins[i].text);
      if (t !== null) { state.pins[i].text = t; save(); redraw(); }
      return;
    }
    if (state.tool === "draw") {
      e.preventDefault();
      state.drawing = { pts: [[e.clientX + scrollX, e.clientY + scrollY]] };
      state.strokes.push(state.drawing);
      layer.setPointerCapture(e.pointerId);
      return;
    }
    if (state.tool === "erase") {
      if (state.strokes.length) { state.strokes.pop(); save(); redraw(); }
      return;
    }
    // pin mode — find what is underneath the overlay
    layer.style.pointerEvents = "none";
    var host = document.elementFromPoint(e.clientX, e.clientY);
    layer.style.pointerEvents = "auto";
    var text = prompt("What needs to change here?");
    if (!text) return;
    var r = host ? host.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 };
    state.pins.push({
      text: text,
      sel: pathOf(host),
      label: host ? (host.tagName.toLowerCase() +
        (host.id ? "#" + host.id : "") +
        (host.className && typeof host.className === "string" ? "." + host.className.trim().split(/\s+/)[0] : "")) : "",
      rx: r.width ? (e.clientX - r.left) / r.width : 0,
      ry: r.height ? (e.clientY - r.top) / r.height : 0,
      x: e.clientX + scrollX, y: e.clientY + scrollY,
      done: false
    });
    save(); redraw();
  });

  layer.addEventListener("pointermove", function (e) {
    if (!state.drawing) return;
    state.drawing.pts.push([e.clientX + scrollX, e.clientY + scrollY]);
    redraw();
  });
  layer.addEventListener("pointerup", function () {
    if (state.drawing) { state.drawing = null; save(); }
  });

  document.addEventListener("click", function (e) {
    var t = e.target;
    var tb = t.closest("#ctrlbar button[data-t]");
    if (tb) {
      state.tool = tb.dataset.t;
      Array.prototype.slice.call(document.querySelectorAll("#ctrlbar button[data-t]"))
        .forEach(function (b) { b.classList.toggle("on", b === tb); });
      layer.style.cursor = state.tool === "draw" ? "crosshair" : "copy";
      return;
    }
    if (t.id === "ctrl-list") { panel.classList.toggle("on"); return; }
    if (t.id === "ctrl-close") { panel.classList.remove("on"); return; }
    if (t.id === "ctrl-off") { toggle(false); return; }
    if (t.dataset && t.dataset.tick !== undefined) {
      var i = +t.dataset.tick; state.pins[i].done = !state.pins[i].done; save(); redraw(); return;
    }
    if (t.dataset && t.dataset.del !== undefined) {
      state.pins.splice(+t.dataset.del, 1); save(); redraw(); return;
    }
    if (t.id === "ctrl-send") send();
  });

  window.addEventListener("scroll", redraw, { passive: true });
  window.addEventListener("resize", redraw);

  /* ---------- sending ---------- */
  function send() {
    var msg = document.getElementById("ctrl-msg");
    var pass = document.getElementById("ctrl-pass").value.trim();
    var who = document.getElementById("ctrl-who").value.trim();
    var open = state.pins.filter(function (p) { return !p.done; });
    if (!pass) { msg.textContent = "Passphrase missing."; return; }
    if (!open.length) { msg.textContent = "Nothing to send."; return; }
    msg.textContent = "Sending\u2026";
    var body = open.map(function (p, i) {
      return (i + 1) + ". " + p.text + (p.label ? "   [" + p.label + "]" : "");
    }).join("\n") + "\n\n(" + state.strokes.length + " ink marks on the page · " + location.pathname + ")";
    fetch(CFG.endpoint, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ pass: pass, who: who, screen: CFG.project + " \u2014 markup",
                             verdict: "CHANGE", code: "MARKUP", note: body })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { msg.textContent = d.error || "Didn't send."; return; }
        msg.textContent = "Sent. " + open.length + " note" + (open.length > 1 ? "s" : "") + ".";
        open.forEach(function (p) { p.done = true; });
        save(); redraw();
      });
    }).catch(function () { msg.textContent = "No connection \u2014 they're still saved here."; });
  }

  /* ---------- on / off ---------- */
  function toggle(on) {
    state.on = on === undefined ? !state.on : on;
    layer.classList.toggle("on", state.on);
    bar.style.display = state.on ? "flex" : "none";
    if (!state.on) panel.classList.remove("on");
  }

  var open = document.createElement("button");
  open.textContent = "\u270E";
  open.style.cssText = "position:fixed;bottom:10px;right:10px;z-index:2147483100;opacity:.42;font:11px/1 ui-monospace,Menlo,monospace;" +
    "letter-spacing:.12em;background:#12161A;color:#E4EAEF;border:1px solid #3E4A55;border-radius:5px;" +
    "padding:8px 11px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35);border-radius:50%;line-height:1;transition:opacity .15s";
  open.title = "Mark up this page  (M)";
  open.onmouseenter = function(){ open.style.opacity = "1"; };
  open.onmouseleave = function(){ open.style.opacity = ".42"; };
  open.onclick = function () { toggle(true); };
  document.body.appendChild(open);
  var mo = new MutationObserver(function () { open.style.display = state.on ? "none" : "block"; });
  mo.observe(bar, { attributes: true, attributeFilter: ["style"] });

  document.addEventListener("keydown", function (e) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "m" && !e.metaKey && !e.ctrlKey) toggle();
    if (e.key === "Escape" && state.on) toggle(false);
  });

  load(); toggle(false); redraw();
})();
