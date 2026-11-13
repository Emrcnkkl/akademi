import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, query, where, getDocs, getDoc, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  $, $$, esc, fillBrand, toast, iso, monday, addDays, GUNLER, GUN_KISA, trDate, openModal,
  ALANLAR, DERSLER, GOREV_TUR, DERS_LISTESI, lineChart,
} from "./ui.js";

fillBrand();
const ROL_ADI = { ogrenci: "Öğrenci", koc: "Koç", admin: "Yönetici" };
const show = (id) => ["loading", "loginView", "appView"].forEach((v) => $("#" + v).classList.toggle("hidden", v !== id));
const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const initials = (ad = "") => ad.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const waLink = (tel) => { let t = String(tel || "").replace(/\D/g, ""); if (t.startsWith("0")) t = "9" + t; if (t.length === 10) t = "90" + t; return `https://wa.me/${t}`; };

// ============ AUTH ============
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button"); btn.disabled = true;
  try { await signInWithEmailAndPassword(auth, $("#l_email").value.trim(), $("#l_pass").value); }
  catch { toast("E-posta veya şifre hatalı.", "err"); }
  btn.disabled = false;
});
$("#forgotBtn").addEventListener("click", async () => {
  const email = $("#l_email").value.trim();
  if (!email) return toast("Önce e-posta adresini yaz.", "err");
  try { await sendPasswordResetEmail(auth, email); toast("Şifre sıfırlama bağlantısı gönderildi."); }
  catch { toast("Gönderilemedi. E-postayı kontrol et.", "err"); }
});
$("#logoutBtn").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) return show("loginView");
  show("loading");
  try {
    const [roleSnap, userSnap] = await Promise.all([getDoc(doc(db, "roles", user.uid)), getDoc(doc(db, "users", user.uid))]);
    const role = roleSnap.exists() ? roleSnap.data().role : null;
    const me = userSnap.exists() ? { id: user.uid, ...userSnap.data() } : null;
    if (!role || !me) { toast("Hesabın henüz tanımlanmamış. Yöneticiyle iletişime geç.", "err"); await signOut(auth); return; }
    if (me.aktif === false) { toast("Hesabın pasif durumda.", "err"); await signOut(auth); return; }
    if (role === "admin") { location.href = "admin.html"; return; }

    $("#meName").textContent = me.ad || user.email;
    $("#meRole").textContent = ROL_ADI[role] || role;
    $("#meAvatar").textContent = initials(me.ad);
    show("appView");
    if (role === "ogrenci") await StudentPanel(me);
    else if (role === "koc") await CoachPanel(me);
  } catch (err) {
    console.error(err); toast("Bir hata oluştu: " + err.code, "err"); show("loginView");
  }
});

// ============ ORTAK BİLEŞENLER ============
function weekHeader(weekStart) {
  const end = addDays(weekStart, 6);
  return `${weekStart.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} – ${end.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}`;
}
function weekTasks(tasks, weekStart) {
  const a = iso(weekStart), b = iso(addDays(weekStart, 6));
  return tasks.filter((t) => t.tarih >= a && t.tarih <= b);
}
function completion(list) { return list.length ? Math.round((100 * list.filter((t) => t.tamam).length) / list.length) : 0; }

function renderWeek(el, tasks, weekStart, mode) {
  const today = iso(new Date());
  el.innerHTML = `<div class="week">${GUNLER.map((g, i) => {
    const d = iso(addDays(weekStart, i));
    const dayTasks = tasks.filter((t) => t.tarih === d);
    return `<div class="day ${d === today ? "today" : ""}">
      <h5><span>${GUN_KISA[i]} · ${trDate(d).slice(0, 5)}</span>${mode === "koc" ? `<button class="btn btn-ghost btn-sm" style="padding:.1rem .45rem" data-add="${d}">+</button>` : ""}</h5>
      ${dayTasks.map((t) => taskHtml(t, mode)).join("") || `<div class="muted small">—</div>`}
    </div>`;
  }).join("")}</div>`;
}
function taskHtml(t, mode) {
  const title = `${esc(t.ders)}${t.konu ? " – " + esc(t.konu) : ""}`;
  const meta = `${GOREV_TUR[t.tur] || ""}${t.hedef ? " · " + esc(t.hedef) : ""}`;
  const desc = t.aciklama ? `<div class="t-meta">${esc(t.aciklama)}</div>` : "";
  const note = t.ogrenciNotu ? `<div class="t-note">💬 ${esc(t.ogrenciNotu)}</div>` : "";
  if (mode === "ogrenci") {
    return `<div class="task ${t.tamam ? "done" : ""}">
      <label><input type="checkbox" data-toggle="${t.id}" ${t.tamam ? "checked" : ""}/><span><span class="t-title">${title}</span><div class="t-meta">${meta}</div></span></label>
      ${desc}${note}<div class="task-actions"><button data-note="${t.id}">Not ekle</button></div></div>`;
  }
  return `<div class="task ${t.tamam ? "done" : ""}"><div class="t-title">${title}</div><div class="t-meta">${meta}</div>${desc}${note}
    <div class="task-actions"><button data-edit="${t.id}">Düzenle</button><button data-del="${t.id}">Sil</button></div></div>`;
}

function dersFields(tur, alan) {
  const list = tur === "TYT" ? DERSLER.TYT : DERSLER[alan] || DERSLER.SAY;
  return list.map(([k, ad, max]) => `<div class="grid-3" style="align-items:end">
      <div class="field"><label>${ad} <span class="muted">(${max})</span></label><input type="number" min="0" max="${max}" step="1" data-d="${k}" placeholder="Doğru"/></div>
      <div class="field"><label>&nbsp;</label><input type="number" min="0" max="${max}" step="1" data-y="${k}" placeholder="Yanlış"/></div>
      <div class="field"><label>Net</label><input disabled data-n="${k}" value="0"/></div></div>`).join("");
}

// Deneme ekleme modalı (öğrenci veya koç)
function denemeModal(student, kocId, onSaved) {
  const alanSec = ALANLAR[student.alan] ? student.alan : "SAY";
  const m = openModal(`<h3>Deneme ekle</h3>
    <div class="grid-3">
      <div class="field"><label>Tarih</label><input type="date" id="dn_t" value="${iso(new Date())}"/></div>
      <div class="field"><label>Tür</label><select id="dn_tur"><option>TYT</option><option>AYT</option></select></div>
      <div class="field"><label>Yayın</label><input id="dn_y" maxlength="60" placeholder="Örn. 3D"/></div>
    </div>
    <div class="field hidden" id="dn_alanWrap"><label>AYT alanı</label><select id="dn_alan">${Object.entries(ALANLAR).map(([k, v]) => `<option value="${k}" ${k === alanSec ? "selected" : ""}>${v}</option>`).join("")}</select></div>
    <div id="dn_dersler"></div>
    <div class="spread" style="margin-top:.5rem"><b>Toplam net: <span id="dn_top">0</span></b><button class="btn btn-accent" id="dn_save">Kaydet</button></div>`, { wide: true });
  const el = m.el;
  const draw = () => {
    const tur = $("#dn_tur", el).value;
    $("#dn_alanWrap", el).classList.toggle("hidden", tur !== "AYT");
    $("#dn_dersler", el).innerHTML = dersFields(tur, $("#dn_alan", el).value);
    calc();
  };
  const calc = () => {
    let top = 0;
    $$("[data-n]", el).forEach((n) => {
      const k = n.dataset.n;
      const d = Number($(`[data-d="${k}"]`, el).value) || 0, y = Number($(`[data-y="${k}"]`, el).value) || 0;
      const net = d - y / 4; n.value = net.toFixed(2).replace(".", ","); top += net;
    });
    $("#dn_top", el).textContent = top.toFixed(2).replace(".", ",");
    return top;
  };
  $("#dn_tur", el).addEventListener("change", draw);
  $("#dn_alan", el).addEventListener("change", draw);
  el.addEventListener("input", (e) => { if (e.target.matches("[data-d],[data-y]")) calc(); });
  draw();
  $("#dn_save", el).addEventListener("click", async (e) => {
    const tur = $("#dn_tur", el).value;
    const netler = {};
    $$("[data-n]", el).forEach((n) => {
      const k = n.dataset.n;
      const d = Number($(`[data-d="${k}"]`, el).value) || 0, y = Number($(`[data-y="${k}"]`, el).value) || 0;
      netler[k] = { d, y, net: Math.round((d - y / 4) * 100) / 100 };
    });
    const toplam = Math.round(calc() * 100) / 100;
    e.target.disabled = true;
    try {
      await addDoc(collection(db, "denemeler"), {
        ogrenciId: student.id, kocId: kocId || null, tarih: $("#dn_t", el).value, tur,
        alan: tur === "AYT" ? $("#dn_alan", el).value : null, yayin: $("#dn_y", el).value.trim(),
        netler, toplam, createdAt: serverTimestamp(),
      });
      toast("Deneme kaydedildi."); m.close(); onSaved();
    } catch (err) { console.error(err); toast("Kaydedilemedi.", "err"); e.target.disabled = false; }
  });
}

function renderDenemeler(el, list, { canDelete, onAdd, onDelete }) {
  const sorted = [...list].sort((a, b) => a.tarih.localeCompare(b.tarih));
  const chart = (tur) => {
    const pts = sorted.filter((d) => d.tur === tur).slice(-12).map((d) => ({ x: trDate(d.tarih).slice(0, 5), y: d.toplam }));
    return `<div class="card"><div class="spread"><h3 style="margin:0">${tur} net gelişimi</h3><span class="badge">${pts.length} deneme</span></div>${lineChart(pts, { label: tur + " net" })}</div>`;
  };
  const allLabels = Object.fromEntries(Object.values(DERSLER).flat().map(([k, ad]) => [k, ad]));
  el.innerHTML = `<div class="spread" style="margin-bottom:1rem"><h3 style="margin:0">Denemeler</h3><button class="btn btn-accent btn-sm" id="addDeneme">+ Deneme ekle</button></div>
    <div class="grid-2" style="gap:1rem;margin-bottom:1rem">${chart("TYT")}${chart("AYT")}</div>
    <div class="card table-wrap">${sorted.length ? `<table><thead><tr><th>Tarih</th><th>Tür</th><th>Yayın</th><th>Netler</th><th>Toplam</th><th></th></tr></thead><tbody>
      ${[...sorted].reverse().map((d) => `<tr><td>${trDate(d.tarih)}</td><td><span class="badge">${d.tur}${d.alan ? " " + d.alan : ""}</span></td><td>${esc(d.yayin || "-")}</td>
        <td class="small">${Object.entries(d.netler || {}).map(([k, v]) => `${allLabels[k] || k}: <b>${v.net}</b>`).join(" · ")}</td>
        <td><b>${d.toplam}</b></td><td>${canDelete ? `<button class="btn btn-danger btn-sm" data-deldn="${d.id}">Sil</button>` : ""}</td></tr>`).join("")}
      </tbody></table>` : `<div class="empty">Henüz deneme girilmedi.</div>`}</div>`;
  $("#addDeneme", el).addEventListener("click", onAdd);
  $$("[data-deldn]", el).forEach((b) => b.addEventListener("click", () => onDelete(b.dataset.deldn)));
}

function renderGorusmeler(el, list, { canAdd, onAdd }) {
  const sorted = [...list].sort((a, b) => b.tarih.localeCompare(a.tarih));
  el.innerHTML = `<div class="spread" style="margin-bottom:1rem"><h3 style="margin:0">Görüşme notları</h3>${canAdd ? `<button class="btn btn-accent btn-sm" id="addGr">+ Görüşme notu</button>` : ""}</div>
    <div class="card">${sorted.map((g) => `<div class="note-item"><div class="spread"><b>${trDate(g.tarih)}</b>${g.sure ? `<span class="badge gray">${esc(g.sure)} dk</span>` : ""}</div>
      <p style="white-space:pre-wrap;margin:.4rem 0">${esc(g.notlar)}</p>
      ${g.hedefler ? `<div class="small"><b>Gelecek hafta hedefleri:</b> <span style="white-space:pre-wrap">${esc(g.hedefler)}</span></div>` : ""}</div>`).join("") || `<div class="empty">Henüz görüşme notu yok.</div>`}</div>`;
  if (canAdd) $("#addGr", el).addEventListener("click", onAdd);
}

// ============ ÖĞRENCİ PANELİ ============
async function StudentPanel(me) {
  const root = $("#root");
  let weekStart = monday();
  let coach = null;
  if (me.kocId) { try { const s = await getDoc(doc(db, "users", me.kocId)); if (s.exists()) coach = { id: s.id, ...s.data() }; } catch (e) { console.warn(e); } }

  root.innerHTML = `<div class="page-title">Merhaba ${esc((me.ad || "").split(" ")[0])} 👋</div>
    <p class="muted" style="margin-top:0">${coach ? `Koçun: <b>${esc(coach.ad)}</b>` : "Koç eşleştirmen yakında yapılacak."}</p>
    <div class="tabs" id="sTabs"><button class="on" data-t="hafta">Bu hafta</button><button data-t="deneme">Denemeler</button><button data-t="gorusme">Görüşmeler</button><button data-t="koc">Koçum</button></div>
    <div id="sBody"></div>`;
  const body = $("#sBody");
  let tab = "hafta";
  $$("#sTabs button").forEach((b) => b.addEventListener("click", () => { $$("#sTabs button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); tab = b.dataset.t; draw(); }));

  async function draw() {
    body.innerHTML = `<div class="empty">Yükleniyor…</div>`;
    try {
      if (tab === "hafta") {
        const all = docs(await getDocs(query(collection(db, "gorevler"), where("ogrenciId", "==", me.id))));
        const list = weekTasks(all, weekStart);
        const pct = completion(list);
        body.innerHTML = `<div class="spread" style="margin-bottom:1rem">
            <div class="week-nav"><button class="btn btn-ghost btn-sm" id="prevW">←</button><b>${weekHeader(weekStart)}</b><button class="btn btn-ghost btn-sm" id="nextW">→</button></div>
            <div style="min-width:220px"><div class="spread small"><span>Tamamlanan</span><b>%${pct}</b></div><div class="progress"><i style="width:${pct}%"></i></div></div></div>
          <div id="weekEl"></div>`;
        renderWeek($("#weekEl"), list, weekStart, "ogrenci");
        $("#prevW").onclick = () => { weekStart = addDays(weekStart, -7); draw(); };
        $("#nextW").onclick = () => { weekStart = addDays(weekStart, 7); draw(); };
        $$("[data-toggle]", body).forEach((cb) => cb.addEventListener("change", async () => {
          try { await updateDoc(doc(db, "gorevler", cb.dataset.toggle), { tamam: cb.checked }); draw(); }
          catch { toast("Güncellenemedi.", "err"); cb.checked = !cb.checked; }
        }));
        $$("[data-note]", body).forEach((b) => b.addEventListener("click", () => {
          const t = list.find((x) => x.id === b.dataset.note);
          const m = openModal(`<h3>Koçuna not</h3><p class="muted small">${esc(t.ders)} – ${esc(t.konu || "")}</p>
            <div class="field"><textarea id="nt" maxlength="500" placeholder="Örn. 12 soruyu yapamadım, türevde zincir kuralı karışıyor">${esc(t.ogrenciNotu || "")}</textarea></div>
            <button class="btn btn-accent" id="ntSave">Kaydet</button>`);
          $("#ntSave", m.el).onclick = async () => {
            try { await updateDoc(doc(db, "gorevler", t.id), { ogrenciNotu: $("#nt", m.el).value.trim() }); m.close(); draw(); }
            catch { toast("Kaydedilemedi.", "err"); }
          };
        }));
      } else if (tab === "deneme") {
        const list = docs(await getDocs(query(collection(db, "denemeler"), where("ogrenciId", "==", me.id))));
        renderDenemeler(body, list, {
          canDelete: true,
          onAdd: () => denemeModal(me, me.kocId, draw),
          onDelete: async (id) => { if (!confirm("Deneme silinsin mi?")) return; await deleteDoc(doc(db, "denemeler", id)); draw(); },
        });
      } else if (tab === "gorusme") {
        const list = docs(await getDocs(query(collection(db, "gorusmeler"), where("ogrenciId", "==", me.id))));
        renderGorusmeler(body, list, { canAdd: false });
      } else if (tab === "koc") {
        body.innerHTML = coach ? `<div class="coaches" style="max-width:320px"><div class="coach">
            <div class="coach-photo">${coach.foto ? `<img src="${esc(coach.foto)}" alt="">` : `<span class="coach-ini">${esc(initials(coach.ad))}</span>`}</div>
            <div class="coach-tag"><b>${esc(coach.ad)}</b><span class="coach-school">${esc(coach.universite || "")}${coach.bolum ? " – " + esc(coach.bolum) : ""}</span><span class="coach-rank">${esc(coach.alan || "")}${coach.siralama ? "-" + Number(coach.siralama).toLocaleString("tr-TR") : ""}</span></div></div></div>
          ${coach.telefon ? `<a class="btn btn-accent" style="margin-top:1rem" target="_blank" rel="noopener" href="${waLink(coach.telefon)}">WhatsApp'tan yaz</a>` : ""}`
          : `<div class="card empty">Henüz bir koça atanmadın. Ekibimiz en kısa sürede eşleştirme yapacak.</div>`;
      }
    } catch (err) { console.error(err); body.innerHTML = `<div class="card empty">Veriler yüklenemedi (${esc(err.code || "")}).</div>`; }
  }
  draw();
}

// ============ KOÇ PANELİ ============
async function CoachPanel(me) {
  const root = $("#root");
  let weekStart = monday();
  let students = [], allTasks = [], selId = null, tab = "program";

  async function loadBase() {
    students = docs(await getDocs(query(collection(db, "users"), where("kocId", "==", me.id))))
      .filter((s) => s.aktif !== false).sort((a, b) => (a.ad || "").localeCompare(b.ad || "", "tr"));
    allTasks = docs(await getDocs(query(collection(db, "gorevler"), where("kocId", "==", me.id))));
  }

  function shell() {
    const thisWeek = weekTasks(allTasks, monday());
    const avg = students.length ? Math.round(students.reduce((s, st) => s + completion(thisWeek.filter((t) => t.ogrenciId === st.id)), 0) / students.length) : 0;
    const notes = thisWeek.filter((t) => t.ogrenciNotu).length;
    root.innerHTML = `<div class="page-title">Koç paneli</div><p class="muted" style="margin-top:0">${esc(me.ad)} · ${esc(me.universite || "")}</p>
      <div class="stats">
        <div class="stat"><div class="n">${students.length}</div><div class="l">Aktif öğrenci</div></div>
        <div class="stat"><div class="n">%${avg}</div><div class="l">Bu hafta ort. tamamlama</div></div>
        <div class="stat"><div class="n">${thisWeek.length}</div><div class="l">Bu haftaki görev</div></div>
        <div class="stat"><div class="n">${notes}</div><div class="l">Bu hafta öğrenci notu</div></div>
      </div>
      ${students.length ? `<div class="coach-layout"><div class="stu-list" id="stuList"></div><div id="detail"></div></div>`
        : `<div class="card empty">Henüz sana atanmış öğrenci yok. Eşleştirmeyi yönetici yapar.</div>`}`;
    if (!students.length) return;
    if (!selId || !students.find((s) => s.id === selId)) selId = students[0].id;
    drawList(); drawDetail();
  }

  function drawList() {
    const thisWeek = weekTasks(allTasks, monday());
    $("#stuList").innerHTML = students.map((s) => {
      const pct = completion(thisWeek.filter((t) => t.ogrenciId === s.id));
      return `<button class="stu ${s.id === selId ? "on" : ""}" data-s="${s.id}"><b>${esc(s.ad)}</b><span class="small">${esc(s.sinif || "")} · ${esc(ALANLAR[s.alan] || s.alan || "")}</span>
        <div class="progress"><i style="width:${pct}%"></i></div><span class="small">Bu hafta %${pct}</span></button>`;
    }).join("");
    $$("#stuList .stu").forEach((b) => b.addEventListener("click", () => { selId = b.dataset.s; drawList(); drawDetail(); }));
  }

  function drawDetail() {
    const st = students.find((s) => s.id === selId);
    const d = $("#detail");
    d.innerHTML = `<div class="card" style="margin-bottom:1rem"><div class="spread"><div><h3 style="margin:0">${esc(st.ad)}</h3>
        <div class="muted small">${esc(st.sinif || "")} · ${esc(ALANLAR[st.alan] || "")}${st.hedef ? " · Hedef: " + esc(st.hedef) : ""}</div></div>
        <div class="row">${st.telefon ? `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${waLink(st.telefon)}">Öğrenci WhatsApp</a>` : ""}
        ${st.veliTelefon ? `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="${waLink(st.veliTelefon)}">Veli WhatsApp</a>` : ""}</div></div></div>
      <div class="tabs" id="cTabs">${[["program", "Program"], ["deneme", "Denemeler"], ["gorusme", "Görüşmeler"]].map(([k, v]) => `<button data-t="${k}" class="${tab === k ? "on" : ""}">${v}</button>`).join("")}</div>
      <div id="cBody"></div>`;
    $$("#cTabs button").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.t; drawDetail(); }));
    drawTab(st);
  }

  async function drawTab(st) {
    const body = $("#cBody");
    try {
      if (tab === "program") {
        const list = weekTasks(allTasks.filter((t) => t.ogrenciId === st.id), weekStart);
        const pct = completion(list);
        body.innerHTML = `<div class="spread" style="margin-bottom:1rem">
            <div class="week-nav"><button class="btn btn-ghost btn-sm" id="prevW">←</button><b>${weekHeader(weekStart)}</b><button class="btn btn-ghost btn-sm" id="nextW">→</button></div>
            <div class="row"><span class="badge ${pct >= 80 ? "ok" : pct >= 50 ? "warn" : "gray"}">%${pct} tamamlandı</span>
              <button class="btn btn-ghost btn-sm" id="copyW">Geçen haftayı kopyala</button><button class="btn btn-accent btn-sm" id="addT">+ Görev</button></div></div>
          <div id="weekEl"></div>`;
        renderWeek($("#weekEl"), list, weekStart, "koc");
        $("#prevW").onclick = () => { weekStart = addDays(weekStart, -7); drawTab(st); };
        $("#nextW").onclick = () => { weekStart = addDays(weekStart, 7); drawTab(st); };
        $("#addT").onclick = () => taskModal(st, null, iso(weekStart));
        $$("[data-add]", body).forEach((b) => (b.onclick = () => taskModal(st, null, b.dataset.add)));
        $$("[data-edit]", body).forEach((b) => (b.onclick = () => taskModal(st, list.find((t) => t.id === b.dataset.edit))));
        $$("[data-del]", body).forEach((b) => (b.onclick = async () => {
          if (!confirm("Görev silinsin mi?")) return;
          try { await deleteDoc(doc(db, "gorevler", b.dataset.del)); await refresh(); } catch { toast("Silinemedi.", "err"); }
        }));
        $("#copyW").onclick = () => copyLastWeek(st);
      } else if (tab === "deneme") {
        const list = docs(await getDocs(query(collection(db, "denemeler"), where("kocId", "==", me.id), where("ogrenciId", "==", st.id))));
        renderDenemeler(body, list, { canDelete: false, onAdd: () => denemeModal(st, me.id, () => drawTab(st)), onDelete: () => {} });
      } else if (tab === "gorusme") {
        const list = docs(await getDocs(query(collection(db, "gorusmeler"), where("kocId", "==", me.id), where("ogrenciId", "==", st.id))));
        renderGorusmeler(body, list, { canAdd: true, onAdd: () => gorusmeModal(st) });
      }
    } catch (err) { console.error(err); body.innerHTML = `<div class="card empty">Yüklenemedi (${esc(err.code || "")}).</div>`; }
  }

  function taskModal(st, t, defDate) {
    const m = openModal(`<h3>${t ? "Görevi düzenle" : "Yeni görev"} · ${esc(st.ad)}</h3>
      <div class="grid-2">
        <div class="field"><label>Tarih</label><input type="date" id="g_t" value="${t ? t.tarih : defDate}"/></div>
        <div class="field"><label>Tür</label><select id="g_tur">${Object.entries(GOREV_TUR).map(([k, v]) => `<option value="${k}" ${t?.tur === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Ders</label><select id="g_ders">${DERS_LISTESI.map((x) => `<option ${t?.ders === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        <div class="field"><label>Hedef</label><input id="g_h" maxlength="60" placeholder="Örn. 40 soru / 90 dk" value="${esc(t?.hedef || "")}"/></div>
      </div>
      <div class="field"><label>Konu</label><input id="g_k" maxlength="100" placeholder="Örn. Türev – zincir kuralı" value="${esc(t?.konu || "")}"/></div>
      <div class="field"><label>Açıklama / kaynak</label><input id="g_a" maxlength="200" placeholder="Örn. 345 AYT Mat s. 120-135" value="${esc(t?.aciklama || "")}"/></div>
      <div class="row">${!t ? `<label class="check" style="margin:0"><input type="checkbox" id="g_rep"/> Hafta boyunca her güne ekle</label>` : ""}
        <button class="btn btn-accent" id="g_save" style="margin-left:auto">Kaydet</button></div>`);
    $("#g_save", m.el).onclick = async (e) => {
      const data = {
        tarih: $("#g_t", m.el).value, tur: $("#g_tur", m.el).value, ders: $("#g_ders", m.el).value,
        hedef: $("#g_h", m.el).value.trim(), konu: $("#g_k", m.el).value.trim(), aciklama: $("#g_a", m.el).value.trim(),
      };
      if (!data.tarih) return toast("Tarih seç.", "err");
      e.target.disabled = true;
      try {
        if (t) await updateDoc(doc(db, "gorevler", t.id), data);
        else {
          const rep = $("#g_rep", m.el)?.checked;
          const dates = rep ? [0, 1, 2, 3, 4, 5, 6].map((i) => iso(addDays(monday(new Date(data.tarih + "T12:00")), i))) : [data.tarih];
          const batch = writeBatch(db);
          dates.forEach((tarih) => batch.set(doc(collection(db, "gorevler")), { ...data, tarih, ogrenciId: st.id, kocId: me.id, tamam: false, ogrenciNotu: "", createdAt: serverTimestamp() }));
          await batch.commit();
        }
        m.close(); toast("Kaydedildi."); await refresh();
      } catch (err) { console.error(err); toast("Kaydedilemedi.", "err"); e.target.disabled = false; }
    };
  }

  async function copyLastWeek(st) {
    const prev = weekTasks(allTasks.filter((t) => t.ogrenciId === st.id), addDays(weekStart, -7));
    if (!prev.length) return toast("Geçen hafta görev yok.", "err");
    if (!confirm(`Geçen haftanın ${prev.length} görevi bu haftaya kopyalansın mı?`)) return;
    const batch = writeBatch(db);
    prev.forEach((t) => batch.set(doc(collection(db, "gorevler")), {
      ogrenciId: st.id, kocId: me.id, tarih: iso(addDays(new Date(t.tarih + "T12:00"), 7)), tur: t.tur, ders: t.ders,
      konu: t.konu || "", hedef: t.hedef || "", aciklama: t.aciklama || "", tamam: false, ogrenciNotu: "", createdAt: serverTimestamp(),
    }));
    try { await batch.commit(); toast("Kopyalandı."); await refresh(); } catch (err) { console.error(err); toast("Kopyalanamadı.", "err"); }
  }

  function gorusmeModal(st) {
    const m = openModal(`<h3>Görüşme notu · ${esc(st.ad)}</h3>
      <div class="grid-2"><div class="field"><label>Tarih</label><input type="date" id="gr_t" value="${iso(new Date())}"/></div>
        <div class="field"><label>Süre (dk)</label><input type="number" id="gr_s" min="0" max="300"/></div></div>
      <div class="field"><label>Konuşulanlar</label><textarea id="gr_n" maxlength="3000" style="min-height:130px"></textarea></div>
      <div class="field"><label>Gelecek hafta hedefleri</label><textarea id="gr_h" maxlength="1500"></textarea></div>
      <p class="muted small">Bu not öğrenci panelinde de görünür.</p>
      <button class="btn btn-accent" id="gr_save">Kaydet</button>`);
    $("#gr_save", m.el).onclick = async (e) => {
      const notlar = $("#gr_n", m.el).value.trim();
      if (!notlar) return toast("Not boş olamaz.", "err");
      e.target.disabled = true;
      try {
        await addDoc(collection(db, "gorusmeler"), {
          ogrenciId: st.id, kocId: me.id, tarih: $("#gr_t", m.el).value, sure: $("#gr_s", m.el).value || "",
          notlar, hedefler: $("#gr_h", m.el).value.trim(), createdAt: serverTimestamp(),
        });
        m.close(); toast("Kaydedildi."); drawTab(st);
      } catch (err) { console.error(err); toast("Kaydedilemedi.", "err"); e.target.disabled = false; }
    };
  }

  async function refresh() {
    allTasks = docs(await getDocs(query(collection(db, "gorevler"), where("kocId", "==", me.id))));
    drawList(); drawTab(students.find((s) => s.id === selId));
  }

  try { await loadBase(); shell(); }
  catch (err) { console.error(err); root.innerHTML = `<div class="card empty">Veriler yüklenemedi (${esc(err.code || "")}).</div>`; }
}
