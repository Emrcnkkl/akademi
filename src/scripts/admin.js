import { db } from "./fb.js";
import { auth, secondaryAuth } from "./fb-auth.js";
import {
  onAuthStateChanged, signOut, createUserWithEmailAndPassword, sendPasswordResetEmail,
} from "firebase/auth";
import {
  collection, query, orderBy, getDocs, getDoc, doc, updateDoc, deleteDoc, serverTimestamp, writeBatch, deleteField,
} from "firebase/firestore";
import { $, $$, esc, fillBrand, toast, openModal, tsStr, trDate, ALANLAR, randomPassword } from "./ui.js";

fillBrand();
const ROL_ADI = { ogrenci: "Öğrenci", koc: "Koç", admin: "Yönetici" };
const DURUM = { yeni: ["Yeni", "warn"], arandi: ["Arandı", ""], gorusme: ["Görüşme yapıldı", ""], kabul: ["Kabul / hesap açıldı", "ok"], red: ["Olumsuz", "gray"] };
const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const initials = (ad = "") => ad.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const alanAdi = (a) => ALANLAR[a] || (a === "BELIRSIZ" ? "Belirsiz" : a || "-");

let users = [], ogrBas = [], menBas = [], raporlar = [], tab = "genel";
const waLink = (tel) => { let t = String(tel || "").replace(/\D/g, ""); if (t.startsWith("0")) t = "9" + t; if (t.length === 10) t = "90" + t; return `https://wa.me/${t}`; };
const koclar = () => users.filter((u) => u.rol === "koc" && u.aktif !== false);
const ogrenciSayisi = (kocId) => users.filter((u) => u.rol === "ogrenci" && u.kocId === kocId && u.aktif !== false).length;

$("#logoutBtn").onclick = () => signOut(auth);
$$("#aTabs button").forEach((b) => b.addEventListener("click", () => { $$("#aTabs button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); tab = b.dataset.t; draw(); }));
$("#newUserBtn").onclick = () => userModal(null, {});

onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "/portal"; return; }
  try {
    const role = await getDoc(doc(db, "roles", user.uid));
    if (!role.exists() || role.data().role !== "admin") { location.href = "/portal"; return; }
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
  raporlar = docs(r).sort((a, b) => (b.hafta || "").localeCompare(a.hafta || "") || (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
  const nr = raporlar.filter((x) => x.durum === "bekliyor").length;
  $("#cntRap").textContent = nr || ""; $("#cntRap").classList.toggle("hidden", !nr);
  users = docs(u).sort((a, b) => (a.ad || "").localeCompare(b.ad || "", "tr"));
  ogrBas = docs(o); menBas = docs(m);
  const no = ogrBas.filter((x) => x.durum === "yeni").length, nm = menBas.filter((x) => x.durum === "yeni").length;
  $("#cntOgr").textContent = no || ""; $("#cntOgr").classList.toggle("hidden", !no);
  $("#cntMen").textContent = nm || ""; $("#cntMen").classList.toggle("hidden", !nm);
}
async function reload() { await loadAll(); draw(); }

function draw() {
  const body = $("#aBody");
  if (tab === "genel") drawGenel(body);
  else if (tab === "ogrBas") drawBasvuru(body, "ogrenciBasvurulari", ogrBas, "ogrenci");
  else if (tab === "mentorBas") drawBasvuru(body, "mentorBasvurulari", menBas, "koc");
  else if (tab === "rapor") drawRaporlar(body);
  else drawUsers(body);
}

// ============ GENEL BAKIŞ ============
function drawGenel(body) {
  const ogr = users.filter((u) => u.rol === "ogrenci" && u.aktif !== false);
  const kocsuz = ogr.filter((u) => !u.kocId);
  body.innerHTML = `<div class="stats">
      <div class="stat"><div class="n">${ogr.length}</div><div class="l">Aktif öğrenci</div></div>
      <div class="stat"><div class="n">${koclar().length}</div><div class="l">Aktif koç</div></div>
      <div class="stat"><div class="n">${ogrBas.filter((x) => x.durum === "yeni").length}</div><div class="l">Yeni öğrenci başvurusu</div></div>
      <div class="stat"><div class="n">${menBas.filter((x) => x.durum === "yeni").length}</div><div class="l">Yeni koç başvurusu</div></div>
    </div>
    <div class="grid-2" style="gap:1rem;align-items:start">
      <div class="card"><h3>Koç yükü</h3>${koclar().length ? `<table><thead><tr><th>Koç</th><th>Alan</th><th>Öğrenci</th></tr></thead><tbody>
        ${koclar().map((k) => { const n = ogrenciSayisi(k.id), cap = k.kapasite || 0;
          return `<tr><td><b>${esc(k.ad)}</b><div class="muted small">${esc(k.universite || "")}</div></td><td>${esc(k.alan || "-")}</td>
          <td><span class="badge ${cap && n >= cap ? "err" : "ok"}">${n}${cap ? " / " + cap : ""}</span></td></tr>`; }).join("")}</tbody></table>` : `<div class="empty">Henüz koç yok.</div>`}</div>
      <div class="card"><h3>Koçu olmayan öğrenciler</h3>${kocsuz.length ? kocsuz.map((s) => `<div class="spread note-item">
          <div><b>${esc(s.ad)}</b><div class="muted small">${esc(s.sinif || "")} · ${alanAdi(s.alan)}</div></div>
          <select data-assign="${s.id}" style="width:auto"><option value="">Koç ata…</option>${kocOptions(null, s.alan)}</select></div>`).join("") : `<div class="empty">Tüm öğrenciler eşleşmiş 🎉</div>`}</div>
    </div>`;
  $$("[data-assign]", body).forEach((sel) => sel.addEventListener("change", async () => {
    if (!sel.value) return;
    try { await updateDoc(doc(db, "users", sel.dataset.assign), { kocId: sel.value }); toast("Koç atandı."); reload(); }
    catch (err) { console.error(err); toast("Atanamadı.", "err"); }
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
