import { db } from "./firebase.js";
import { KOCLAR, SINAV } from "./config.js";
import { $, $$, fillBrand, toast, esc } from "./ui.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

fillBrand();
$("#yr").textContent = new Date().getFullYear();

// ---------- nav gölgesi + mobil CTA ----------
const nav = $("#nav"), mcta = $("#mcta");
const onScroll = () => {
  nav.classList.toggle("scrolled", scrollY > 10);
  const kayit = $("#kayit").getBoundingClientRect();
  const nearForm = kayit.top < innerHeight && kayit.bottom > 0;
  mcta.classList.toggle("show", scrollY > 600 && !nearForm);
};
addEventListener("scroll", onScroll, { passive: true }); onScroll();

// ---------- scroll animasyonu ----------
const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
$$(".reveal").forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 60}ms`; io.observe(el); });

// ---------- YKS geri sayım ----------
const target = new Date(SINAV.tarih).getTime();
const pad = (n) => String(n).padStart(2, "0");
function tick() {
  let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
  const d = Math.floor(s / 86400); s %= 86400;
  const h = Math.floor(s / 3600); s %= 3600;
  const m = Math.floor(s / 60); s %= 60;
  $("#cdD").textContent = d; $("#cdH").textContent = pad(h); $("#cdM").textContent = pad(m); $("#cdS").textContent = pad(s);
  $("#tbDays").textContent = d;
}
tick(); setInterval(tick, 1000);

// ---------- panel sekmeleri ----------
$$("#scTabs .sc-tab").forEach((b) => b.addEventListener("click", () => {
  $$("#scTabs .sc-tab").forEach((x) => x.classList.toggle("on", x === b));
  $$(".sc-pane").forEach((p) => p.classList.toggle("on", p.dataset.p === b.dataset.p));
}));

// ---------- koç kartları + filtre ----------
function drawCoaches(alan = "") {
  const list = KOCLAR.filter((k) => !alan || k.alan === alan);
  $("#coachGrid").innerHTML = list.length ? list.map((k) => {
    const ini = k.ad.split(" ").map((p) => p[0]).join("").slice(0, 2);
    return `<div class="coach reveal in">
      <div class="coach-photo">${k.foto ? `<img src="${esc(k.foto)}" alt="${esc(k.ad)}" loading="lazy">` : `<span class="coach-ini">${esc(ini)}</span>`}</div>
      <div class="coach-tag"><b>${esc(k.ad)}</b><span class="coach-school">${esc(k.okul)}</span><span class="coach-rank">${esc(k.derece)}</span></div></div>`;
  }).join("") : `<div class="card empty" style="grid-column:1/-1">Bu alandaki koçlarımız yakında burada. Ön görüşmede sana uygun koçu birlikte buluyoruz.</div>`;
}
drawCoaches();
$$("#coachFilter button").forEach((b) => b.addEventListener("click", () => {
  $$("#coachFilter button").forEach((x) => x.classList.toggle("on", x === b)); drawCoaches(b.dataset.a);
}));

// ---------- TYT net hesaplayıcı ----------
const MAX = { tr: 40, sos: 20, mat: 40, fen: 20 };
const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString("tr-TR");
function calc() {
  let top = 0;
  Object.keys(MAX).forEach((c) => {
    const dEl = $(`[data-c="${c}"][data-k="d"]`), yEl = $(`[data-c="${c}"][data-k="y"]`);
    let d = Math.max(0, Number(dEl.value) || 0), y = Math.max(0, Number(yEl.value) || 0);
    if (d + y > MAX[c]) { y = Math.max(0, MAX[c] - d); yEl.value = y || ""; if (d > MAX[c]) { d = MAX[c]; dEl.value = d; } }
    const net = d - y / 4; top += net;
    $("#n_" + c).textContent = fmt(net);
  });
  $("#netTop").textContent = fmt(top);
  $("#netBar").style.width = `${Math.max(0, Math.min(100, (top / 120) * 100))}%`;
  const msg = top <= 0 ? "Değerleri girdikçe netin hesaplanır."
    : top < 40 ? "Temeli sağlamlaştırma zamanı. Doğru bir programla en hızlı yükseliş bu aralıkta olur."
    : top < 70 ? "İyi bir başlangıç. Eksik konuları sistemli kapatırsan netlerin hızla artar."
    : top < 95 ? "Güçlü bir seviye. Şimdi fark yaratan şey süre yönetimi ve deneme analizi."
    : "Derece bölgesindesin! Bu seviyeyi korumak ve AYT'yi oturtmak için doğru strateji şart.";
  $("#netMsg").textContent = msg;
}
$$(".calc input").forEach((i) => i.addEventListener("input", calc));
$("#netCta").addEventListener("click", () => {
  const top = $("#netTop").textContent;
  const h = $("#s_hedef");
  if (top !== "0" && h && !h.value) h.value = `Son TYT netim: ${top}. `;
});

// ---------- ön kayıt / koç başvurusu ----------
let kim = "ogrenci";
$$("#kimSeg button").forEach((b) => b.addEventListener("click", () => {
  $$("#kimSeg button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); kim = b.dataset.v;
}));
const val = (id) => $("#" + id).value.trim();
function checkForm(form) {
  for (const el of form.querySelectorAll("[required]")) {
    const ok = el.type === "checkbox" ? el.checked : el.value.trim() !== "";
    if (!ok) { el.focus(); toast("Lütfen zorunlu alanları doldurun.", "err"); return false; }
    if (el.type === "email" && el.value && !/^\S+@\S+\.\S+$/.test(el.value)) { el.focus(); toast("E-posta geçersiz.", "err"); return false; }
  }
  const tel = form.querySelector('input[type="tel"]');
  if (tel && tel.value.replace(/\D/g, "").length < 10) { tel.focus(); toast("Telefon numarası eksik görünüyor.", "err"); return false; }
  return true;
}
const success = (form, title, text) => { form.innerHTML = `<div class="success-box"><div class="big">✓</div><h3>${title}</h3><p class="muted">${text}</p></div>`; };

$("#studentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target; if (!checkForm(f)) return;
  const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
  try {
    await addDoc(collection(db, "ogrenciBasvurulari"), {
      kim, ad: val("s_ad"), telefon: val("s_tel"), email: val("s_email"), sinif: val("s_sinif"),
      alan: val("s_alan"), hedef: val("s_hedef"), kvkk: true, durum: "yeni", createdAt: serverTimestamp(),
    });
    success(f, "Talebini aldık!", "24 saat içinde WhatsApp'tan sana ulaşacağız.");
  } catch (err) { console.error(err); toast("Gönderilemedi, lütfen tekrar dene.", "err"); btn.disabled = false; }
});

$("#mentorForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target; if (!checkForm(f)) return;
  const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
  try {
    await addDoc(collection(db, "mentorBasvurulari"), {
      ad: val("m_ad"), telefon: val("m_tel"), email: val("m_email"), universite: val("m_uni"), bolum: val("m_bolum"),
      alan: val("m_alan"), siralama: Number(val("m_sira")), yil: Number(val("m_yil")), neden: val("m_neden"),
      kvkk: true, durum: "yeni", createdAt: serverTimestamp(),
    });
    success(f, "Başvurun alındı!", "Değerlendirip en kısa sürede seninle iletişime geçeceğiz.");
  } catch (err) { console.error(err); toast("Gönderilemedi, lütfen tekrar dene.", "err"); btn.disabled = false; }
});

// ---------- SSS: biri açılınca diğerleri kapansın ----------
$$("#faq details").forEach((d) => d.addEventListener("toggle", () => { if (d.open) $$("#faq details").forEach((o) => o !== d && (o.open = false)); }));
