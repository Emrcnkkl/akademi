// Öğrenci ve koç panellerinde ortak kullanılan bileşenler:
// konu takibi, günlük soru sayacı, hedef kartı, mesajlaşma, paket (ödeme) bilgisi.
import { db } from "./firebase.js";
import {
  collection, query, where, getDocs, getDoc, doc, setDoc, addDoc, updateDoc, onSnapshot, serverTimestamp, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { $, $$, esc, toast, iso, addDays, trDate, openModal, ALANLAR } from "./ui.js";
import { KONULAR, AYT_ALAN, SORU_DERSLERI, konuKey } from "./konular.js";

const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const fmt = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString("tr-TR");

// =====================================================================
// TAKİP BELGESİ (konular + hedef)
// =====================================================================
export async function getTakip(ogrenciId) {
  try { const s = await getDoc(doc(db, "takip", ogrenciId)); return s.exists() ? s.data() : {}; }
  catch (e) { console.warn(e); return {}; }
}
async function saveTakip(ogrenciId, data) {
  await setDoc(doc(db, "takip", ogrenciId), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

// =====================================================================
// KONU TAKİBİ  — durum: 0 başlanmadı · 1 çalışılıyor · 2 bitti · 3 tekrar edildi
// =====================================================================
const DURUM = [["Başlanmadı", "gray"], ["Çalışılıyor", "warn"], ["Bitti", "ok"], ["Tekrar edildi", "ok"]];

export async function renderKonular(el, student, { editable }) {
  const takip = await getTakip(student.id);
  const state = { ...(takip.konular || {}) };
  const tekrar = { ...(takip.konuTekrar || {}) };
  const bugun = iso(new Date());
  let sinav = "TYT";
  const aytDersler = AYT_ALAN[student.alan] || AYT_ALAN.SAY;

  const progress = (sin, dersler) => {
    let toplam = 0, bitti = 0;
    dersler.forEach((d) => KONULAR[sin][d].forEach((k) => { toplam++; if ((state[konuKey(sin, d, k)] || 0) >= 2) bitti++; }));
    return { toplam, bitti, pct: toplam ? Math.round((100 * bitti) / toplam) : 0 };
  };
  const draw = () => {
    const dersler = sinav === "TYT" ? Object.keys(KONULAR.TYT) : aytDersler;
    const pT = progress("TYT", Object.keys(KONULAR.TYT)), pA = progress("AYT", aytDersler);
    el.innerHTML = `
      <div class="stats" style="grid-template-columns:repeat(2,1fr)">
        <div class="stat"><div class="n">%${pT.pct}</div><div class="l">TYT konuları bitti (${pT.bitti}/${pT.toplam})</div><div class="progress" style="margin-top:.5rem"><i style="width:${pT.pct}%"></i></div></div>
        <div class="stat"><div class="n">%${pA.pct}</div><div class="l">AYT ${esc(ALANLAR[student.alan] || "")} konuları (${pA.bitti}/${pA.toplam})</div><div class="progress" style="margin-top:.5rem"><i style="width:${pA.pct}%"></i></div></div>
      </div>
      <div class="spread" style="margin-bottom:1rem">
        <div class="seg" id="kSeg"><button data-s="TYT" class="${sinav === "TYT" ? "on" : ""}">TYT</button><button data-s="AYT" class="${sinav === "AYT" ? "on" : ""}">AYT</button></div>
        <span class="muted small">${editable ? "Konuya tıkladıkça durumu değişir: başlanmadı → çalışılıyor → bitti → tekrar edildi" : "Öğrencinin işaretlediği konu durumları"}</span>
      </div>
      <div class="konu-grid">${dersler.map((d) => {
        const ks = KONULAR[sinav][d];
        const b = ks.filter((k) => (state[konuKey(sinav, d, k)] || 0) >= 2).length;
        return `<div class="card konu-card"><div class="spread"><h4 style="margin:0">${esc(d)}</h4><span class="badge ${b === ks.length ? "ok" : "gray"}">${b}/${ks.length}</span></div>
          <div class="progress" style="margin:.5rem 0 .7rem"><i style="width:${Math.round((100 * b) / ks.length)}%"></i></div>
          ${ks.map((k) => { const key = konuKey(sinav, d, k), v = state[key] || 0;
            const t = tekrar[key], due = t && v >= 2 ? (t.sonraki <= bugun ? `<span class="kdue now">🔁 Tekrar zamanı</span>` : `<span class="kdue">🔁 ${trDate(t.sonraki).slice(0, 5)}</span>`) : "";
            return `<button class="konu k${v}" data-k="${key}" ${editable ? "" : "disabled"}><span class="kdot"></span><span class="kname">${esc(k)}${due}</span><span class="kst">${DURUM[v][0]}</span></button>`; }).join("")}
        </div>`;
      }).join("")}</div>`;
    $$("#kSeg button", el).forEach((b) => (b.onclick = () => { sinav = b.dataset.s; draw(); }));
    if (editable) $$(".konu", el).forEach((b) => (b.onclick = () => toggle(b)));
  };
  let timer = null;
  const toggle = (b) => {
    const k = b.dataset.k, v = ((state[k] || 0) + 1) % 4;
    state[k] = v;
    // tekrar planı: konu "bitti" olunca 1 gün sonra ilk tekrar; geri alınırsa plan silinir
    if (v === 2 && !tekrar[k]) tekrar[k] = { bitti: bugun, n: 0, sonraki: iso(addDays(new Date(), 1)) };
    if (v < 2) delete tekrar[k];
    b.className = `konu k${v}`; b.querySelector(".kst").textContent = DURUM[v][0];
    clearTimeout(timer);
    timer = setTimeout(async () => {   // hızlı tıklamaları tek kayıtta topla
      try { await setDoc(doc(db, "takip", student.id), { konular: state, konuTekrar: tekrar, updatedAt: serverTimestamp() }, { mergeFields: ["konular", "konuTekrar", "updatedAt"] }); draw(); } catch (e) { console.error(e); toast("Kaydedilemedi.", "err"); }
    }, 700);
  };
  draw();
}

// =====================================================================
// HEDEF KARTI (hedef bölüm + hedef netler) — deneme sekmesinin üstünde
// =====================================================================
export async function renderHedef(el, student, denemeler, { editable }) {
  const hedef = (await getTakip(student.id)).hedef || {};
  const son = (tur) => [...denemeler].filter((d) => d.tur === tur).sort((a, b) => a.tarih.localeCompare(b.tarih)).pop();
  const sT = son("TYT"), sA = son("AYT");
  const gap = (cur, h) => (h ? (cur ? (h - cur.toplam > 0 ? `<span class="badge warn">${fmt(h - cur.toplam)} net kaldı</span>` : `<span class="badge ok">Hedefe ulaşıldı 🎉</span>`) : `<span class="badge gray">Deneme yok</span>`) : "");
  el.innerHTML = `<div class="card hedef-card">
    <div class="spread"><div><span class="kicker" style="margin:0">Hedefim</span><h3 style="margin:.2rem 0 0">${esc(hedef.bolum || (editable ? "Hedef bölümünü yaz" : "Hedef belirlenmedi"))}</h3></div>
      ${editable ? `<button class="btn btn-ghost btn-sm" id="hEdit">Düzenle</button>` : ""}</div>
    <div class="grid-2" style="gap:1rem;margin-top:1rem">
      <div class="hedef-net"><span class="muted small">TYT</span><div><b>${sT ? fmt(sT.toplam) : "–"}</b> / <span>${hedef.tyt ? fmt(hedef.tyt) : "–"}</span></div>${gap(sT, hedef.tyt)}</div>
      <div class="hedef-net"><span class="muted small">AYT</span><div><b>${sA ? fmt(sA.toplam) : "–"}</b> / <span>${hedef.ayt ? fmt(hedef.ayt) : "–"}</span></div>${gap(sA, hedef.ayt)}</div>
    </div></div>`;
  if (!editable) return;
  $("#hEdit", el).onclick = () => {
    const m = openModal(`<h3>Hedefim</h3>
      <div class="field"><label>Hedef üniversite / bölüm</label><input id="h_b" maxlength="120" value="${esc(hedef.bolum || "")}" placeholder="Örn. İTÜ Bilgisayar Mühendisliği"/></div>
      <div class="grid-2"><div class="field"><label>Hedef TYT neti</label><input id="h_t" type="number" min="0" max="120" step=".25" value="${hedef.tyt || ""}"/></div>
        <div class="field"><label>Hedef AYT neti</label><input id="h_a" type="number" min="0" max="80" step=".25" value="${hedef.ayt || ""}"/></div></div>
      <p class="muted small">Hedef netleri koçunla birlikte belirleyebilirsin.</p>
      <button class="btn btn-accent" id="h_s">Kaydet</button>`);
    $("#h_s", m.el).onclick = async () => {
      const h = { bolum: $("#h_b", m.el).value.trim(), tyt: Number($("#h_t", m.el).value) || null, ayt: Number($("#h_a", m.el).value) || null };
      try { await saveTakip(student.id, { hedef: h }); m.close(); toast("Hedef kaydedildi."); renderHedef(el, student, denemeler, { editable }); }
      catch (e) { console.error(e); toast("Kaydedilemedi.", "err"); }
    };
  };
}

// =====================================================================
// GÜNLÜK SORU SAYACI
// =====================================================================
export async function renderSorular(el, student, { editable, kocId }) {
  const q = editable
    ? query(collection(db, "soruKayit"), where("ogrenciId", "==", student.id))
    : query(collection(db, "soruKayit"), where("kocId", "==", kocId), where("ogrenciId", "==", student.id));
  let kayit = [];
  try { kayit = docs(await getDocs(q)); } catch (e) { console.error(e); }
  const byDate = Object.fromEntries(kayit.map((k) => [k.tarih, k]));
  let gun = iso(new Date());
  const saat = (dk) => (dk ? `${Math.floor(dk / 60)} sa ${dk % 60 ? (dk % 60) + " dk" : ""}`.trim() : "0 sa");

  const draw = () => {
    const days = [...Array(14)].map((_, i) => iso(addDays(new Date(), i - 13)));
    const max = Math.max(50, ...days.map((d) => byDate[d]?.toplam || 0));
    const hafta = days.slice(7).reduce((s, d) => s + (byDate[d]?.toplam || 0), 0);
    const onceki = days.slice(0, 7).reduce((s, d) => s + (byDate[d]?.toplam || 0), 0);
    const cur = byDate[gun]?.dersler || {};
    // ders bazında son 7 gün
    const dersTop = {};
    days.slice(7).forEach((d) => Object.entries(byDate[d]?.dersler || {}).forEach(([k, v]) => (dersTop[k] = (dersTop[k] || 0) + v)));
    el.innerHTML = `
      <div class="stats">
        <div class="stat"><div class="n">${(byDate[iso(new Date())]?.toplam || 0).toLocaleString("tr-TR")}</div><div class="l">Bugün çözülen</div></div>
        <div class="stat"><div class="n">${hafta.toLocaleString("tr-TR")}</div><div class="l">Son 7 gün</div></div>
        <div class="stat"><div class="n">${saat(days.slice(7).reduce((s, d) => s + (byDate[d]?.sure || 0), 0))}</div><div class="l">Son 7 gün çalışma süresi</div></div>
        <div class="stat"><div class="n">${onceki ? (hafta >= onceki ? "▲" : "▼") + " %" + Math.abs(Math.round((100 * (hafta - onceki)) / onceki)) : "–"}</div><div class="l">Önceki 7 güne göre</div></div>
      </div>
      <div class="grid-2" style="gap:1rem;align-items:start">
        <div class="card"><h3 style="margin-top:0">Son 14 gün</h3>
          <div class="bars">${days.map((d) => { const v = byDate[d]?.toplam || 0;
            return `<div class="bar-col ${d === gun ? "sel" : ""}" data-g="${d}" title="${trDate(d)}: ${v} soru${byDate[d]?.sure ? ", " + saat(byDate[d].sure) : ""}"><span class="bv">${v || ""}</span><i style="height:${Math.round((100 * v) / max)}%"></i><span class="bl">${trDate(d).slice(0, 2)}</span></div>`; }).join("")}</div>
          <div style="margin-top:1rem">${Object.entries(dersTop).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="mini-row"><span>${esc(k)}</span><b>${v}</b></div>`).join("") || `<div class="empty">Son 7 günde kayıt yok.</div>`}</div>
        </div>
        ${editable ? `<div class="card"><div class="spread"><h3 style="margin:0">Soru gir</h3><input type="date" id="sGun" value="${gun}" max="${iso(new Date())}" style="width:auto"/></div>
          <p class="muted small">Gün içinde çözdüğün soru sayılarını gir. Aynı güne tekrar girersen güncellenir.</p>
          <div class="soru-grid">${SORU_DERSLERI.map((d) => `<label class="soru-in"><span>${esc(d)}</span><input type="number" min="0" max="500" inputmode="numeric" data-d="${esc(d)}" value="${cur[d] || ""}"/></label>`).join("")}</div>
          <label class="soru-in" style="margin-top:.8rem;padding-top:.8rem;border-top:1px solid var(--line)"><span>⏱️ Toplam çalışma süresi (dakika)</span><input type="number" min="0" max="1200" step="5" inputmode="numeric" id="sSure" value="${byDate[gun]?.sure || ""}"/></label>
          <div class="spread" style="margin-top:1rem"><b>Toplam: <span id="sTop">${byDate[gun]?.toplam || 0}</span> soru</b><button class="btn btn-accent" id="sSave">Kaydet</button></div></div>`
          : `<div class="card"><h3 style="margin-top:0">Gün detayı · ${trDate(gun)}</h3>${byDate[gun]?.sure ? `<div class="mini-row"><span>⏱️ Çalışma süresi</span><b>${saat(byDate[gun].sure)}</b></div>` : ""}${Object.entries(cur).map(([k, v]) => `<div class="mini-row"><span>${esc(k)}</span><b>${v}</b></div>`).join("") || `<div class="empty">Bu gün için kayıt yok.</div>`}</div>`}
      </div>`;
    $$(".bar-col", el).forEach((b) => b.addEventListener("click", () => { gun = b.dataset.g; draw(); }));
    if (!editable) return;
    $("#sGun", el).onchange = (e) => { gun = e.target.value; draw(); };
    const sum = () => $$("[data-d]", el).reduce((s, i) => s + Math.max(0, Number(i.value) || 0), 0);
    el.querySelector(".soru-grid").addEventListener("input", () => ($("#sTop", el).textContent = sum()));
    $("#sSave", el).onclick = async (e) => {
      const dersler = {}; $$("[data-d]", el).forEach((i) => { const v = Math.max(0, Number(i.value) || 0); if (v) dersler[i.dataset.d] = v; });
      const data = { ogrenciId: student.id, kocId: student.kocId || null, tarih: gun, dersler, toplam: sum(), sure: Math.max(0, Number($("#sSure", el).value) || 0), updatedAt: serverTimestamp() };
      e.target.disabled = true;
      try { await setDoc(doc(db, "soruKayit", `${student.id}_${gun}`), data); byDate[gun] = data; toast("Kaydedildi."); draw(); }
      catch (err) { console.error(err); toast("Kaydedilemedi.", "err"); e.target.disabled = false; }
    };
  };
  draw();
}

// =====================================================================
// MESAJLAŞMA (canlı)
// =====================================================================
export function renderChat(el, { me, ogrenciId, kocId, karsiAd, asCoach }) {
  if (!kocId) { el.innerHTML = `<div class="card empty">Koç eşleştirmen yapıldığında buradan koçunla yazışabilirsin.</div>`; return () => {}; }
  el.innerHTML = `<div class="card chat">
      <div class="chat-head"><span class="avatar">${esc((karsiAd || "?").split(" ").map((p) => p[0]).join("").slice(0, 2))}</span><div><b>${esc(karsiAd || "")}</b><div class="muted small">${asCoach ? "Öğrencin" : "Koçun"}</div></div></div>
      <div class="chat-body" id="cBody"><div class="empty">Yükleniyor…</div></div>
      <form class="chat-form" id="cForm"><textarea id="cText" rows="1" maxlength="1000" placeholder="Mesaj yaz…"></textarea><button class="btn btn-accent" type="submit">Gönder</button></form>
    </div>`;
  const body = $("#cBody", el), text = $("#cText", el);
  const q = asCoach
    ? query(collection(db, "mesajlar"), where("kocId", "==", kocId), where("ogrenciId", "==", ogrenciId))
    : query(collection(db, "mesajlar"), where("ogrenciId", "==", ogrenciId));
  const unsub = onSnapshot(q, (snap) => {
    const list = docs(snap).filter((m) => m.kocId === kocId)
      .sort((a, b) => (a.createdAt?.seconds ?? 9e12) - (b.createdAt?.seconds ?? 9e12));
    let lastDay = "";
    body.innerHTML = list.length ? list.map((m) => {
      const d = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
      const day = d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
      const sep = day !== lastDay ? `<div class="chat-day">${day}</div>` : ""; lastDay = day;
      return `${sep}<div class="msg ${m.from === me.id ? "me" : ""}"><p>${esc(m.text)}</p><span>${d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}${m.from === me.id ? (m.okundu ? " ✓✓" : " ✓") : ""}</span></div>`;
    }).join("") : `<div class="empty">Henüz mesaj yok. İlk mesajı sen yaz 👋</div>`;
    body.scrollTop = body.scrollHeight;
    // gelen okunmamışları okundu yap
    const unread = list.filter((m) => m.from !== me.id && !m.okundu);
    if (unread.length) { const b = writeBatch(db); unread.forEach((m) => b.update(doc(db, "mesajlar", m.id), { okundu: true })); b.commit().catch(() => {}); }
  }, (err) => { console.error(err); body.innerHTML = `<div class="empty">Mesajlar yüklenemedi (${esc(err.code || "")}).</div>`; });
  const send = async () => {
    const t = text.value.trim(); if (!t) return;
    text.value = ""; text.style.height = "";
    try { await addDoc(collection(db, "mesajlar"), { ogrenciId, kocId, from: me.id, text: t, okundu: false, createdAt: serverTimestamp() }); }
    catch (e) { console.error(e); toast("Gönderilemedi.", "err"); text.value = t; }
  };
  $("#cForm", el).addEventListener("submit", (e) => { e.preventDefault(); send(); });
  text.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
  text.addEventListener("input", () => { text.style.height = ""; text.style.height = Math.min(140, text.scrollHeight) + "px"; });
  return unsub;
}

// Okunmamış mesaj sayısı (sekme rozetleri için)
export function watchUnread({ me, asCoach }, cb) {
  const q = asCoach ? query(collection(db, "mesajlar"), where("kocId", "==", me.id)) : query(collection(db, "mesajlar"), where("ogrenciId", "==", me.id));
  return onSnapshot(q, (snap) => {
    const byStu = {};
    docs(snap).forEach((m) => { if (m.from !== me.id && !m.okundu) byStu[m.ogrenciId] = (byStu[m.ogrenciId] || 0) + 1; });
    cb(byStu);
  }, (e) => console.warn(e));
}

// =====================================================================
// PAKETİM (öğrenci kendi dönem/ödeme bilgisini görür)
// =====================================================================
export async function renderPaket(el, me) {
  let list = [];
  try { list = docs(await getDocs(query(collection(db, "odemeler"), where("ogrenciId", "==", me.id)))); } catch (e) { console.warn(e); }
  list.sort((a, b) => (b.bitis || "").localeCompare(a.bitis || ""));
  const aktif = list[0];
  const kalan = aktif ? Math.ceil((new Date(aktif.bitis + "T23:59") - new Date()) / 86400000) : null;
  el.innerHTML = `<div class="card"><h3 style="margin-top:0">Paketim</h3>${aktif
    ? `<div class="mini-row"><span>Paket</span><b>${esc(aktif.paket || "Birebir Koçluk")}</b></div>
       <div class="mini-row"><span>Dönem</span><b>${trDate(aktif.baslangic)} – ${trDate(aktif.bitis)}</b></div>
       <div class="mini-row"><span>Durum</span><b>${kalan >= 0 ? `${kalan} gün kaldı` : "Dönem bitti"}</b></div>
       <div class="mini-row"><span>Ödeme</span>${aktif.durum === "odendi" ? `<span class="badge ok">Ödendi</span>` : `<span class="badge warn">Bekliyor</span>`}</div>`
    : `<div class="empty">Henüz bir dönem kaydı yok.</div>`}</div>`;
}
