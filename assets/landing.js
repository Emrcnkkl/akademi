// Ana sayfaya özel: geri sayım bandı, panel sekmeleri, koç önizlemesi (ilk 4), ön kayıt formu, SSS.
import "./layout.js";
import { SINAV } from "./config.js";
import { $, $$ } from "./ui.js";
import { renderCoaches, bindStudentForm, bindFaq } from "./site.js";

// ---------- YKS geri sayım bandı ----------
const target = new Date(SINAV.tarih).getTime();
const pad = (n) => String(n).padStart(2, "0");
function tick() {
  let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  $("#cdD").textContent = d; $("#cdH").textContent = pad(h); $("#cdM").textContent = pad(m); $("#cdS").textContent = pad(s);
}
tick(); setInterval(tick, 1000);

// ---------- panel sekmeleri ----------
$$("#scTabs .sc-tab").forEach((b) => b.addEventListener("click", () => {
  $$("#scTabs .sc-tab").forEach((x) => x.classList.toggle("on", x === b));
  $$(".sc-pane").forEach((p) => p.classList.toggle("on", p.dataset.p === b.dataset.p));
}));

// ---------- koçlar (ana sayfada ilk 4) ----------
const grid = $("#coachGrid");
renderCoaches(grid, { limit: 4 });
$$("#coachFilter button").forEach((b) => b.addEventListener("click", () => {
  $$("#coachFilter button").forEach((x) => x.classList.toggle("on", x === b));
  renderCoaches(grid, { alan: b.dataset.a, limit: 4 });
}));

// ---------- ön kayıt formu + TYT net aracından gelen net ----------
bindStudentForm();
try {
  const net = sessionStorage.getItem("sonTytNet");
  if (net && net !== "0" && !document.querySelector("#s_hedef").value) document.querySelector("#s_hedef").value = `Son TYT netim: ${net}. `;
} catch {}

bindFaq();
