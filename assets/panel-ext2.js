// YKS hazırlık süreci bileşenleri: deneme analizi, hata defteri, konu tekrar planı, kaynak takibi, özet ekranı.
import { db } from "./firebase.js";
import {
  collection, query, where, getDocs, getDoc, doc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { $, $$, esc, toast, iso, addDays, trDate, openModal, DERSLER, ALANLAR } from "./ui.js";
import { KONULAR, AYT_ALAN, konuKey } from "./konular.js";
import { SINAV } from "./config.js";

const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const fmt = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString("tr-TR");
const bugun = () => iso(new Date());
const ARALIK = [1, 7, 21, 60];            // konu tekrarı: bitti → +1 → +7 → +21 → +60 gün
const HATA_ARALIK = [1, 3, 7, 14, 30];    // hata defteri tekrar aralıkları
const NEDEN = { bilgi: ["Bilgi eksiği", "#9b0000"], dikkat: ["Dikkat / işlem", "#c27a00"], sure: ["Süre", "#2f54c9"] };

async function getTakip(id) { try { const s = await getDoc(doc(db, "takip", id)); return s.exists() ? s.data() : {}; } catch { return {}; } }

// Deneme ders anahtarı → konu listesindeki dersler
const DERS_MAP = {
  TYT: { turkce: ["Türkçe"], sosyal: ["Tarih", "Coğrafya", "Felsefe", "Din Kültürü"], mat: ["Matematik", "Geometri"], fen: ["Fizik", "Kimya", "Biyoloji"] },
  AYT: { mat: ["Matematik", "Geometri"], fizik: ["Fizik"], kimya: ["Kimya"], biyoloji: ["Biyoloji"], edebiyat: ["Edebiyat"], tarih1: ["Tarih"], tarih2: ["Tarih"], cog1: ["Coğrafya"], cog2: ["Coğrafya"], felsefe: ["Felsefe Grubu"], din: ["Din Kültürü"], ydt: ["Yabancı Dil"] },
};
const DERS_ADI = Object.fromEntries(Object.values(DERSLER).flat().map(([k, ad, max]) => [k, ad]));
const DERS_MAX = (tur, alan) => Object.fromEntries((tur === "TYT" ? DERSLER.TYT : DERSLER[alan] || DERSLER.SAY).map(([k, , m]) => [k, m]));

// =====================================================================
// 1) DENEME ANALİZİ
// =====================================================================
export function denemeAnalizModal(deneme, { editable, onSaved }) {
  const max = DERS_MAX(deneme.tur, deneme.alan);
  const an = deneme.analiz || {};
  const m = openModal(`<h3>Deneme analizi · ${deneme.tur} ${esc(deneme.yayin || "")} · ${trDate(deneme.tarih)}</h3>
    <p class="muted small" style="margin-top:-.3rem">${editable ? "Her ders için yanlış ve boşların nedenini say, kaçırdığın konuları işaretle. Bu bilgilerle koçun bir sonraki haftanın programını yazar." : "Öğrencinin girdiği analiz"}</p>
    ${Object.entries(deneme.netler || {}).map(([k, v]) => {
      const bos = Math.max(0, (max[k] || 0) - (v.d || 0) - (v.y || 0)), a = an[k] || {};
      const konular = (DERS_MAP[deneme.tur]?.[k] || []).flatMap((d) => (KONULAR[deneme.tur]?.[d] || []).map((x) => [d, x]));
      return `<div class="an-ders" data-k="${k}">
        <div class="spread"><b>${esc(DERS_ADI[k] || k)}</b><span class="muted small">D ${v.d || 0} · Y ${v.y || 0} · B ${bos} · <b>Net ${fmt(v.net)}</b></span></div>
        <div class="grid-3" style="margin-top:.5rem">${Object.entries(NEDEN).map(([nk, [ad]]) => `<div class="field" style="margin:0"><label>${ad}</label><input type="number" min="0" max="${(v.y || 0) + bos}" data-n="${nk}" value="${a[nk] || ""}" ${editable ? "" : "disabled"}/></div>`).join("")}</div>
        ${konular.length ? `<details ${a.konular?.length ? "open" : ""}><summary class="small" style="cursor:pointer;font-weight:700;margin:.6rem 0 .3rem">Kaçırılan konular ${a.konular?.length ? `(${a.konular.length})` : ""}</summary>
          <div class="chips">${konular.map(([d, x]) => { const key = konuKey(deneme.tur, d, x), on = a.konular?.includes(key);
            return `<button type="button" class="chip ${on ? "on" : ""}" data-key="${key}" ${editable ? "" : "disabled"}>${esc(x)}</button>`; }).join("")}</div></details>` : ""}
      </div>`;
    }).join("")}
    <div class="field" style="margin-top:1rem"><label>Genel not</label><textarea id="an_not" maxlength="1000" ${editable ? "" : "disabled"} placeholder="Örn. Matematikte süre yetmedi, son 10 soruyu göremedim.">${esc(deneme.analizNotu || "")}</textarea></div>
    ${editable ? `<button class="btn btn-accent" id="an_save">Analizi kaydet</button>` : ""}`, { wide: true });
  const el = m.el;
  $$(".chip", el).forEach((c) => (c.onclick = () => c.classList.toggle("on")));
  if (!editable) return;
  $("#an_save", el).onclick = async (e) => {
    const analiz = {};
    $$(".an-ders", el).forEach((d) => {
      const o = {}; $$("[data-n]", d).forEach((i) => { const v = Math.max(0, Number(i.value) || 0); if (v) o[i.dataset.n] = v; });
      const ks = $$(".chip.on", d).map((c) => c.dataset.key); if (ks.length) o.konular = ks;
      if (Object.keys(o).length) analiz[d.dataset.k] = o;
    });
    e.target.disabled = true;
    try { await updateDoc(doc(db, "denemeler", deneme.id), { analiz, analizNotu: $("#an_not", el).value.trim() }); toast("Analiz kaydedildi."); m.close(); onSaved?.(); }
    catch (err) { console.error(err); toast("Kaydedilemedi.", "err"); e.target.disabled = false; }
  };
}

// konu anahtarından okunur ad
const KONU_ADI = {}, KONU_INFO = {};
for (const sin of ["TYT", "AYT"]) for (const [d, ks] of Object.entries(KONULAR[sin])) for (const k of ks) {
  KONU_ADI[konuKey(sin, d, k)] = `${k} <span class="muted">· ${sin} ${d}</span>`;
  KONU_INFO[konuKey(sin, d, k)] = { konu: k, ders: d === "Felsefe Grubu" ? "Felsefe" : d, sinav: sin };
}

export function renderAnalizOzet(el, denemeler, { onKonuEkle } = {}) {
  const analizli = [...denemeler].filter((d) => d.analiz && Object.keys(d.analiz).length).sort((a, b) => b.tarih.localeCompare(a.tarih)).slice(0, 8);
  // ders bazında gidişat: son 3 deneme ortalaması vs önceki 3
  const trend = (tur) => {
    const list = denemeler.filter((d) => d.tur === tur).sort((a, b) => a.tarih.localeCompare(b.tarih));
    if (list.length < 2) return "";
    const keys = [...new Set(list.flatMap((d) => Object.keys(d.netler || {})))];
    const ort = (arr, k) => arr.length ? arr.reduce((s, d) => s + (d.netler?.[k]?.net || 0), 0) / arr.length : null;
    const son = list.slice(-3), onc = list.slice(-6, -3);
    return `<div class="card"><h4 style="margin:0 0 .6rem">${tur} ders gidişatı <span class="muted small">son 3 deneme ort.${onc.length ? " · önceki 3'e göre" : ""}</span></h4>
      ${keys.map((k) => { const a = ort(son, k), b = ort(onc, k), f = b === null ? null : a - b;
        return `<div class="mini-row"><span>${esc(DERS_ADI[k] || k)}</span><span><b>${fmt(a)}</b> ${f === null ? "" : `<span class="badge ${f >= 0 ? "ok" : "err"}">${f >= 0 ? "▲" : "▼"} ${fmt(Math.abs(f))}</span>`}</span></div>`; }).join("")}</div>`;
  };
  if (!analizli.length) {
    el.innerHTML = `<div class="grid-2" style="gap:1rem;align-items:start">${trend("TYT")}${trend("AYT")}</div>
      <div class="card empty" style="margin-top:1rem">Henüz analiz girilmiş deneme yok. Aşağıdaki listede bir denemenin <b>Analiz</b> butonuna basarak başla: yanlışlarının nedenini ve kaçırdığın konuları gir.</div>`;
    return;
  }
  const tur = { bilgi: 0, dikkat: 0, sure: 0 }, konu = {};
  analizli.forEach((d) => Object.values(d.analiz).forEach((a) => {
    Object.keys(tur).forEach((k) => (tur[k] += a[k] || 0));
    (a.konular || []).forEach((k) => (konu[k] = (konu[k] || 0) + 1));
  }));
  const top = Object.values(tur).reduce((a, b) => a + b, 0) || 1;
  const enCok = Object.entries(konu).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const baskin = Object.entries(tur).sort((a, b) => b[1] - a[1])[0];
  const oneri = { bilgi: "Kayıpların çoğu bilgi eksiğinden: aşağıdaki konuları haftalık programa konu çalışması olarak eklemek en hızlı getiriyi sağlar.",
    dikkat: "Kayıpların çoğu dikkat ve işlem hatasından: soruyu bitirince 5 saniyelik kontrol alışkanlığı ve hata defteri en etkili çözüm.",
    sure: "Kayıpların çoğu süreden: turlama tekniği ve süre tutarak blok soru çözümü öncelikli olmalı." }[baskin[0]];
  el.innerHTML = `<div class="card analiz-card"><div class="spread"><h3 style="margin:0">Deneme analizi özeti</h3><span class="muted small">Son ${analizli.length} analizli deneme</span></div>
      <div class="grid-2" style="gap:1.5rem;margin-top:1rem;align-items:start">
        <div><h4 style="margin:0 0 .6rem">Kayıpların nedeni</h4>
          <div class="stack-bar">${Object.entries(tur).map(([k, v]) => v ? `<i style="width:${(100 * v) / top}%;background:${NEDEN[k][1]}" title="${NEDEN[k][0]}: ${v}"></i>` : "").join("")}</div>
          ${Object.entries(tur).map(([k, v]) => `<div class="mini-row"><span><span class="dot" style="background:${NEDEN[k][1]}"></span>${NEDEN[k][0]}</span><b>${v} soru · %${Math.round((100 * v) / top)}</b></div>`).join("")}
          <p class="small" style="margin:.8rem 0 0;color:var(--ink-2)">💡 ${oneri}</p></div>
        <div><h4 style="margin:0 0 .6rem">En çok kaybettiren konular</h4>${enCok.length ? enCok.map(([k, n]) => `<div class="mini-row"><span>${KONU_ADI[k] || esc(k)}</span><span class="row" style="gap:.35rem;flex-wrap:nowrap"><span class="badge err">${n} deneme</span>${onKonuEkle && KONU_INFO[k] ? `<button class="btn btn-accent btn-sm" data-kekle="${esc(k)}" style="padding:.2rem .6rem">+ Görev</button>` : ""}</span></div>`).join("") : `<div class="empty">Konu işaretlenmemiş.</div>`}</div>
      </div></div>
    <div class="grid-2" style="gap:1rem;align-items:start;margin-top:1rem">${trend("TYT")}${trend("AYT")}</div>`;
  if (onKonuEkle) $$("[data-kekle]", el).forEach((b) => (b.onclick = () => onKonuEkle(KONU_INFO[b.dataset.kekle])));
}

// =====================================================================
// 2) HATA DEFTERİ (aralıklı tekrar)
// =====================================================================
const tumDersler = () => [...new Set([...Object.keys(KONULAR.TYT), ...Object.keys(KONULAR.AYT)])];
const dersKonulari = (d) => [...new Set([...(KONULAR.TYT[d] || []), ...(KONULAR.AYT[d] || [])])];

export async function renderHataDefteri(el, student, { editable, kocId }) {
  const q = editable
    ? query(collection(db, "hataDefteri"), where("ogrenciId", "==", student.id))
    : query(collection(db, "hataDefteri"), where("kocId", "==", kocId), where("ogrenciId", "==", student.id));
  let list = [];
  try { list = docs(await getDocs(q)); } catch (e) { console.error(e); }
  let filtre = "bugun", ders = "";
  const today = bugun();
  const draw = () => {
    const due = list.filter((h) => h.durum !== "ogrenildi" && (h.tekrarTarihi || "") <= today);
    const rows = list.filter((h) => (filtre === "bugun" ? due.includes(h) : filtre === "hepsi" ? true : h.durum === filtre) && (!ders || h.ders === ders))
      .sort((a, b) => (a.tekrarTarihi || "").localeCompare(b.tekrarTarihi || ""));
    const nedenSay = Object.fromEntries(Object.keys(NEDEN).map((k) => [k, list.filter((h) => h.neden === k).length]));
    el.innerHTML = `<div class="stats">
        <div class="stat"><div class="n">${list.length}</div><div class="l">Toplam soru</div></div>
        <div class="stat"><div class="n" style="color:${due.length ? "var(--brand)" : "inherit"}">${due.length}</div><div class="l">Bugün tekrar edilecek</div></div>
        <div class="stat"><div class="n">${list.filter((h) => h.durum === "ogrenildi").length}</div><div class="l">Öğrenildi</div></div>
        <div class="stat">${Object.entries(nedenSay).map(([k, v]) => `<div class="small" style="display:flex;justify-content:space-between"><span><span class="dot" style="background:${NEDEN[k][1]}"></span>${NEDEN[k][0]}</span><b>${v}</b></div>`).join("")}<div class="l" style="margin-top:.3rem">Hata nedenleri</div></div>
      </div>
      <div class="spread" style="margin-bottom:1rem"><div class="row">
        <div class="seg" id="hfSeg">${[["bugun", `Bugün (${due.length})`], ["tekrar", "Tekrarda"], ["ogrenildi", "Öğrenildi"], ["hepsi", "Hepsi"]].map(([k, v]) => `<button data-f="${k}" class="${filtre === k ? "on" : ""}">${v}</button>`).join("")}</div>
        <select id="hfDers" style="width:auto"><option value="">Tüm dersler</option>${[...new Set(list.map((h) => h.ders))].map((d) => `<option ${d === ders ? "selected" : ""}>${esc(d)}</option>`).join("")}</select></div>
        ${editable ? `<button class="btn btn-accent btn-sm" id="hfAdd">+ Soru ekle</button>` : ""}</div>
      ${rows.length ? `<div class="hata-grid">${rows.map((h) => `<div class="card hata ${h.durum === "ogrenildi" ? "ok" : ""}">
          <div class="spread"><span class="badge">${esc(h.ders)}</span><span class="small" style="color:${NEDEN[h.neden]?.[1] || "inherit"};font-weight:700">${NEDEN[h.neden]?.[0] || ""}</span></div>
          <h4>${esc(h.konu || "Konu belirtilmedi")}</h4>
          ${h.kaynak ? `<div class="muted small">📘 ${esc(h.kaynak)}</div>` : ""}
          <p>${esc(h.aciklama || "")}</p>
          ${h.link ? `<a href="${esc(h.link)}" target="_blank" rel="noopener" class="small">Soru görseli / bağlantı →</a>` : ""}
          ${h.kocNotu ? `<div class="koc-not">🧑‍🏫 ${esc(h.kocNotu)}</div>` : ""}
          <div class="spread small muted" style="margin-top:.6rem"><span>${h.durum === "ogrenildi" ? "✓ Öğrenildi" : `Sonraki tekrar: ${(h.tekrarTarihi || "") <= today ? "bugün" : trDate(h.tekrarTarihi)} · ${h.tekrarSayisi ? h.tekrarSayisi + " kez tekrar edildi" : "henüz tekrar edilmedi"}`}</span></div>
          <div class="task-actions" style="margin-top:.6rem">${editable
            ? `${h.durum !== "ogrenildi" ? `<button data-tekrar="${h.id}">✓ Tekrar ettim</button><button data-ogren="${h.id}">Öğrendim</button>` : `<button data-geri="${h.id}">Tekrara al</button>`}<button data-hsil="${h.id}">Sil</button>`
            : `<button data-knot="${h.id}">${h.kocNotu ? "Notu düzenle" : "Not ekle"}</button>`}</div>
        </div>`).join("")}</div>`
        : `<div class="card empty">${filtre === "bugun" ? "Bugün tekrar edilecek soru yok 🎉" : "Kayıt yok."}${editable && !list.length ? "<br><br>Yanlış yaptığın ya da zorlandığın soruları buraya ekle. Sistem 1, 3, 7, 14 ve 30 gün sonra tekrar önüne getirir." : ""}</div>`}`;
    $$("#hfSeg button", el).forEach((b) => (b.onclick = () => { filtre = b.dataset.f; draw(); }));
    $("#hfDers", el).onchange = (e) => { ders = e.target.value; draw(); };
    const upd = async (id, data) => { try { await updateDoc(doc(db, "hataDefteri", id), data); Object.assign(list.find((x) => x.id === id), data); draw(); } catch (e) { console.error(e); toast("Kaydedilemedi.", "err"); } };
    if (editable) {
      $("#hfAdd", el).onclick = () => hataModal(student, async (data) => { const r = await addDoc(collection(db, "hataDefteri"), data); list.push({ id: r.id, ...data }); filtre = "hepsi"; draw(); });
      $$("[data-tekrar]", el).forEach((b) => (b.onclick = () => { const h = list.find((x) => x.id === b.dataset.tekrar), n = (h.tekrarSayisi || 0) + 1;
        upd(h.id, n >= HATA_ARALIK.length ? { tekrarSayisi: n, durum: "ogrenildi" } : { tekrarSayisi: n, tekrarTarihi: iso(addDays(new Date(), HATA_ARALIK[n])) }); }));
      $$("[data-ogren]", el).forEach((b) => (b.onclick = () => upd(b.dataset.ogren, { durum: "ogrenildi" })));
      $$("[data-geri]", el).forEach((b) => (b.onclick = () => upd(b.dataset.geri, { durum: "tekrar", tekrarTarihi: today })));
      $$("[data-hsil]", el).forEach((b) => (b.onclick = async () => { if (!confirm("Silinsin mi?")) return;
        try { await deleteDoc(doc(db, "hataDefteri", b.dataset.hsil)); list = list.filter((x) => x.id !== b.dataset.hsil); draw(); } catch { toast("Silinemedi.", "err"); } }));
    } else {
      $$("[data-knot]", el).forEach((b) => (b.onclick = () => { const h = list.find((x) => x.id === b.dataset.knot);
        const m = openModal(`<h3>Koç notu</h3><p class="muted small">${esc(h.ders)} · ${esc(h.konu || "")}</p><div class="field"><textarea id="kn" maxlength="600">${esc(h.kocNotu || "")}</textarea></div><button class="btn btn-accent" id="knS">Kaydet</button>`);
        $("#knS", m.el).onclick = async () => { await upd(h.id, { kocNotu: $("#kn", m.el).value.trim() }); m.close(); }; }));
    }
  };
  draw();
}

function hataModal(student, onSave) {
  const dersler = tumDersler();
  const m = openModal(`<h3>Hata defterine soru ekle</h3>
    <div class="grid-2"><div class="field"><label>Ders</label><select id="hd_d">${dersler.map((d) => `<option>${esc(d)}</option>`).join("")}</select></div>
      <div class="field"><label>Konu</label><select id="hd_k"></select></div></div>
    <div class="field"><label>Kaynak</label><input id="hd_s" maxlength="120" placeholder="Örn. 345 TYT Matematik, s. 45, soru 12"/></div>
    <div class="field"><label>Neden yanlış yaptın?</label><div class="seg" id="hd_n">${Object.entries(NEDEN).map(([k, [ad]], i) => `<button type="button" data-v="${k}" class="${i === 0 ? "on" : ""}">${ad}</button>`).join("")}</div></div>
    <div class="field"><label>Doğru çözüm / not</label><textarea id="hd_a" maxlength="2000" placeholder="Doğru çözüm yolu, kaçırdığın nokta, formül…"></textarea></div>
    <div class="field"><label>Soru görseli bağlantısı (isteğe bağlı)</label><input id="hd_l" maxlength="500" placeholder="Google Drive / fotoğraf bağlantısı"/></div>
    <button class="btn btn-accent" id="hd_save">Ekle</button>`);
  const el = m.el;
  const fill = () => ($("#hd_k", el).innerHTML = dersKonulari($("#hd_d", el).value).map((k) => `<option>${esc(k)}</option>`).join("") + `<option value="">Diğer</option>`);
  $("#hd_d", el).onchange = fill; fill();
  let neden = "bilgi";
  $$("#hd_n button", el).forEach((b) => (b.onclick = () => { $$("#hd_n button", el).forEach((x) => x.classList.toggle("on", x === b)); neden = b.dataset.v; }));
  $("#hd_save", el).onclick = async (e) => {
    const link = $("#hd_l", el).value.trim();
    const data = { ogrenciId: student.id, kocId: student.kocId || null, ders: $("#hd_d", el).value, konu: $("#hd_k", el).value, kaynak: $("#hd_s", el).value.trim(),
      neden, aciklama: $("#hd_a", el).value.trim(), link: /^https?:\/\//.test(link) ? link : "", durum: "tekrar", tekrarSayisi: 0,
      tekrarTarihi: iso(addDays(new Date(), HATA_ARALIK[0])), createdAt: serverTimestamp() };
    e.target.disabled = true;
    try { await onSave(data); toast("Hata defterine eklendi."); m.close(); } catch (err) { console.error(err); toast("Kaydedilemedi.", "err"); e.target.disabled = false; }
  };
}

// =====================================================================
// 3) KONU TEKRAR PLANI (bugün tekrar edilecek konular)
// =====================================================================
export function tekrarListesi(takip) {
  const t = takip.konuTekrar || {}, k = takip.konular || {}, today = bugun();
  return Object.entries(t).filter(([key, v]) => (k[key] || 0) >= 2 && v.sonraki <= today).map(([key, v]) => ({ key, ...v }));
}
export async function tekrarEttim(ogrenciId, takip, key) {
  const t = { ...(takip.konuTekrar || {}) }, k = { ...(takip.konular || {}) };
  const cur = t[key] || { bitti: bugun(), n: 0 };
  const n = (cur.n || 0) + 1;
  t[key] = { ...cur, n, sonraki: iso(addDays(new Date(), ARALIK[Math.min(n, ARALIK.length - 1)])) };
  k[key] = 3; // "tekrar edildi"
  await setDoc(doc(db, "takip", ogrenciId), { konular: k, konuTekrar: t, updatedAt: serverTimestamp() }, { mergeFields: ["konular", "konuTekrar", "updatedAt"] });
  takip.konuTekrar = t; takip.konular = k;
}

// =====================================================================
// 4) KAYNAK TAKİBİ (kitaplar / test kitapçıkları)
// =====================================================================
export async function renderKaynaklar(el, student, { editable }) {
  const takip = await getTakip(student.id);
  let list = [...(takip.kaynaklar || [])];
  const save = async () => { await setDoc(doc(db, "takip", student.id), { kaynaklar: list, updatedAt: serverTimestamp() }, { mergeFields: ["kaynaklar", "updatedAt"] }); };
  const draw = () => {
    const bitti = list.filter((k) => k.biten >= k.toplam).length;
    el.innerHTML = `<div class="spread" style="margin-bottom:1rem"><div><h3 style="margin:0">Kaynaklarım</h3><span class="muted small">${list.length} kaynak · ${bitti} bitti</span></div>
        ${editable ? `<button class="btn btn-accent btn-sm" id="kAdd">+ Kaynak ekle</button>` : ""}</div>
      ${list.length ? `<div class="kaynak-grid">${list.map((k, i) => { const p = k.toplam ? Math.min(100, Math.round((100 * k.biten) / k.toplam)) : 0;
        return `<div class="card kaynak"><div class="spread"><span class="badge">${esc(k.ders)}</span>${p >= 100 ? `<span class="badge ok">Bitti ✓</span>` : `<span class="muted small">%${p}</span>`}</div>
          <h4>${esc(k.ad)}</h4>
          <div class="progress"><i style="width:${p}%"></i></div>
          <div class="spread" style="margin-top:.6rem"><span class="small"><b>${k.biten}</b> / ${k.toplam} ${esc(k.birim)}</span>
            ${editable ? `<div class="row" style="gap:.3rem"><button class="btn btn-ghost btn-sm" data-dec="${i}">−</button><button class="btn btn-primary btn-sm" data-inc="${i}">+1</button><button class="btn btn-ghost btn-sm" data-ksil="${i}" title="Sil">✕</button></div>` : ""}</div></div>`; }).join("")}</div>`
        : `<div class="card empty">${editable ? "Kullandığın soru bankalarını ve test kitaplarını ekle; bitirdikçe ilerlemeni işaretle. Koçun hangi kaynakta nerede olduğunu görür." : "Öğrenci henüz kaynak eklememiş."}</div>`}`;
    if (!editable) return;
    $("#kAdd", el).onclick = () => {
      const m = openModal(`<h3>Kaynak ekle</h3>
        <div class="field"><label>Kaynak adı</label><input id="ka_a" maxlength="100" placeholder="Örn. 345 TYT Matematik Soru Bankası"/></div>
        <div class="grid-3"><div class="field"><label>Ders</label><select id="ka_d">${tumDersler().map((d) => `<option>${esc(d)}</option>`).join("")}</select></div>
          <div class="field"><label>Toplam</label><input id="ka_t" type="number" min="1" max="2000" value="50"/></div>
          <div class="field"><label>Birim</label><select id="ka_b"><option>test</option><option>sayfa</option><option>ünite</option><option>deneme</option></select></div></div>
        <button class="btn btn-accent" id="ka_s">Ekle</button>`);
      $("#ka_s", m.el).onclick = async () => {
        const ad = $("#ka_a", m.el).value.trim(); if (!ad) return toast("Kaynak adını yaz.", "err");
        list.push({ ad, ders: $("#ka_d", m.el).value, toplam: Math.max(1, Number($("#ka_t", m.el).value) || 1), birim: $("#ka_b", m.el).value, biten: 0 });
        try { await save(); m.close(); draw(); } catch (e) { console.error(e); toast("Kaydedilemedi.", "err"); list.pop(); }
      };
    };
    let t = null;
    const bump = (i, d) => { list[i].biten = Math.max(0, Math.min(list[i].toplam, list[i].biten + d)); draw(); clearTimeout(t); t = setTimeout(() => save().catch(() => toast("Kaydedilemedi.", "err")), 600); };
    $$("[data-inc]", el).forEach((b) => (b.onclick = () => bump(+b.dataset.inc, 1)));
    $$("[data-dec]", el).forEach((b) => (b.onclick = () => bump(+b.dataset.dec, -1)));
    $$("[data-ksil]", el).forEach((b) => (b.onclick = async () => { if (!confirm("Kaynak silinsin mi?")) return; list.splice(+b.dataset.ksil, 1); await save().catch(() => {}); draw(); }));
  };
  draw();
}

// =====================================================================
// 5) ÖZET (öğrenci panelinin açılış ekranı)
// =====================================================================
export async function renderOzet(el, me, { coach, gorevler, onToggleTask, goTab }) {
  const today = bugun();
  const [takip, hataSnap, denSnap, soruSnap] = await Promise.all([
    getTakip(me.id),
    getDocs(query(collection(db, "hataDefteri"), where("ogrenciId", "==", me.id))).catch(() => ({ docs: [] })),
    getDocs(query(collection(db, "denemeler"), where("ogrenciId", "==", me.id))).catch(() => ({ docs: [] })),
    getDocs(query(collection(db, "soruKayit"), where("ogrenciId", "==", me.id))).catch(() => ({ docs: [] })),
  ]);
  const hatalar = docs(hataSnap).filter((h) => h.durum !== "ogrenildi" && (h.tekrarTarihi || "") <= today);
  const den = docs(denSnap).sort((a, b) => a.tarih.localeCompare(b.tarih));
  const soru = docs(soruSnap);
  const bugunSoru = soru.find((s) => s.tarih === today);
  const tekrar = tekrarListesi(takip);
  const bugunGorev = gorevler.filter((g) => g.tarih === today);
  const gun = Math.max(0, Math.floor((new Date(SINAV.tarih) - Date.now()) / 86400000));
  const sonT = [...den].reverse().find((d) => d.tur === "TYT"), sonA = [...den].reverse().find((d) => d.tur === "AYT");
  const hedef = takip.hedef || {};
  const analizsiz = den.filter((d) => !d.analiz || !Object.keys(d.analiz).length).slice(-3).reverse();
  const yedi = [...Array(7)].map((_, i) => iso(addDays(new Date(), -i)));
  const hafta = soru.filter((s) => yedi.includes(s.tarih)).reduce((a, s) => a + (s.toplam || 0), 0);
  const haftaSure = soru.filter((s) => yedi.includes(s.tarih)).reduce((a, s) => a + (s.sure || 0), 0);
  const KEY_ADI = {}; for (const sin of ["TYT", "AYT"]) for (const [d, ks] of Object.entries(KONULAR[sin])) for (const k of ks) KEY_ADI[konuKey(sin, d, k)] = [k, `${sin} ${d}`];

  el.innerHTML = `
    <div class="ozet-top">
      <div class="ozet-cd"><b>${gun}</b><span>gün kaldı<br><small>${SINAV.ad}</small></span></div>
      <div class="stat"><div class="n">${bugunSoru?.toplam || 0}</div><div class="l">Bugün çözülen soru</div></div>
      <div class="stat"><div class="n">${hafta}</div><div class="l">Son 7 gün soru · ${Math.round(haftaSure / 60)} sa çalışma</div></div>
      <div class="stat"><div class="n">${sonT ? fmt(sonT.toplam) : "–"}${hedef.tyt ? `<small class="muted" style="font-size:.9rem"> / ${fmt(hedef.tyt)}</small>` : ""}</div><div class="l">Son TYT${hedef.tyt ? " / hedef" : ""}</div></div>
    </div>
    <div id="ozetSeri" style="margin-bottom:1rem"></div>
    <div class="ozet-grid">
      <div id="ozetProgram"></div>
      <div class="card"><div class="spread"><h3 style="margin:0">📋 Bugünün görevleri</h3><button class="btn btn-ghost btn-sm" data-go="hafta">Haftaya bak →</button></div>
        ${bugunGorev.length ? bugunGorev.map((t) => `<label class="ozet-task ${t.tamam ? "done" : ""}"><input type="checkbox" data-ot="${t.id}" ${t.tamam ? "checked" : ""}/><span><b>${esc(t.ders)}${t.konu ? " – " + esc(t.konu) : ""}</b>${t.hedef ? `<small class="muted"> · ${esc(t.hedef)}</small>` : ""}</span></label>`).join("")
          : `<div class="empty">Bugün için görev yok.${coach ? " Koçun programı yazınca burada görünecek." : ""}</div>`}</div>

      <div class="card"><div class="spread"><h3 style="margin:0">🔁 Bugün tekrar edilecek konular</h3><button class="btn btn-ghost btn-sm" data-go="konu">Konular →</button></div>
        ${tekrar.length ? tekrar.map((t) => `<div class="mini-row"><span>${esc(KEY_ADI[t.key]?.[0] || t.key)} <span class="muted small">· ${esc(KEY_ADI[t.key]?.[1] || "")} · ${(t.n || 0) + 1}. tekrar</span></span><button class="btn btn-primary btn-sm" data-tk="${t.key}">Tekrar ettim</button></div>`).join("")
          : `<div class="empty">Bugün tekrar edilecek konu yok. Konu takibinde bir konuyu "bitti" yaptığında tekrar planı otomatik oluşur.</div>`}</div>

      <div class="card"><div class="spread"><h3 style="margin:0">📕 Hata defteri</h3><button class="btn btn-ghost btn-sm" data-go="hata">Deftere git →</button></div>
        ${hatalar.length ? `<p style="margin:.6rem 0">Bugün <b>${hatalar.length}</b> soru tekrar bekliyor.</p>${hatalar.slice(0, 4).map((h) => `<div class="mini-row"><span>${esc(h.ders)} · ${esc(h.konu || "")}</span><span class="small muted">${esc(h.kaynak || "")}</span></div>`).join("")}`
          : `<div class="empty">Bugün tekrar edilecek soru yok.</div>`}</div>

      <div class="card"><div class="spread"><h3 style="margin:0">📊 Denemeler</h3><button class="btn btn-ghost btn-sm" data-go="deneme">Denemeler →</button></div>
        ${hedef.bolum ? `<p class="small" style="margin:.6rem 0">🎯 <b>${esc(hedef.bolum)}</b></p>` : ""}
        <div class="mini-row"><span>Son TYT</span><b>${sonT ? fmt(sonT.toplam) + (hedef.tyt ? ` / ${fmt(hedef.tyt)}` : "") : "–"}</b></div>
        <div class="mini-row"><span>Son AYT</span><b>${sonA ? fmt(sonA.toplam) + (hedef.ayt ? ` / ${fmt(hedef.ayt)}` : "") : "–"}</b></div>
        ${analizsiz.length ? `<div class="koc-not" style="margin-top:.8rem">🔍 Analizi yapılmamış ${analizsiz.length} deneme var. Deneme analizi, netlerin neden değişmediğini gösterir.</div>` : ""}</div>
    </div>
    <div class="card" style="margin-top:1rem"><h3 style="margin-top:0">✅ YKS hazırlık rutini</h3>
      <div class="rutin">${[
        ["Her gün", "Koçunun yazdığı görevleri tamamla ve işaretle", "hafta"],
        ["Her gün", "Çözdüğün soruları ve çalışma süreni gir", "soru"],
        ["Her gün", "Yanlış yaptığın soruları hata defterine ekle", "hata"],
        ["Her gün", "Tekrar zamanı gelen konuları ve soruları tekrar et", "konu"],
        ["Haftada 1", "Tam deneme çöz, netlerini gir ve analizini yap", "deneme"],
        ["Haftada 1", "Koçunla birebir görüşme: analiz ve yeni hafta", "gorusme"],
        ["Sürekli", "Biten konuları konu takibinde işaretle", "konu"],
        ["Sürekli", "Kaynaklarda nerede kaldığını güncelle", "kaynak"],
      ].map(([s, t, g]) => `<button class="rutin-item" data-go="${g}"><span class="badge">${s}</span><span>${t}</span><span class="go">→</span></button>`).join("")}</div></div>`;

  $$("[data-go]", el).forEach((b) => (b.onclick = () => goTab(b.dataset.go)));
  $$("[data-ot]", el).forEach((cb) => (cb.onchange = () => onToggleTask(cb.dataset.ot, cb.checked)));
  $$("[data-tk]", el).forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    try { await tekrarEttim(me.id, takip, b.dataset.tk); toast("Harika! Sonraki tekrar planlandı."); b.closest(".mini-row").remove(); }
    catch (e) { console.error(e); toast("Kaydedilemedi.", "err"); b.disabled = false; }
  }));
  return { takip, hata: docs(hataSnap), den, soru };
}
