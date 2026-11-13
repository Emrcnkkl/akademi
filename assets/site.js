// Sayfalar arasında paylaşılan bileşenler: koç kartları, ön kayıt formu, koç başvuru formu, SSS.
import { KOCLAR } from "./config.js";
import { $, $$, toast, esc } from "./ui.js";

// Firebase (~300 KB) sayfa açılışını yavaşlatmasın: sadece form kullanılınca yüklenir.
let fbPromise = null;
function loadFirebase() {
  fbPromise ??= Promise.all([
    import("./firebase.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
  ]).then(([{ db }, fs]) => ({ db, ...fs }));
  return fbPromise;
}
// form ile etkileşime geçilince (odak/dokunma) arka planda önceden yükle
function warmUp(form) {
  const go = () => loadFirebase().catch(() => { fbPromise = null; });
  ["focusin", "pointerdown"].forEach((ev) => form.addEventListener(ev, go, { once: true }));
}
async function save(col, data) {
  const { db, collection, addDoc, serverTimestamp } = await loadFirebase();
  return addDoc(collection(db, col), { ...data, createdAt: serverTimestamp() });
}

const ALAN_AD = { SAY: "Sayısal", EA: "Eşit Ağırlık", SOZ: "Sözel", DIL: "Dil" };

// ---------- koç kartları ----------
export function renderCoaches(el, { alan = "", limit = 0 } = {}) {
  let list = KOCLAR.filter((k) => !alan || k.alan === alan);
  if (limit) list = list.slice(0, limit);
  el.innerHTML = list.length ? list.map((k) => {
    const ini = k.ad.split(" ").map((p) => p[0]).join("").slice(0, 2);
    return `<div class="coach">
      <div class="coach-photo">${k.foto ? `<img src="${esc(k.foto)}" alt="${esc(k.ad)}" loading="lazy">` : `<span class="coach-ini">${esc(ini)}</span>`}
        <span class="coach-chip">${esc(ALAN_AD[k.alan] || "")}</span>${k.ornek ? `<span class="coach-ornek">Örnek profil</span>` : ""}</div>
      <div class="coach-tag"><b>${esc(k.ad)}</b><span class="coach-school">${esc(k.okul)}</span><span class="coach-rank">${esc(k.derece)}</span></div></div>`;
  }).join("") : `<div class="card empty" style="grid-column:1/-1">Bu alandaki koçlarımız yakında burada. Ön görüşmede sana uygun koçu birlikte buluyoruz.</div>`;
}
export function bindCoachFilter(filterEl, gridEl) {
  $$("button", filterEl).forEach((b) => b.addEventListener("click", () => {
    $$("button", filterEl).forEach((x) => x.classList.toggle("on", x === b)); renderCoaches(gridEl, { alan: b.dataset.a });
  }));
}

// ---------- form yardımcıları ----------
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

// ---------- öğrenci / veli ön kayıt ----------
export function bindStudentForm() {
  const f = $("#studentForm"); if (!f) return;
  warmUp(f);
  let kim = "ogrenci";
  $$("#kimSeg button").forEach((b) => b.addEventListener("click", () => {
    $$("#kimSeg button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); kim = b.dataset.v;
  }));
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!checkForm(f)) return;
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
    try {
      await save("ogrenciBasvurulari", {
        kim, ad: val("s_ad"), telefon: val("s_tel"), email: val("s_email"), sinif: val("s_sinif"),
        alan: val("s_alan"), hedef: val("s_hedef"), kvkk: true, durum: "yeni",
      });
      success(f, "Talebini aldık!", "24 saat içinde WhatsApp'tan sana ulaşacağız.");
    } catch (err) { console.error(err); toast("Gönderilemedi, lütfen tekrar dene.", "err"); btn.disabled = false; }
  });
}

// ---------- koç başvurusu ----------
export function bindMentorForm() {
  const f = $("#mentorForm"); if (!f) return;
  warmUp(f);
  f.addEventListener("submit", async (e) => {
    e.preventDefault(); if (!checkForm(f)) return;
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
    try {
      await save("mentorBasvurulari", {
        ad: val("m_ad"), telefon: val("m_tel"), email: val("m_email"), universite: val("m_uni"), bolum: val("m_bolum"),
        alan: val("m_alan"), siralama: Number(val("m_sira")), yil: Number(val("m_yil")), neden: val("m_neden"),
        kvkk: true, durum: "yeni",
      });
      success(f, "Başvurun alındı!", "Değerlendirip en kısa sürede seninle iletişime geçeceğiz.");
    } catch (err) { console.error(err); toast("Gönderilemedi, lütfen tekrar dene.", "err"); btn.disabled = false; }
  });
}

// ---------- SSS akordeon: biri açılınca diğerleri kapansın ----------
export function bindFaq(root = document) {
  $$(".faq details", root).forEach((d) => d.addEventListener("toggle", () => {
    if (d.open) $$(".faq details", d.closest(".faq")).forEach((o) => o !== d && (o.open = false));
  }));
}
