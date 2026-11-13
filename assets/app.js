// 24 Akademi – tek sayfa uygulama (NXT gibi): tüm sekmeler index.html içinde, sayfa yeniden yüklenmeden değişir.
// Adresler: #/ (ana sayfa), #/koclar, #/araclar, #/tyt-net, #/ayt-net, #/yks-sayac, #/pomodoro, #/hakkimizda, #/sss, #/iletisim
// Bölüm bağlantıları (#kayit, #fiyat, #koc-ol...) ilgili sekmeyi açıp oraya kaydırır.
import { setActive, observeReveal } from "./layout.js";
import { BRAND, SINAV } from "./config.js";
import { $, $$, toast, DERSLER } from "./ui.js";
import { renderCoaches, bindCoachFilter, bindMentorForm, bindStudentForm, bindFaq } from "./site.js";

// ================= ANA SAYFA =================
function initHome(root) {
  const q = (s) => root.querySelector(s), qa = (s) => [...root.querySelectorAll(s)];
  const target = new Date(SINAV.tarih).getTime();
  const pad = (n) => String(n).padStart(2, "0");
  const tick = () => {
    let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
    const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
    q("#cdD").textContent = d; q("#cdH").textContent = pad(h); q("#cdM").textContent = pad(m); q("#cdS").textContent = pad(s);
  };
  tick(); setInterval(tick, 1000);
  qa("#scTabs .sc-tab").forEach((b) => b.addEventListener("click", () => {
    qa("#scTabs .sc-tab").forEach((x) => x.classList.toggle("on", x === b));
    qa(".sc-pane").forEach((p) => p.classList.toggle("on", p.dataset.p === b.dataset.p));
  }));
  const grid = q("#coachGrid");
  renderCoaches(grid, { limit: 4 });
  qa("#coachFilter button").forEach((b) => b.addEventListener("click", () => {
    qa("#coachFilter button").forEach((x) => x.classList.toggle("on", x === b));
    renderCoaches(grid, { alan: b.dataset.a, limit: 4 });
  }));
  bindStudentForm();
  bindFaq(root);
}

// ================= DİĞER SEKMELER =================
const INIT = {
  home: initHome,
  "koclar": (root) => {

  renderCoaches(root.querySelector("#kocGrid"));
  bindCoachFilter(root.querySelector("#kocFilter"), root.querySelector("#kocGrid"));
  bindMentorForm();

  },
  "tyt-net": (root) => {

  const MAX = { tr: 40, sos: 20, mat: 40, fen: 20 };
  const $ = (s) => root.querySelector(s);
  const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString("tr-TR");
  function calc() {
    let top = 0, cevap = 0;
    for (const c in MAX) {
      const dEl = $(`[data-c="${c}"][data-k="d"]`), yEl = $(`[data-c="${c}"][data-k="y"]`);
      let d = Math.min(MAX[c], Math.max(0, +dEl.value || 0)), y = Math.max(0, +yEl.value || 0);
      if (d + y > MAX[c]) { y = MAX[c] - d; yEl.value = y || ""; }
      if (+dEl.value > MAX[c]) dEl.value = d;
      const net = d - y / 4; top += net; cevap += d + y;
      $("#n_" + c).textContent = fmt(net);
    }
    $("#netTop").textContent = fmt(top); $("#bos").textContent = 120 - cevap;
    $("#netBar").style.width = `${Math.max(0, Math.min(100, top / 1.2))}%`;
    $("#netMsg").textContent = top <= 0 ? "Değerleri girdikçe netin hesaplanır."
      : top < 40 ? "Temeli sağlamlaştırma zamanı. Doğru bir programla en hızlı yükseliş bu aralıkta olur."
      : top < 70 ? "İyi bir başlangıç. Eksik konuları sistemli kapatırsan netlerin hızla artar."
      : top < 95 ? "Güçlü bir seviye. Şimdi fark yaratan şey süre yönetimi ve deneme analizi."
      : "Derece bölgesindesin! Bu seviyeyi korumak ve AYT'yi oturtmak için doğru strateji şart.";
    try { sessionStorage.setItem("sonTytNet", fmt(top)); } catch {}
  }
  root.querySelectorAll(".calc input").forEach((i) => i.addEventListener("input", calc));
  $("#reset").onclick = () => { root.querySelectorAll(".calc input").forEach((i) => (i.value = "")); calc(); };

  },
  "ayt-net": (root) => {

  const $ = (s) => root.querySelector(s);
  const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString("tr-TR");
  let alan = "SAY";
  function draw() {
    const list = DERSLER[alan];
    $("#rows").innerHTML = list.map(([k, ad, n]) => `<div class="calc-row"><span class="lbl"><b>${ad}</b><small>${n} soru</small></span><input type="number" min="0" max="${n}" data-c="${k}" data-k="d" data-max="${n}" inputmode="numeric"/><input type="number" min="0" max="${n}" data-c="${k}" data-k="y" data-max="${n}" inputmode="numeric"/><span class="nt" id="n_${k}">0</span></div>`).join("");
    const max = list.reduce((s, x) => s + x[2], 0);
    $("#ofMax").textContent = "/ " + max; $("#outLbl").textContent = alan === "DIL" ? "Toplam YDT neti" : "Toplam AYT neti";
    calc();
  }
  function calc() {
    let top = 0, max = 0;
    DERSLER[alan].forEach(([k, , n]) => {
      const dEl = $(`[data-c="${k}"][data-k="d"]`), yEl = $(`[data-c="${k}"][data-k="y"]`);
      let d = Math.min(n, Math.max(0, +dEl.value || 0)), y = Math.max(0, +yEl.value || 0);
      if (d + y > n) { y = n - d; yEl.value = y || ""; }
      if (+dEl.value > n) dEl.value = d;
      const net = d - y / 4; top += net; max += n;
      $("#n_" + k).textContent = fmt(net);
    });
    $("#netTop").textContent = fmt(top);
    $("#netBar").style.width = `${Math.max(0, Math.min(100, (top / max) * 100))}%`;
  }
  $("#rows").addEventListener("input", calc);
  root.querySelectorAll("#alanSeg button").forEach((b) => b.addEventListener("click", () => {
    root.querySelectorAll("#alanSeg button").forEach((x) => x.classList.toggle("on", x === b)); alan = b.dataset.a; draw();
  }));
  $("#reset").onclick = draw;
  draw();

  },
  "yks-sayac": (root) => {

  const $ = (s) => root.querySelector(s);
  let target = new Date("2027-06-19T10:15:00+03:00").getTime();
  const pad = (n) => String(n).padStart(2, "0");
  const TAR = [
    ["4 Şubat – 2 Mart 2027", "YKS başvuruları", "2027-03-02"],
    ["19 Haziran 2027", "TYT (1. oturum)", "2027-06-19"],
    ["20 Haziran 2027", "AYT ve YDT (2. ve 3. oturum)", "2027-06-20"],
    ["21 Temmuz 2027", "Sonuçların açıklanması", "2027-07-21"],
  ];
  const today = new Date().toISOString().slice(0, 10);
  $("#tl").innerHTML = TAR.map(([w, a, d]) => `<div class="tl metal-card ${d < today ? "past" : ""}"><span class="when">${w}</span><span>${a}</span></div>`).join("");
  function tick() {
    let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
    const d = Math.floor(s / 86400); s %= 86400; const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60); s %= 60;
    $("#d").textContent = d; $("#h").textContent = pad(h); $("#m").textContent = pad(m); $("#s").textContent = pad(s);
    const saat = +$("#saat").value;
    $("#saatOut").textContent = saat + " saat"; $("#gunOut").textContent = d;
    $("#toplam").textContent = (saat * d).toLocaleString("tr-TR");
    $("#hafta").textContent = Math.floor(d / 7); $("#deneme").textContent = Math.floor(d / 7);
  }
  $("#saat").addEventListener("input", tick);
  root.querySelectorAll("#hedefSeg button").forEach((b) => b.addEventListener("click", () => {
    root.querySelectorAll("#hedefSeg button").forEach((x) => x.classList.toggle("on", x === b)); target = new Date(b.dataset.t).getTime(); tick();
  }));
  tick(); setInterval(tick, 1000);

  },
  "pomodoro": (root) => {

  const $ = (s) => root.querySelector(s);
  const LBL = { odak: "Odak", kisa: "Kısa mola", uzun: "Uzun mola" };
  let mode = "odak", left = 0, total = 0, timer = null, tur = 0;
  const key = "pomo-" + new Date().toISOString().slice(0, 10);
  let done = 0; try { done = +localStorage.getItem(key) || 0; } catch {}
  const dur = () => ({ odak: +$("#sOdak").value || 25, kisa: +$("#sKisa").value || 5, uzun: +$("#sUzun").value || 15 }[mode] * 60);
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  function render() {
    $("#time").textContent = fmt(left);
    $("#bar").style.width = `${total ? (100 * (total - left)) / total : 0}%`;
    $("#pomo").classList.toggle("mola", mode !== "odak");
    document.title = timer ? `${fmt(left)} · ${LBL[mode]} | 24 Akademi` : "Pomodoro Zamanlayıcı | 24 Akademi";
    root.querySelectorAll("#dots i").forEach((d, i) => d.classList.toggle("on", i < tur % 4 || (tur > 0 && tur % 4 === 0 && mode === "uzun")));
    root.querySelectorAll("#modeSeg button").forEach((b) => b.classList.toggle("on", b.dataset.m === mode));
    $("#count").textContent = done; $("#mins").textContent = done * (+$("#sOdak").value || 25);
  }
  function setMode(m) { stop(); mode = m; total = left = dur(); render(); }
  function stop() { clearInterval(timer); timer = null; $("#start").textContent = "Başla"; }
  function beep() {
    try { const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, .25, .5].forEach((t) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(.2, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + t + .2); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .22); });
    } catch {}
  }
  function finish() {
    beep(); stop();
    if (mode === "odak") { tur++; done++; try { localStorage.setItem(key, done); } catch {} setMode(tur % 4 === 0 ? "uzun" : "kisa"); }
    else setMode("odak");
  }
  $("#start").onclick = () => {
    if (timer) return stop(), render();
    const end = Date.now() + left * 1000;
    timer = setInterval(() => { left = Math.max(0, Math.round((end - Date.now()) / 1000)); render(); if (!left) finish(); }, 250);
    $("#start").textContent = "Duraklat"; render();
  };
  $("#reset").onclick = () => setMode(mode);
  $("#skip").onclick = () => finish();
  root.querySelectorAll("#modeSeg button").forEach((b) => (b.onclick = () => setMode(b.dataset.m)));
  ["#sOdak", "#sKisa", "#sUzun"].forEach((id) => $(id).addEventListener("change", () => { if (!timer) setMode(mode); }));
  setMode("odak");

  },
  "sss": (root) => {

  bindFaq(root);

  },
  "iletisim": (root) => {

  const $ = (s) => root.querySelector(s);
  $("#mailCard").href = "mailto:" + BRAND.email; $("#mailTxt").textContent = BRAND.email;
  $("#instaCard").href = BRAND.instagram; $("#instaTxt").textContent = BRAND.instagramKullanici;
  const text = () => {
    const ad = $("#c_ad").value.trim(), konu = $("#c_konu").value, msg = $("#c_msg").value.trim();
    if (!msg) { toast("Lütfen mesajını yaz.", "err"); $("#c_msg").focus(); return null; }
    return { konu, body: `Merhaba, ${ad ? "ben " + ad + ". " : ""}\nKonu: ${konu}\n\n${msg}` };
  };
  $("#sendWa").onclick = () => { const t = text(); if (t) window.open(`https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(t.body)}`, "_blank", "noopener"); };
  $("#sendMail").onclick = () => { const t = text(); if (t) location.href = `mailto:${BRAND.email}?subject=${encodeURIComponent("24 Akademi – " + t.konu)}&body=${encodeURIComponent(t.body)}`; };

  },
};

// ================= YÖNLENDİRİCİ =================
const views = $$(".view");
const started = new Set();
let current = null;

function init(name) {
  if (started.has(name)) return;
  started.add(name);
  const root = $(`.view[data-view="${name}"]`);
  try { INIT[name]?.(root); } catch (e) { console.error(name, e); }
  observeReveal(root);
}

function resolve() {
  const h = decodeURIComponent(location.hash || "");
  if (h.startsWith("#/")) return { view: h.slice(2).replace(/\/$/, "") || "home", target: null };
  if (h.length > 1) {
    const el = document.getElementById(h.slice(1));
    const v = el?.closest(".view");
    if (v) return { view: v.dataset.view, target: el };
  }
  return { view: "home", target: null };
}

function show({ view, target }, animate = true) {
  if (!views.some((v) => v.dataset.view === view)) view = "home";
  const changed = view !== current;
  const swap = () => {
    views.forEach((v) => (v.hidden = v.dataset.view !== view));
    const el = $(`.view[data-view="${view}"]`);
    if (changed) { el.classList.remove("enter"); void el.offsetWidth; el.classList.add("enter"); }
    current = view;
    init(view);
    document.title = el.dataset.title;
    document.body.dataset.page = view;
    setActive(view);
    if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: changed ? "instant" : "smooth", block: "start" }));
    else if (changed) scrollTo({ top: 0, behavior: "instant" });
  };
  if (animate && changed && document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) { const t = document.startViewTransition(swap); t.ready.catch(() => {}); t.finished.catch(() => {}); t.updateCallbackDone.catch(() => {}); }
  else swap();
}

// Aynı sayfa içi tüm "#..." bağlantıları yönlendiriciden geçsin (aynı hash'e tekrar tıklama dahil)
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const href = a.getAttribute("href");
  if (href === "#") return;
  e.preventDefault();
  if (location.hash !== href) history.pushState(null, "", href);
  show(resolve());
});
addEventListener("popstate", () => show(resolve()));
addEventListener("hashchange", () => show(resolve()));

show(resolve(), false);
// TYT aracından gelen neti ön kayıt formuna taşı
addEventListener("hashchange", () => {
  try { const net = sessionStorage.getItem("sonTytNet"); const h = $("#s_hedef");
    if (net && net !== "0" && h && !h.value) h.value = `Son TYT netim: ${net}. `; } catch {}
});
