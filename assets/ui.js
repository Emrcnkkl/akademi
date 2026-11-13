import { BRAND } from "./config.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function fillBrand() {
  $$("[data-brand]").forEach((el) => (el.textContent = BRAND[el.dataset.brand] ?? ""));
  if (document.title.includes("{marka}")) document.title = document.title.replace("{marka}", BRAND.tamAd);
  $$("[data-wa]").forEach((el) => (el.href = `https://wa.me/${BRAND.whatsapp}`));
  $$("[data-insta]").forEach((el) => { el.href = BRAND.instagram; if (!el.children.length) el.textContent = BRAND.instagramKullanici || "Instagram"; });
  $$("[data-mail]").forEach((el) => { el.href = `mailto:${BRAND.email}`; el.textContent = BRAND.email; });
}

export function toast(msg, type = "ok") {
  let box = $("#toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; document.body.appendChild(box); }
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.classList.add("out"), 3200);
  setTimeout(() => t.remove(), 3700);
}

// ---------- tarih yardımcıları (yerel saat, YYYY-MM-DD) ----------
export const iso = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export function monday(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export const GUN_KISA = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
export const GUNLER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
export const trDate = (s) => { if (!s) return "-"; const [y, m, d] = s.split("-"); return `${d}.${m}.${y}`; };
export const tsStr = (ts) => (ts?.toDate ? ts.toDate().toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "-");

// ---------- modal ----------
export function openModal(html, { wide = false } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  wrap.innerHTML = `<div class="modal ${wide ? "wide" : ""}"><button class="modal-x" aria-label="Kapat">×</button>${html}</div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.addEventListener("click", (e) => { if (e.target === wrap || e.target.classList.contains("modal-x")) close(); });
  return { el: wrap.querySelector(".modal"), close };
}

// ---------- YKS ders şablonları ----------
export const ALANLAR = { SAY: "Sayısal", EA: "Eşit Ağırlık", SOZ: "Sözel", DIL: "Dil" };
export const DERSLER = {
  TYT: [["turkce", "Türkçe", 40], ["sosyal", "Sosyal", 20], ["mat", "Matematik", 40], ["fen", "Fen", 20]],
  SAY: [["mat", "Matematik", 40], ["fizik", "Fizik", 14], ["kimya", "Kimya", 13], ["biyoloji", "Biyoloji", 13]],
  EA: [["mat", "Matematik", 40], ["edebiyat", "Edebiyat", 24], ["tarih1", "Tarih-1", 10], ["cog1", "Coğrafya-1", 6]],
  SOZ: [["edebiyat", "Edebiyat", 24], ["tarih1", "Tarih-1", 10], ["cog1", "Coğrafya-1", 6], ["tarih2", "Tarih-2", 11], ["cog2", "Coğrafya-2", 11], ["felsefe", "Felsefe Grubu", 12], ["din", "Din Kültürü", 6]],
  DIL: [["ydt", "Yabancı Dil", 80]],
};
export const GOREV_TUR = { konu: "Konu çalışma", soru: "Soru çözümü", tekrar: "Tekrar", deneme: "Deneme", video: "Video / kaynak" };
export const DERS_LISTESI = ["Türkçe", "Matematik", "Geometri", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "Felsefe", "Din Kültürü", "Edebiyat", "Yabancı Dil", "Genel"];

// ---------- basit SVG çizgi grafik ----------
export function lineChart(points, { h = 200, max = null, label = "" } = {}) {
  if (!points.length) return `<div class="empty">Henüz veri yok.</div>`;
  const W = 640, H = h, P = 32;
  const vals = points.map((p) => p.y);
  const top = max ?? (Math.max(...vals) * 1.15 || 10);
  const x = (i) => (points.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (points.length - 1));
  const y = (v) => H - P - (v / top) * (H - 2 * P);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  const dots = points.map((p, i) =>
    `<g><circle cx="${x(i)}" cy="${y(p.y)}" r="4"/><text x="${x(i)}" y="${y(p.y) - 9}" text-anchor="middle">${p.y}</text>
     <text class="xl" x="${x(i)}" y="${H - 10}" text-anchor="middle">${esc(p.x)}</text></g>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
    <line class="axis" x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}"/>
    <path d="${path}"/>${dots}</svg>`;
}

export function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const arr = crypto.getRandomValues(new Uint32Array(10));
  return [...arr].map((n) => chars[n % chars.length]).join("");
}
