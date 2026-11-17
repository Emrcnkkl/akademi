import { auth, db, secondaryAuth } from "./firebase.js";
import {
  onAuthStateChanged, signOut, createUserWithEmailAndPassword, sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, query, orderBy, where, getDocs, getDoc, doc, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch, deleteField,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { $, $$, esc, fillBrand, toast, openModal, tsStr, trDate, ALANLAR, randomPassword, iso, monday, addDays } from "./ui.js";
import { BRAND, KOCLAR, HIKAYELER } from "./config.js";

fillBrand();
const ROL_ADI = { ogrenci: "Öğrenci", koc: "Koç", admin: "Yönetici" };
const DURUM = { yeni: ["Yeni", "warn"], arandi: ["Arandı", ""], gorusme: ["Görüşme yapıldı", ""], kabul: ["Kabul / hesap açıldı", "ok"], red: ["Olumsuz", "gray"] };
const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const initials = (ad = "") => ad.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const alanAdi = (a) => ALANLAR[a] || (a === "BELIRSIZ" ? "Belirsiz" : a || "-");

let users = [], ogrBas = [], menBas = [], raporlar = [], odemeler = [], haftaGorev = [], gorusme7 = [], tab = "genel";
const waLink = (tel) => { let t = String(tel || "").replace(/\D/g, ""); if (t.startsWith("0")) t = "9" + t; if (t.length === 10) t = "90" + t; return `https://wa.me/${t}`; };
const koclar = () => users.filter((u) => u.rol === "koc" && u.aktif !== false);
const ogrenciSayisi = (kocId) => users.filter((u) => u.rol === "ogrenci" && u.kocId === kocId && u.aktif !== false).length;

$("#logoutBtn").onclick = () => signOut(auth);
$$("#aTabs button").forEach((b) => b.addEventListener("click", () => { $$("#aTabs button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); tab = b.dataset.t; draw(); }));
$("#newUserBtn").onclick = () => userModal(null, {});

onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "portal.html"; return; }
  try {
    const role = await getDoc(doc(db, "roles", user.uid));
    if (!role.exists() || role.data().role !== "admin") { location.href = "portal.html"; return; }
    const me = await getDoc(doc(db, "users", user.uid));
    const ad = me.exists() ? me.data().ad : user.email;
    $("#meName").textContent = ad; $("#meAvatar").textContent = initials(ad);
    $("#loading").classList.add("hidden"); $("#appView").classList.remove("hidden");
    await loadAll(); draw();
  } catch (err) { console.error(err); toast("Yetki kontrolü başarısız: " + err.code, "err"); }
});

async function loadAll() {
  const [u, o, m, r] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(query(collection(db, "ogrenciBasvurulari"), orderBy("createdAt", "desc"))),
    getDocs(query(collection(db, "mentorBasvurulari"), orderBy("createdAt", "desc"))),
    getDocs(collection(db, "veliRaporlari")),
  ]);
  // ödemeler + koç performansı için bu haftanın görevleri ve son 7 günün görüşmeleri
  const pazartesi = iso(monday()), pazar = iso(addDays(monday(), 6)), yediGun = iso(addDays(new Date(), -7));
  const [od, hg, gr] = await Promise.all([
    getDocs(collection(db, "odemeler")).catch(() => ({ docs: [] })),
    getDocs(query(collection(db, "gorevler"), where("tarih", ">=", pazartesi), where("tarih", "<=", pazar))).catch(() => ({ docs: [] })),
    getDocs(query(collection(db, "gorusmeler"), where("tarih", ">=", yediGun))).catch(() => ({ docs: [] })),
  ]);
  odemeler = docs(od); haftaGorev = docs(hg); gorusme7 = docs(gr);
  raporlar = docs(r).sort((a, b) => (b.hafta || "").localeCompare(a.hafta || "") || (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
  const nr = raporlar.filter((x) => x.durum === "bekliyor").length;
  $("#cntRap").textContent = nr || ""; $("#cntRap").classList.toggle("hidden", !nr);
  users = docs(u).sort((a, b) => (a.ad || "").localeCompare(b.ad || "", "tr"));
  ogrBas = docs(o); menBas = docs(m);
  const no = ogrBas.filter((x) => x.durum === "yeni").length, nm = menBas.filter((x) => x.durum === "yeni").length;
  $("#cntOgr").textContent = no || ""; $("#cntOgr").classList.toggle("hidden", !no);
  $("#cntMen").textContent = nm || ""; $("#cntMen").classList.toggle("hidden", !nm);
  const uyari = users.filter((u) => u.rol === "ogrenci" && u.aktif !== false).filter((u) => { const k = kalanGun(sonDonem(u.id)); return k !== null && k <= 7; }).length;
  $("#cntOde").textContent = uyari || ""; $("#cntOde").classList.toggle("hidden", !uyari);
}
async function reload() { await loadAll(); draw(); }

function draw() {
  const body = $("#aBody");
  if (tab === "genel") drawGenel(body);
  else if (tab === "ogrBas") drawBasvuru(body, "ogrenciBasvurulari", ogrBas, "ogrenci");
  else if (tab === "mentorBas") drawBasvuru(body, "mentorBasvurulari", menBas, "koc");
  else if (tab === "rapor") drawRaporlar(body);
  else if (tab === "odeme") drawOdemeler(body);
  else if (tab === "hakedis") drawHakedis(body);
  else if (tab === "duyuru") drawDuyurular(body);
  else if (tab === "site") drawSite(body);
  else drawUsers(body);
}

// ============ GENEL BAKIŞ ============
const TL = (n) => (Number(n) || 0).toLocaleString("tr-TR") + " ₺";
function sonDonem(ogrId) { return odemeler.filter((o) => o.ogrenciId === ogrId).sort((a, b) => (b.bitis || "").localeCompare(a.bitis || ""))[0]; }
function kalanGun(o) { return o ? Math.ceil((new Date(o.bitis + "T23:59") - new Date()) / 86400000) : null; }

function drawGenel(body) {
  const ogr = users.filter((u) => u.rol === "ogrenci" && u.aktif !== false);
  const kocsuz = ogr.filter((u) => !u.kocId);
  const ay = iso(new Date()).slice(0, 7);
  const buAyGelir = odemeler.filter((o) => o.durum === "odendi" && (o.odemeTarihi || o.baslangic || "").startsWith(ay)).reduce((s, o) => s + (Number(o.tutar) || 0), 0);
  const bekleyen = odemeler.filter((o) => o.durum !== "odendi").reduce((s, o) => s + (Number(o.tutar) || 0), 0);
  const otuzGun = Date.now() - 30 * 86400000;
  const yeni30 = ogrBas.filter((x) => (x.createdAt?.toMillis?.() || 0) > otuzGun).length;
  const donusum = ogrBas.length ? Math.round((100 * ogrBas.filter((x) => x.durum === "kabul").length) / ogrBas.length) : 0;
  const yakinda = ogr.filter((u) => { const k = kalanGun(sonDonem(u.id)); return k !== null && k >= 0 && k <= 7; }).length;
  const bitmis = ogr.filter((u) => { const k = kalanGun(sonDonem(u.id)); return k === null || k < 0; }).length;
  body.innerHTML = `<div class="stats">
      <div class="stat"><div class="n">${ogr.length}</div><div class="l">Aktif öğrenci</div></div>
      <div class="stat"><div class="n">${koclar().length}</div><div class="l">Aktif koç</div></div>
      <div class="stat"><div class="n">${TL(buAyGelir)}</div><div class="l">Bu ay tahsilat</div></div>
      <div class="stat"><div class="n">${TL(bekleyen)}</div><div class="l">Bekleyen ödeme</div></div>
    </div>
    <div class="stats">
      <div class="stat"><div class="n">${yeni30}</div><div class="l">Son 30 gün öğrenci başvurusu</div></div>
      <div class="stat"><div class="n">%${donusum}</div><div class="l">Başvurudan kayda dönüşüm</div></div>
      <div class="stat"><div class="n">${yakinda}</div><div class="l">7 gün içinde dönemi bitecek</div></div>
      <div class="stat"><div class="n">${bitmis}</div><div class="l">Dönemi bitmiş / kaydı yok</div></div>
    </div>
    <div class="card" style="margin-bottom:1rem"><div class="spread"><h3 style="margin:0">Koç performansı</h3><span class="muted small">Bu hafta · son 7 gün</span></div>
      ${koclar().length ? `<div class="table-wrap"><table style="margin-top:.8rem"><thead><tr><th>Koç</th><th>Öğrenci</th><th>Görev tamamlama (bu hafta)</th><th>Görüşme notu (7 gün)</th><th>Bekleyen veli raporu</th></tr></thead><tbody>
        ${koclar().map((k) => {
          const n = ogrenciSayisi(k.id), cap = k.kapasite || 0;
          const g = haftaGorev.filter((t) => t.kocId === k.id), pct = g.length ? Math.round((100 * g.filter((t) => t.tamam).length) / g.length) : null;
          const gor = gorusme7.filter((x) => x.kocId === k.id).length;
          const rap = raporlar.filter((r) => r.kocId === k.id && r.durum === "bekliyor").length;
          return `<tr><td><b>${esc(k.ad)}</b><div class="muted small">${esc(k.universite || "")} · ${esc(k.alan || "-")}</div></td>
            <td><span class="badge ${cap && n >= cap ? "err" : "ok"}">${n}${cap ? " / " + cap : ""}</span></td>
            <td>${pct === null ? `<span class="muted small">Görev yazılmamış</span>` : `<div class="row" style="gap:.5rem"><div class="progress" style="width:120px"><i style="width:${pct}%;${pct < 50 ? "background:var(--warn)" : ""}"></i></div><b>%${pct}</b><span class="muted small">(${g.length} görev)</span></div>`}</td>
            <td>${gor < n ? `<span class="badge warn">${gor} / ${n}</span>` : `<span class="badge ok">${gor} / ${n}</span>`}</td>
            <td>${rap ? `<span class="badge warn">${rap}</span>` : "–"}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="empty">Henüz koç yok.</div>`}
      <p class="muted small" style="margin:.8rem 0 0">Görüşme notu sütunu: son 7 günde girilen görüşme notu / öğrenci sayısı. Her öğrenciyle haftada bir görüşme beklenir.</p></div>
    <div class="card"><h3>Koçu olmayan öğrenciler</h3>${kocsuz.length ? kocsuz.map((s) => `<div class="spread note-item">
          <div><b>${esc(s.ad)}</b><div class="muted small">${esc(s.sinif || "")} · ${alanAdi(s.alan)}</div></div>
          <select data-assign="${s.id}" style="width:auto"><option value="">Koç ata…</option>${kocOptions(null, s.alan)}</select></div>`).join("") : `<div class="empty">Tüm öğrenciler eşleşmiş 🎉</div>`}</div>`;
  $$("[data-assign]", body).forEach((sel) => sel.addEventListener("change", async () => {
    if (!sel.value) return;
    try { await updateDoc(doc(db, "users", sel.dataset.assign), { kocId: sel.value }); toast("Koç atandı."); reload(); }
    catch (err) { console.error(err); toast("Atanamadı.", "err"); }
  }));
}

// ============ ÖDEMELER / DÖNEMLER ============
function drawOdemeler(body) {
  let filtre = body.dataset.of || "hepsi";
  const ogr = users.filter((u) => u.rol === "ogrenci" && u.aktif !== false);
  const satir = (u) => { const o = sonDonem(u.id), k = kalanGun(o);
    const durum = !o ? "yok" : k < 0 ? "bitti" : k <= 7 ? "yakin" : o.durum !== "odendi" ? "bekliyor" : "aktif";
    return { u, o, k, durum }; };
  const render = () => {
    const rows = ogr.map(satir).filter((r) => filtre === "hepsi" || r.durum === filtre || (filtre === "bekliyor" && r.o?.durum !== "odendi" && r.o))
      .sort((a, b) => (a.k ?? -999) - (b.k ?? -999));
    const badge = { yok: ["Kayıt yok", "gray"], bitti: ["Dönem bitti", "err"], yakin: ["Yakında bitiyor", "warn"], bekliyor: ["Ödeme bekliyor", "warn"], aktif: ["Aktif", "ok"] };
    body.innerHTML = `<div class="spread" style="margin-bottom:1rem"><div class="seg" id="ofSeg">
        ${[["hepsi", "Hepsi"], ["yakin", "Yakında bitiyor"], ["bitti", "Bitti"], ["bekliyor", "Ödeme bekliyor"], ["yok", "Kayıt yok"]].map(([k, v]) => `<button data-f="${k}" class="${filtre === k ? "on" : ""}">${v}</button>`).join("")}</div>
        <span class="muted small">Her öğrencinin son dönemi gösterilir. Varsayılan dönem 4 hafta.</span></div>
      <div class="card table-wrap">${rows.length ? `<table><thead><tr><th>Öğrenci</th><th>Koç</th><th>Son dönem</th><th>Kalan</th><th>Tutar</th><th>Durum</th><th></th></tr></thead><tbody>
        ${rows.map(({ u, o, k, durum }) => { const koc = users.find((x) => x.id === u.kocId);
          return `<tr><td><b>${esc(u.ad)}</b><div class="muted small">${esc(u.telefon || "")}</div></td><td class="small">${esc(koc?.ad || "–")}</td>
          <td class="small">${o ? `${trDate(o.baslangic)} – ${trDate(o.bitis)}<div class="muted">${esc(o.paket || "")}</div>` : "–"}</td>
          <td>${k === null ? "–" : k < 0 ? `<b style="color:var(--err)">${-k} gün geçti</b>` : `<b>${k} gün</b>`}</td>
          <td>${o ? TL(o.tutar) : "–"}</td>
          <td><span class="badge ${badge[durum][1]}">${badge[durum][0]}</span>${o && o.durum !== "odendi" ? ` <span class="badge warn">Ödenmedi</span>` : ""}</td>
          <td><div class="row" style="gap:.4rem">${o && o.durum !== "odendi" ? `<button class="btn btn-primary btn-sm" data-odendi="${o.id}">Ödendi ✓</button>` : ""}
            <button class="btn btn-accent btn-sm" data-yeni="${u.id}">+ Dönem</button><button class="btn btn-ghost btn-sm" data-gecmis="${u.id}">Geçmiş</button>
            ${u.telefon || u.veliTelefon ? `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${waLink(u.veliTelefon || u.telefon)}?text=${encodeURIComponent(`Merhaba, ${u.ad.split(" ")[0]} için 24 Akademi koçluk döneminin ${o ? trDate(o.bitis) + " tarihinde bittiğini" : "başlamadığını"} hatırlatmak isteriz. Yenilemek için bize yazabilirsiniz.`)}">Hatırlat</a>` : ""}</div></td></tr>`; }).join("")}
        </tbody></table>` : `<div class="empty">Kayıt yok.</div>`}</div>`;
    $$("#ofSeg button", body).forEach((b) => (b.onclick = () => { filtre = b.dataset.f; body.dataset.of = filtre; render(); }));
    $$("[data-odendi]", body).forEach((b) => (b.onclick = async () => {
      try { await updateDoc(doc(db, "odemeler", b.dataset.odendi), { durum: "odendi", odemeTarihi: iso(new Date()) }); toast("Ödendi olarak işaretlendi."); await reload(); }
      catch (e) { console.error(e); toast("Güncellenemedi.", "err"); }
    }));
    $$("[data-yeni]", body).forEach((b) => (b.onclick = () => donemModal(users.find((x) => x.id === b.dataset.yeni))));
    $$("[data-gecmis]", body).forEach((b) => (b.onclick = () => gecmisModal(users.find((x) => x.id === b.dataset.gecmis))));
  };
  render();
}

function donemModal(u) {
  const son = sonDonem(u.id);
  const bas = son && kalanGun(son) >= -3 ? iso(addDays(new Date(son.bitis + "T12:00"), 1)) : iso(new Date());
  const m = openModal(`<h3>Yeni dönem · ${esc(u.ad)}</h3>
    <div class="grid-2"><div class="field"><label>Paket</label><select id="d_p"><option>Birebir Koçluk</option><option>Koçluk + Özel Ders</option><option>Özel Ders</option><option>Diğer</option></select></div>
      <div class="field"><label>Tutar (₺)</label><input id="d_t" type="number" min="0" step="50" value="${esc(String(son?.tutar || BRAND.baslangicFiyat).replace(/\D/g, ""))}"/></div></div>
    <div class="grid-3"><div class="field"><label>Başlangıç</label><input id="d_b" type="date" value="${bas}"/></div>
      <div class="field"><label>Süre</label><select id="d_s"><option value="28">4 hafta</option><option value="56">8 hafta</option><option value="84">12 hafta</option></select></div>
      <div class="field"><label>Bitiş</label><input id="d_e" type="date"/></div></div>
    <div class="grid-2"><div class="field"><label>Ödeme durumu</label><select id="d_d"><option value="bekliyor">Bekliyor</option><option value="odendi">Ödendi</option></select></div>
      <div class="field"><label>Not</label><input id="d_n" maxlength="200" placeholder="Örn. havale, taksit 1/2"/></div></div>
    <button class="btn btn-accent" id="d_save">Kaydet</button>`);
  const el = m.el;
  const calc = () => { const b = $("#d_b", el).value; if (b) $("#d_e", el).value = iso(addDays(new Date(b + "T12:00"), Number($("#d_s", el).value) - 1)); };
  $("#d_b", el).onchange = calc; $("#d_s", el).onchange = calc; calc();
  $("#d_save", el).onclick = async (e) => {
    const data = { ogrenciId: u.id, kocId: u.kocId || null, paket: $("#d_p", el).value, tutar: Number($("#d_t", el).value) || 0,
      baslangic: $("#d_b", el).value, bitis: $("#d_e", el).value, durum: $("#d_d", el).value, not: $("#d_n", el).value.trim(), createdAt: serverTimestamp() };
    if (data.durum === "odendi") data.odemeTarihi = iso(new Date());
    if (!data.baslangic || !data.bitis) return toast("Tarihleri seç.", "err");
    e.target.disabled = true;
    try { await addDoc(collection(db, "odemeler"), data); m.close(); toast("Dönem eklendi."); await reload(); }
    catch (err) { console.error(err); toast("Kaydedilemedi.", "err"); e.target.disabled = false; }
  };
}

function gecmisModal(u) {
  const list = odemeler.filter((o) => o.ogrenciId === u.id).sort((a, b) => (b.baslangic || "").localeCompare(a.baslangic || ""));
  const toplam = list.filter((o) => o.durum === "odendi").reduce((s, o) => s + (Number(o.tutar) || 0), 0);
  const m = openModal(`<h3>Ödeme geçmişi · ${esc(u.ad)}</h3><p class="muted small">Toplam tahsilat: <b>${TL(toplam)}</b></p>
    ${list.length ? `<table><thead><tr><th>Dönem</th><th>Paket</th><th>Tutar</th><th>Durum</th><th></th></tr></thead><tbody>
      ${list.map((o) => `<tr><td class="small">${trDate(o.baslangic)} – ${trDate(o.bitis)}${o.not ? `<div class="muted">${esc(o.not)}</div>` : ""}</td><td class="small">${esc(o.paket || "")}</td><td>${TL(o.tutar)}</td>
        <td>${o.durum === "odendi" ? `<span class="badge ok">Ödendi</span>` : `<span class="badge warn">Bekliyor</span>`}</td><td><button class="btn btn-danger btn-sm" data-sil="${o.id}">Sil</button></td></tr>`).join("")}</tbody></table>`
      : `<div class="empty">Kayıt yok.</div>`}`, { wide: true });
  $$("[data-sil]", m.el).forEach((b) => (b.onclick = async () => {
    if (!confirm("Bu dönem kaydı silinsin mi?")) return;
    try { await deleteDoc(doc(db, "odemeler", b.dataset.sil)); m.close(); toast("Silindi."); await reload(); } catch { toast("Silinemedi.", "err"); }
  }));
}

function kocOptions(selected, alan) {
  // aynı alandaki koçlar önce
  const list = [...koclar()].sort((a, b) => (b.alan === alan) - (a.alan === alan));
  return list.map((k) => {
    const n = ogrenciSayisi(k.id), cap = k.kapasite || 0;
    return `<option value="${k.id}" ${k.id === selected ? "selected" : ""}>${esc(k.ad)} (${esc(k.alan || "-")}, ${n}${cap ? "/" + cap : ""})</option>`;
  }).join("");
}

// ============ BAŞVURULAR ============
function drawBasvuru(body, col, list, hedefRol) {
  let filtre = body.dataset.filtre || "hepsi";
  const render = () => {
    const rows = list.filter((x) => filtre === "hepsi" || x.durum === filtre);
    body.innerHTML = `<div class="spread" style="margin-bottom:1rem"><div class="seg" id="fSeg">
        ${[["hepsi", "Hepsi"], ...Object.entries(DURUM).map(([k, v]) => [k, v[0]])].map(([k, v]) => `<button data-f="${k}" class="${filtre === k ? "on" : ""}">${v}</button>`).join("")}</div>
        <span class="muted small">${rows.length} kayıt</span></div>
      <div class="card table-wrap">${rows.length ? `<table><thead><tr><th>Tarih</th><th>Kişi</th><th>Bilgi</th><th>Durum</th><th>Yönetici notu</th><th></th></tr></thead><tbody>
        ${rows.map((b) => `<tr>
          <td class="small">${tsStr(b.createdAt)}</td>
          <td><b>${esc(b.ad)}</b>${b.kim === "veli" ? ` <span class="badge gray">veli doldurdu</span>` : ""}<div class="small">${esc(b.telefon)}</div><div class="small muted">${esc(b.email || "")}</div></td>
          <td class="small">${hedefRol === "ogrenci"
            ? `${esc(b.sinif)} · ${alanAdi(b.alan)}${b.hedef ? `<div class="muted">${esc(b.hedef)}</div>` : ""}`
            : `${esc(b.universite)} – ${esc(b.bolum)}<div><b>${esc(b.alan)} ${Number(b.siralama || 0).toLocaleString("tr-TR")}</b> (${esc(b.yil)})</div>${b.neden ? `<div class="muted">${esc(b.neden)}</div>` : ""}`}</td>
          <td><select data-durum="${b.id}" style="width:auto">${Object.entries(DURUM).map(([k, v]) => `<option value="${k}" ${b.durum === k ? "selected" : ""}>${v[0]}</option>`).join("")}</select></td>
          <td><input data-not="${b.id}" value="${esc(b.adminNotu || "")}" placeholder="Not…" maxlength="300" style="min-width:160px"/></td>
          <td><div class="row">${b.hesapUid ? `<span class="badge ok">Hesap var</span>` : `<button class="btn btn-primary btn-sm" data-hesap="${b.id}">Hesap aç</button>`}
            <button class="btn btn-danger btn-sm" data-sil="${b.id}">Sil</button></div></td></tr>`).join("")}
        </tbody></table>` : `<div class="empty">Kayıt yok.</div>`}</div>`;
    $$("#fSeg button", body).forEach((b) => (b.onclick = () => { filtre = b.dataset.f; body.dataset.filtre = filtre; render(); }));
    $$("[data-durum]", body).forEach((s) => s.addEventListener("change", async () => {
      try { await updateDoc(doc(db, col, s.dataset.durum), { durum: s.value }); list.find((x) => x.id === s.dataset.durum).durum = s.value; toast("Durum güncellendi."); }
      catch { toast("Güncellenemedi.", "err"); }
    }));
    $$("[data-not]", body).forEach((i) => i.addEventListener("change", async () => {
      try { await updateDoc(doc(db, col, i.dataset.not), { adminNotu: i.value.trim() }); toast("Not kaydedildi."); } catch { toast("Kaydedilemedi.", "err"); }
    }));
    $$("[data-sil]", body).forEach((b) => (b.onclick = async () => {
      if (!confirm("Başvuru kalıcı olarak silinsin mi?")) return;
      try { await deleteDoc(doc(db, col, b.dataset.sil)); await reload(); } catch { toast("Silinemedi.", "err"); }
    }));
    $$("[data-hesap]", body).forEach((btn) => (btn.onclick = () => {
      const b = list.find((x) => x.id === btn.dataset.hesap);
      const pre = hedefRol === "ogrenci"
        ? { ad: b.ad, email: b.email, telefon: b.telefon, sinif: b.sinif, alan: b.alan === "BELIRSIZ" ? "" : b.alan, hedef: b.hedef }
        : { ad: b.ad, email: b.email, telefon: b.telefon, universite: b.universite, bolum: b.bolum, alan: b.alan, siralama: b.siralama };
      userModal(null, pre, hedefRol, { col, id: b.id });
    }));
  };
  render();
}

// ============ VELİ RAPORLARI ============
function drawRaporlar(body) {
  let filtre = body.dataset.rf || "bekliyor";
  const render = () => {
    const rows = raporlar.filter((r) => filtre === "hepsi" || r.durum === filtre);
    body.innerHTML = `<div class="spread" style="margin-bottom:1rem"><div class="seg" id="rfSeg">
        ${[["bekliyor", "Gönderilecek"], ["gonderildi", "Gönderildi"], ["hepsi", "Hepsi"]].map(([k, v]) => `<button data-f="${k}" class="${filtre === k ? "on" : ""}">${v}</button>`).join("")}</div>
        <span class="muted small">Koçlar hazırlar, sen düzenleyip veliye WhatsApp'tan gönderirsin.</span></div>
      ${rows.length ? `<div class="grid-2" style="gap:1rem;align-items:start">${rows.map((r) => {
        const ogr = users.find((u) => u.id === r.ogrenciId) || {}, koc = users.find((u) => u.id === r.kocId) || {};
        const tel = ogr.veliTelefon;
        return `<div class="card">
          <div class="spread"><div><b>${esc(ogr.ad || "?")}</b><div class="muted small">Koç: ${esc(koc.ad || "?")} · Hafta: ${esc(trDate(r.hafta))} haftası</div></div>
            ${r.durum === "gonderildi" ? `<span class="badge ok">Gönderildi</span>` : `<span class="badge warn">Bekliyor</span>`}</div>
          <textarea data-metin="${r.id}" style="min-height:200px;font-size:.86rem;margin:.8rem 0" ${r.durum === "gonderildi" ? "readonly" : ""}>${esc(r.metin)}</textarea>
          <div class="row">
            ${tel ? `<a class="btn btn-accent btn-sm" data-wa="${r.id}" target="_blank" rel="noopener" href="#">WhatsApp'ta aç</a>` : `<span class="badge err">Veli telefonu yok</span><button class="btn btn-ghost btn-sm" data-telekle="${r.ogrenciId}">Telefon ekle</button>`}
            <button class="btn btn-ghost btn-sm" data-kopya="${r.id}">Kopyala</button>
            ${r.durum !== "gonderildi" ? `<button class="btn btn-primary btn-sm" data-gonderildi="${r.id}" style="margin-left:auto">Gönderildi ✓</button>`
              : `<span class="muted small" style="margin-left:auto">${tsStr(r.gonderildiAt)}</span>`}
          </div></div>`;
      }).join("")}</div>` : `<div class="card empty">${filtre === "bekliyor" ? "Gönderilmeyi bekleyen rapor yok." : "Kayıt yok."}</div>`}`;
    const metin = (id) => $(`[data-metin="${id}"]`, body).value;
    $$("#rfSeg button", body).forEach((b) => (b.onclick = () => { filtre = b.dataset.f; body.dataset.rf = filtre; render(); }));
    $$("[data-wa]", body).forEach((a) => {
      const r = raporlar.find((x) => x.id === a.dataset.wa), tel = users.find((u) => u.id === r.ogrenciId)?.veliTelefon;
      const upd = () => (a.href = `${waLink(tel)}?text=${encodeURIComponent(metin(r.id))}`);
      upd(); a.addEventListener("mouseenter", upd); a.addEventListener("focus", upd); a.addEventListener("touchstart", upd, { passive: true });
    });
    $$("[data-kopya]", body).forEach((b) => (b.onclick = async () => {
      try { await navigator.clipboard.writeText(metin(b.dataset.kopya)); toast("Kopyalandı."); } catch { toast("Kopyalanamadı.", "err"); }
    }));
    $$("[data-gonderildi]", body).forEach((b) => (b.onclick = async () => {
      try {
        await updateDoc(doc(db, "veliRaporlari", b.dataset.gonderildi), { durum: "gonderildi", metin: metin(b.dataset.gonderildi), gonderildiAt: serverTimestamp(), gonderen: auth.currentUser.uid });
        toast("Gönderildi olarak işaretlendi."); await loadAll(); drawRaporlar(body);
      } catch (err) { console.error(err); toast("Güncellenemedi.", "err"); }
    }));
    $$("[data-telekle]", body).forEach((b) => (b.onclick = () => { const u = users.find((x) => x.id === b.dataset.telekle); if (u) userModal(u, u); }));
  };
  render();
}

// ============ KULLANICILAR ============
function drawUsers(body) {
  let rolF = "hepsi", ara = "";
  const render = () => {
    const rows = users.filter((u) => (rolF === "hepsi" || u.rol === rolF) && (!ara || `${u.ad} ${u.email}`.toLocaleLowerCase("tr").includes(ara)));
    $("#uTable").innerHTML = rows.length ? `<table><thead><tr><th>Ad</th><th>Rol</th><th>Detay</th><th>Koç</th><th>Durum</th><th></th></tr></thead><tbody>
      ${rows.map((u) => {
        const koc = u.kocId ? users.find((k) => k.id === u.kocId) : null;
        const detay = u.rol === "ogrenci" ? `${esc(u.sinif || "")} · ${alanAdi(u.alan)}` : u.rol === "koc" ? `${esc(u.universite || "")} · ${esc(u.alan || "")} ${u.siralama ? Number(u.siralama).toLocaleString("tr-TR") : ""}<div class="muted">${ogrenciSayisi(u.id)} öğrenci${u.kapasite ? " / " + u.kapasite : ""}</div>` : "-";
        return `<tr><td><b>${esc(u.ad)}</b><div class="small muted">${esc(u.email)}</div></td>
          <td><span class="badge ${u.rol === "admin" ? "err" : u.rol === "koc" ? "ok" : ""}">${ROL_ADI[u.rol] || u.rol}</span></td>
          <td class="small">${detay}</td><td class="small">${u.rol === "ogrenci" ? (koc ? esc(koc.ad) : `<span class="badge warn">Yok</span>`) : "–"}</td>
          <td>${u.aktif === false ? `<span class="badge gray">Pasif</span>` : `<span class="badge ok">Aktif</span>`}</td>
          <td><button class="btn btn-ghost btn-sm" data-edit="${u.id}">Düzenle</button></td></tr>`;
      }).join("")}</tbody></table>` : `<div class="empty">Kullanıcı yok.</div>`;
    $$("[data-edit]", body).forEach((b) => (b.onclick = () => { const u = users.find((x) => x.id === b.dataset.edit); userModal(u, u); }));
  };
  body.innerHTML = `<div class="spread" style="margin-bottom:1rem"><div class="seg" id="rSeg">
      ${[["hepsi", "Hepsi"], ["ogrenci", "Öğrenciler"], ["koc", "Koçlar"], ["admin", "Yöneticiler"]].map(([k, v]) => `<button data-r="${k}" class="${k === "hepsi" ? "on" : ""}">${v}</button>`).join("")}</div>
      <input id="uAra" placeholder="Ad veya e-posta ara…" style="max-width:260px"/></div>
    <div class="card table-wrap" id="uTable"></div>`;
  $$("#rSeg button", body).forEach((b) => (b.onclick = () => { $$("#rSeg button", body).forEach((x) => x.classList.remove("on")); b.classList.add("on"); rolF = b.dataset.r; render(); }));
  $("#uAra", body).oninput = (e) => { ara = e.target.value.trim().toLocaleLowerCase("tr"); render(); };
  render();
}

// ============ KULLANICI OLUŞTUR / DÜZENLE ============
// Kurallar: sadece öğrencinin koçu olur; koç seçimi mevcut koçlardan yapılır; alanlar role göre değişir.
function roleFields(rol, d) {
  const v = (k) => esc(d[k] ?? "");
  const alanSel = (cur) => `<select id="u_alan"><option value="">Seç</option>${Object.entries(ALANLAR).map(([k, n]) => `<option value="${k}" ${cur === k ? "selected" : ""}>${n}</option>`).join("")}</select>`;
  if (rol === "ogrenci") return `<div class="grid-2">
      <div class="field"><label>Durum</label><select id="u_sinif">${["", "10. sınıf", "11. sınıf", "12. sınıf", "Mezun"].map((s) => `<option ${d.sinif === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      <div class="field"><label>Alan</label>${alanSel(d.alan)}</div></div>
    <div class="grid-2"><div class="field"><label>Veli telefonu</label><input id="u_veli" value="${v("veliTelefon")}" maxlength="20"/></div>
      <div class="field"><label>Koç</label><select id="u_koc"><option value="">— Henüz yok —</option>${kocOptions(d.kocId, d.alan)}</select></div></div>
    <div class="field"><label>Hedef</label><input id="u_hedef" value="${v("hedef")}" maxlength="200"/></div>`;
  if (rol === "koc") return `<div class="grid-2">
      <div class="field"><label>Üniversite</label><input id="u_uni" value="${v("universite")}" maxlength="100"/></div>
      <div class="field"><label>Bölüm</label><input id="u_bolum" value="${v("bolum")}" maxlength="100"/></div></div>
    <div class="grid-3"><div class="field"><label>Alan</label>${alanSel(d.alan)}</div>
      <div class="field"><label>Sıralama</label><input type="number" id="u_sira" value="${v("siralama")}" min="1"/></div>
      <div class="field"><label>Kapasite</label><input type="number" id="u_kap" value="${esc(d.kapasite ?? 10)}" min="1" max="50"/></div></div>
    <div class="field"><label>Fotoğraf URL (isteğe bağlı)</label><input id="u_foto" value="${v("foto")}" placeholder="https://…"/></div>`;
  return `<p class="muted small">Yöneticilerin ek bilgisi yok; koç ataması yapılamaz.</p>`;
}

function collect(rol, el) {
  const g = (id) => $("#" + id, el)?.value.trim() ?? "";
  if (rol === "ogrenci") return { sinif: g("u_sinif"), alan: g("u_alan"), veliTelefon: g("u_veli"), kocId: g("u_koc") || null, hedef: g("u_hedef") };
  if (rol === "koc") return { universite: g("u_uni"), bolum: g("u_bolum"), alan: g("u_alan"), siralama: Number(g("u_sira")) || null, kapasite: Number(g("u_kap")) || 10, foto: g("u_foto") };
  return {};
}
const ROLE_KEYS = { ogrenci: ["sinif", "alan", "veliTelefon", "kocId", "hedef"], koc: ["universite", "bolum", "alan", "siralama", "kapasite", "foto"], admin: [] };

function userModal(existing, data, presetRole = null, fromBasvuru = null) {
  const isNew = !existing;
  let rol = existing?.rol || presetRole || "ogrenci";
  const m = openModal(`<h3>${isNew ? "Yeni kullanıcı" : "Kullanıcıyı düzenle"}</h3>
    <div class="field"><label>Rol</label><div class="seg" id="u_rolSeg">${Object.entries(ROL_ADI).map(([k, v]) => `<button type="button" data-r="${k}" class="${rol === k ? "on" : ""}">${v}</button>`).join("")}</div></div>
    <div class="grid-2"><div class="field"><label>Ad soyad *</label><input id="u_ad" value="${esc(data.ad || "")}" maxlength="80"/></div>
      <div class="field"><label>Telefon</label><input id="u_tel" value="${esc(data.telefon || "")}" maxlength="20"/></div></div>
    <div class="field"><label>E-posta *</label><input id="u_email" type="email" value="${esc(data.email || "")}" ${isNew ? "" : "disabled"}/></div>
    <div id="u_roleFields"></div>
    ${isNew ? `<label class="check"><input type="checkbox" id="u_reset" checked/> Kullanıcıya şifre belirleme e-postası gönder</label>`
      : `<label class="check"><input type="checkbox" id="u_aktif" ${existing.aktif !== false ? "checked" : ""}/> Hesap aktif</label>`}
    <div class="row">${!isNew ? `<button class="btn btn-ghost btn-sm" id="u_pw">Şifre sıfırlama e-postası gönder</button>` : ""}
      <button class="btn btn-accent" id="u_save" style="margin-left:auto">${isNew ? "Hesabı oluştur" : "Kaydet"}</button></div>`, { wide: true });
  const el = m.el;
  const drawFields = () => { $("#u_roleFields", el).innerHTML = roleFields(rol, { ...data, ...(existing || {}) }); };
  drawFields();
  $$("#u_rolSeg button", el).forEach((b) => (b.onclick = () => {
    if (!isNew && existing.rol === "koc" && b.dataset.r !== "koc" && ogrenciSayisi(existing.id)) return toast("Bu koçun öğrencileri var. Önce onları başka koça aktarın.", "err");
    $$("#u_rolSeg button", el).forEach((x) => x.classList.remove("on")); b.classList.add("on"); rol = b.dataset.r; drawFields();
  }));
  if (!isNew) $("#u_pw", el).onclick = async () => {
    try { await sendPasswordResetEmail(auth, existing.email); toast("Şifre sıfırlama e-postası gönderildi."); } catch { toast("Gönderilemedi.", "err"); }
  };

  $("#u_save", el).onclick = async (e) => {
    const ad = $("#u_ad", el).value.trim(), email = $("#u_email", el).value.trim().toLowerCase(), telefon = $("#u_tel", el).value.trim();
    if (!ad || (isNew && !/^\S+@\S+\.\S+$/.test(email))) return toast("Ad ve geçerli e-posta zorunlu.", "err");
    const extra = collect(rol, el);
    if (rol === "ogrenci" && extra.kocId) {
      const k = users.find((u) => u.id === extra.kocId);
      if (k?.kapasite && ogrenciSayisi(k.id) >= k.kapasite && existing?.kocId !== k.id && !confirm(`${k.ad} kapasitesi dolu. Yine de atansın mı?`)) return;
    }
    e.target.disabled = true;
    try {
      if (isNew) {
        const pass = randomPassword();
        const sec = secondaryAuth();
        const cred = await createUserWithEmailAndPassword(sec, email, pass);
        await signOut(sec);
        const uid = cred.user.uid;
        const batch = writeBatch(db);
        batch.set(doc(db, "users", uid), { ad, email, telefon, rol, aktif: true, ...extra, createdAt: serverTimestamp() });
        batch.set(doc(db, "roles", uid), { role: rol });
        if (fromBasvuru) batch.update(doc(db, fromBasvuru.col, fromBasvuru.id), { durum: "kabul", hesapUid: uid });
        await batch.commit();
        let resetMsg = "";
        if ($("#u_reset", el).checked) {
          try { await sendPasswordResetEmail(auth, email); resetMsg = "Şifre belirleme e-postası gönderildi."; } catch { resetMsg = "E-posta gönderilemedi; geçici şifreyi iletin."; }
        }
        m.close();
        openModal(`<h3>Hesap oluşturuldu ✓</h3><p><b>${esc(ad)}</b> · ${esc(email)}</p>
          <div class="field"><label>Geçici şifre</label><input readonly value="${pass}" onclick="this.select()"/></div>
          <p class="muted small">${resetMsg} Geçici şifre sadece şimdi gösterilir.</p>`);
      } else {
        const upd = { ad, telefon, rol, aktif: $("#u_aktif", el).checked, ...extra };
        // rol değiştiyse eski role ait alanları temizle (koç/admin'in koçu olamaz)
        Object.entries(ROLE_KEYS).forEach(([r, keys]) => { if (r !== rol) keys.forEach((k) => { if (!(k in extra)) upd[k] = deleteField(); }); });
        const batch = writeBatch(db);
        batch.update(doc(db, "users", existing.id), upd);
        if (existing.rol !== rol) batch.set(doc(db, "roles", existing.id), { role: rol });
        await batch.commit();
        m.close(); toast("Kaydedildi.");
      }
      await reload();
    } catch (err) {
      console.error(err);
      const msg = err.code === "auth/email-already-in-use" ? "Bu e-posta ile zaten bir hesap var." : err.code === "auth/invalid-email" ? "E-posta geçersiz." : "İşlem başarısız: " + (err.code || err.message);
      toast(msg, "err"); e.target.disabled = false;
    }
  };
}


// ============ KOÇ HAKEDİŞİ ============
async function drawHakedis(body) {
  body.innerHTML = `<div class="empty">Yükleniyor…</div>`;
  let ayar = { kocOrani: 40 };
  try { const a = await getDoc(doc(db, "ayarlar", "genel")); if (a.exists()) ayar = { ...ayar, ...a.data() }; } catch (e) { console.warn(e); }
  let kayit = [];
  try { kayit = docs(await getDocs(collection(db, "hakedisler"))); } catch (e) { console.warn(e); }
  let ay = body.dataset.ay || iso(new Date()).slice(0, 7);
  const render = () => {
    const odenen = odemeler.filter((o) => o.durum === "odendi" && (o.odemeTarihi || o.baslangic || "").startsWith(ay));
    const rows = koclar().map((k) => {
      const ods = odenen.filter((o) => o.kocId === k.id), tahsilat = ods.reduce((a, o) => a + (Number(o.tutar) || 0), 0);
      const kay = kayit.find((h) => h.id === `${k.id}_${ay}`);
      const oran = kay?.oran ?? k.hakedisOrani ?? ayar.kocOrani;
      return { k, ods, tahsilat, oran, tutar: kay?.tutar ?? Math.round((tahsilat * oran) / 100), kay };
    });
    const top = rows.reduce((a, r) => a + r.tutar, 0), tah = rows.reduce((a, r) => a + r.tahsilat, 0);
    body.innerHTML = `<div class="spread" style="margin-bottom:1rem"><div class="row"><label class="small"><b>Ay</b></label><input type="month" id="hkAy" value="${ay}" style="width:auto"/>
        <label class="small" style="margin-left:1rem"><b>Varsayılan koç payı</b></label><input type="number" id="hkOran" min="0" max="100" value="${ayar.kocOrani}" style="width:80px"/><span>%</span><button class="btn btn-ghost btn-sm" id="hkOranS">Kaydet</button></div>
        <span class="muted small">Hesap: o ay tahsil edilen ödemeler × koç payı</span></div>
      <div class="stats" style="grid-template-columns:repeat(3,1fr)"><div class="stat"><div class="n">${TL(tah)}</div><div class="l">${ay} tahsilat</div></div>
        <div class="stat"><div class="n">${TL(top)}</div><div class="l">Toplam koç hakedişi</div></div><div class="stat"><div class="n">${TL(tah - top)}</div><div class="l">Şirkete kalan</div></div></div>
      <div class="card table-wrap"><table><thead><tr><th>Koç</th><th>Ödenen dönem</th><th>Tahsilat</th><th>Pay %</th><th>Hakediş</th><th>Durum</th><th></th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td><b>${esc(r.k.ad)}</b></td><td>${r.ods.length}</td><td>${TL(r.tahsilat)}</td>
          <td><input type="number" min="0" max="100" value="${r.oran}" data-or="${r.k.id}" style="width:70px;padding:.35rem"/></td>
          <td><input type="number" min="0" step="10" value="${r.tutar}" data-tu="${r.k.id}" style="width:110px;padding:.35rem"/></td>
          <td>${r.kay ? (r.kay.odendi ? `<span class="badge ok">Ödendi</span>` : `<span class="badge warn">Kaydedildi</span>`) : `<span class="badge gray">Taslak</span>`}</td>
          <td><div class="row" style="gap:.3rem"><button class="btn btn-ghost btn-sm" data-hks="${r.k.id}">Kaydet</button>${r.kay && !r.kay.odendi ? `<button class="btn btn-primary btn-sm" data-hko="${r.k.id}">Ödendi ✓</button>` : ""}</div></td></tr>`).join("") || `<tr><td colspan="7"><div class="empty">Koç yok.</div></td></tr>`}
      </tbody></table></div>
      <p class="muted small">Pay % değiştirince hakediş tutarı kendiliğinden hesaplanır; istersen tutarı elle de düzeltebilirsin. Kaydedilen hakedişleri koçlar kendi panellerinde "Kazancım" sekmesinde görür.</p>`;
    $("#hkAy", body).onchange = (e) => { ay = e.target.value; body.dataset.ay = ay; render(); };
    $("#hkOranS", body).onclick = async () => { ayar.kocOrani = Number($("#hkOran", body).value) || 0; try { await setDoc(doc(db, "ayarlar", "genel"), ayar, { merge: true }); toast("Kaydedildi."); render(); } catch { toast("Kaydedilemedi.", "err"); } };
    $$("[data-or]", body).forEach((i) => (i.oninput = () => { const r = rows.find((x) => x.k.id === i.dataset.or); $(`[data-tu="${r.k.id}"]`, body).value = Math.round((r.tahsilat * (Number(i.value) || 0)) / 100); }));
    const kaydet = async (kid, extra = {}) => {
      const r = rows.find((x) => x.k.id === kid);
      const data = { kocId: kid, ay, tahsilat: r.tahsilat, donemSayisi: r.ods.length, oran: Number($(`[data-or="${kid}"]`, body).value) || 0, tutar: Number($(`[data-tu="${kid}"]`, body).value) || 0, odendi: r.kay?.odendi || false, updatedAt: serverTimestamp(), ...extra };
      try { await setDoc(doc(db, "hakedisler", `${kid}_${ay}`), data); const i = kayit.findIndex((h) => h.id === `${kid}_${ay}`); const nd = { id: `${kid}_${ay}`, ...data }; i >= 0 ? (kayit[i] = nd) : kayit.push(nd); toast("Kaydedildi."); render(); }
      catch (e) { console.error(e); toast("Kaydedilemedi.", "err"); }
    };
    $$("[data-hks]", body).forEach((b) => (b.onclick = () => kaydet(b.dataset.hks)));
    $$("[data-hko]", body).forEach((b) => (b.onclick = () => kaydet(b.dataset.hko, { odendi: true, odemeTarihi: iso(new Date()) })));
  };
  render();
}

// ============ DUYURULAR ============
async function drawDuyurular(body) {
  let list = [];
  try { list = docs(await getDocs(collection(db, "duyurular"))).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); } catch (e) { console.warn(e); }
  const HEDEF = { herkes: "Herkes", ogrenci: "Öğrenciler", koc: "Koçlar" };
  body.innerHTML = `<div class="grid-2" style="gap:1rem;align-items:start">
    <div class="card"><h3 style="margin-top:0">Yeni duyuru</h3>
      <div class="field"><label>Başlık</label><input id="dy_b" maxlength="100" placeholder="Örn. Deneme kampı kayıtları açıldı"/></div>
      <div class="field"><label>Metin</label><textarea id="dy_m" maxlength="1000"></textarea></div>
      <div class="field"><label>Kime</label><select id="dy_h">${Object.entries(HEDEF).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
      <button class="btn btn-accent" id="dy_s">Yayınla</button>
      <p class="muted small">Duyurular öğrenci ve koç panellerinde 🔔 bildirimlerde görünür.</p></div>
    <div class="card"><h3 style="margin-top:0">Yayındaki duyurular</h3>${list.length ? list.map((d) => `<div class="note-item"><div class="spread"><b>${esc(d.baslik)}</b><span class="row" style="gap:.3rem"><span class="badge">${HEDEF[d.hedef] || d.hedef}</span>${d.aktif === false ? `<span class="badge gray">Kapalı</span>` : ""}</span></div>
        <p class="small" style="margin:.3rem 0;white-space:pre-wrap">${esc(d.metin)}</p><div class="spread small muted"><span>${tsStr(d.createdAt)}</span><span class="row" style="gap:.3rem"><button class="btn btn-ghost btn-sm" data-dyt="${d.id}">${d.aktif === false ? "Aç" : "Kapat"}</button><button class="btn btn-danger btn-sm" data-dys="${d.id}">Sil</button></span></div></div>`).join("")
      : `<div class="empty">Henüz duyuru yok.</div>`}</div></div>`;
  $("#dy_s", body).onclick = async () => {
    const baslik = $("#dy_b", body).value.trim(), metin = $("#dy_m", body).value.trim();
    if (!baslik) return toast("Başlık yaz.", "err");
    try { await addDoc(collection(db, "duyurular"), { baslik, metin, hedef: $("#dy_h", body).value, aktif: true, createdAt: serverTimestamp() }); toast("Duyuru yayınlandı."); drawDuyurular(body); } catch (e) { console.error(e); toast("Yayınlanamadı.", "err"); }
  };
  $$("[data-dyt]", body).forEach((b) => (b.onclick = async () => { const d = list.find((x) => x.id === b.dataset.dyt); await updateDoc(doc(db, "duyurular", d.id), { aktif: d.aktif === false }).catch(() => toast("Güncellenemedi.", "err")); drawDuyurular(body); }));
  $$("[data-dys]", body).forEach((b) => (b.onclick = async () => { if (!confirm("Duyuru silinsin mi?")) return; await deleteDoc(doc(db, "duyurular", b.dataset.dys)).catch(() => toast("Silinemedi.", "err")); drawDuyurular(body); }));
}

// ============ SİTE İÇERİĞİ (ana sayfayı koda dokunmadan güncelle) ============
const ICERIK_ALAN = {
  koclar: [["ad", "Ad soyad"], ["okul", "Üniversite – bölüm"], ["alan", "Alan", ["SAY", "EA", "SOZ", "DIL"]], ["derece", "Derece (örn. EA-398)"], ["foto", "Fotoğraf URL"], ["ornek", "Örnek profil", "check"]],
  hikayeler: [["ad", "Öğrenci (örn. Ayşe Y.)"], ["sonuc", "Sonuç (örn. TYT 68 → 97)"], ["hedef", "Kazandığı yer"], ["yil", "Yıl"], ["metin", "Yorumu"], ["koc", "Koçu"]],
  sss: [["soru", "Soru"], ["cevap", "Cevap"]],
};
async function drawSite(body) {
  body.innerHTML = `<div class="empty">Yükleniyor…</div>`;
  let ic = null;
  try { const s = await getDoc(doc(db, "site", "icerik")); if (s.exists()) ic = s.data(); } catch (e) { console.warn(e); }
  const varsayilan = !ic;
  ic = ic || { fiyat: BRAND.baslangicFiyat, iletisim: { whatsapp: BRAND.whatsapp, email: BRAND.email, instagram: BRAND.instagram }, koclar: KOCLAR.map((k) => ({ ...k })), hikayeler: [...HIKAYELER], sss: [] };
  ic.iletisim ||= {}; ic.koclar ||= []; ic.hikayeler ||= []; ic.sss ||= [];
  const listEd = (key, baslik, ac) => `<div class="card" style="margin-bottom:1rem"><div class="spread"><div><h3 style="margin:0">${baslik}</h3><span class="muted small">${ac}</span></div><button class="btn btn-ghost btn-sm" data-ekle="${key}">+ Ekle</button></div>
      <div class="ed-list" data-list="${key}">${ic[key].map((it, i) => `<div class="ed-row">${ICERIK_ALAN[key].map(([f, l, t]) =>
        t === "check" ? `<label class="check" style="margin:0"><input type="checkbox" data-f="${f}" ${it[f] ? "checked" : ""}/> ${l}</label>`
        : Array.isArray(t) ? `<div class="field" style="margin:0"><label>${l}</label><select data-f="${f}">${t.map((o) => `<option ${it[f] === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>`
        : `<div class="field" style="margin:0"><label>${l}</label>${f === "metin" || f === "cevap" ? `<textarea data-f="${f}" rows="2">${esc(it[f] ?? "")}</textarea>` : `<input data-f="${f}" value="${esc(it[f] ?? "")}"/>`}</div>`).join("")}
        <div class="ed-act"><button class="btn btn-ghost btn-sm" data-up="${key}:${i}" title="Yukarı">↑</button><button class="btn btn-danger btn-sm" data-sil="${key}:${i}">Sil</button></div></div>`).join("") || `<div class="empty">Boş.</div>`}</div></div>`;
  const draw = () => {
    body.innerHTML = `${varsayilan ? `<div class="koc-not" style="margin-bottom:1rem">Site içeriği henüz kaydedilmedi; şu an kodda yazan değerler gösteriliyor. Düzenleyip <b>Kaydet ve yayınla</b>'ya bastığında ana sayfa bu içeriği kullanmaya başlar.</div>` : ""}
      <div class="spread" style="margin-bottom:1rem"><span class="muted small">Değişiklikler kaydedildiği an ana sayfada görünür (kod gerekmez).</span><button class="btn btn-accent" id="siteSave">💾 Kaydet ve yayınla</button></div>
      <div class="card" style="margin-bottom:1rem"><h3 style="margin-top:0">İletişim ve fiyat</h3><div class="grid-2">
        <div class="field"><label>Başlangıç fiyatı (ana sayfada görünür)</label><input id="ic_f" value="${esc(ic.fiyat || "")}" placeholder="2.900 TL"/></div>
        <div class="field"><label>WhatsApp (905xxxxxxxxx)</label><input id="ic_w" value="${esc(ic.iletisim.whatsapp || "")}"/></div>
        <div class="field"><label>E-posta</label><input id="ic_e" value="${esc(ic.iletisim.email || "")}"/></div>
        <div class="field"><label>Instagram bağlantısı</label><input id="ic_i" value="${esc(ic.iletisim.instagram || "")}"/></div></div></div>
      ${listEd("koclar", "Koç kartları", "Ana sayfa ve Koçlarımız sayfasındaki kartlar. Fotoğraf için herkese açık bir görsel bağlantısı yapıştır.")}
      ${listEd("hikayeler", "Başarı hikâyeleri", "Sadece gerçek öğrencilerin izniyle ekleyin. Liste boşsa bölüm görünmez.")}
      ${listEd("sss", "Ek SSS soruları", "Ana sayfadaki ve SSS sayfasındaki sorulara eklenir.")}`;
    const topla = () => {
      ic.fiyat = $("#ic_f", body).value.trim();
      ic.iletisim = { whatsapp: $("#ic_w", body).value.replace(/\D/g, ""), email: $("#ic_e", body).value.trim(), instagram: $("#ic_i", body).value.trim() };
      for (const key of Object.keys(ICERIK_ALAN)) ic[key] = $$(`[data-list="${key}"] .ed-row`, body).map((r) => Object.fromEntries($$("[data-f]", r).map((i) => [i.dataset.f, i.type === "checkbox" ? i.checked : i.value.trim()])));
    };
    $$("[data-ekle]", body).forEach((b) => (b.onclick = () => { topla(); ic[b.dataset.ekle].push({}); draw(); }));
    $$("[data-sil]", body).forEach((b) => (b.onclick = () => { topla(); const [k, i] = b.dataset.sil.split(":"); ic[k].splice(+i, 1); draw(); }));
    $$("[data-up]", body).forEach((b) => (b.onclick = () => { topla(); const [k, i] = b.dataset.up.split(":"); if (+i > 0) [ic[k][i - 1], ic[k][i]] = [ic[k][i], ic[k][i - 1]]; draw(); }));
    $("#siteSave", body).onclick = async (e) => {
      topla(); e.target.disabled = true;
      ic.koclar = ic.koclar.filter((k) => k.ad); ic.hikayeler = ic.hikayeler.filter((h) => h.ad); ic.sss = ic.sss.filter((x) => x.soru && x.cevap);
      try { await setDoc(doc(db, "site", "icerik"), { ...ic, updatedAt: serverTimestamp() }); toast("Yayınlandı. Ana sayfa güncellendi."); drawSite(body); }
      catch (err) { console.error(err); toast("Kaydedilemedi: " + (err.code || ""), "err"); e.target.disabled = false; }
    };
  };
  draw();
}
