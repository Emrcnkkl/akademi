// Panel özellikleri (3): seri & rozetler, pomodoro, bildirimler, randevu, koç takvimi,
// haftalık ders programı, konu çizelgesi, risk uyarıları, program şablonları.
import { db } from "./firebase.js";
import {
  collection, query, where, getDocs, getDoc, doc, setDoc, addDoc, deleteDoc, serverTimestamp, writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { $, $$, esc, toast, iso, monday, addDays, trDate, openModal, GUN_KISA, GUNLER, GOREV_TUR, DERS_LISTESI } from "./ui.js";
import { KONULAR, AYT_ALAN, konuKey } from "./konular.js";

const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const today = () => iso(new Date());
const safe = (p) => p.catch((e) => { console.warn(e); return { docs: [] }; });
const ls = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

// =====================================================================
// SERİ & ROZETLER
// =====================================================================
export function seriHesapla(soru) {
  const gunler = new Set(soru.filter((s) => (s.toplam || 0) > 0 || (s.sure || 0) > 0).map((s) => s.tarih));
  let seri = 0, d = new Date();
  if (!gunler.has(iso(d))) d = addDays(d, -1);          // bugün henüz girilmediyse dünden say
  while (gunler.has(iso(d))) { seri++; d = addDays(d, -1); }
  const sirali = [...gunler].sort(); let enUzun = 0, cur = 0, prev = null;
  for (const g of sirali) { cur = prev && iso(addDays(new Date(prev + "T12:00"), 1)) === g ? cur + 1 : 1; enUzun = Math.max(enUzun, cur); prev = g; }
  return { seri, enUzun, bugunGirildi: gunler.has(today()) };
}

export function renderSeriRozet(el, { soru, den, hata, takip, hedef }) {
  const { seri, enUzun, bugunGirildi } = seriHesapla(soru);
  const toplamSoru = soru.reduce((a, s) => a + (s.toplam || 0), 0);
  const toplamSaat = Math.round(soru.reduce((a, s) => a + (s.sure || 0), 0) / 60);
  const pzt = iso(monday()), pzr = iso(addDays(monday(), 6));
  const haftaSoru = soru.filter((s) => s.tarih >= pzt && s.tarih <= pzr).reduce((a, s) => a + (s.toplam || 0), 0);
  const analiz = den.filter((d) => d.analiz && Object.keys(d.analiz).length).length;
  const k = takip.konular || {}; const tytKeys = Object.entries(KONULAR.TYT).flatMap(([d, ks]) => ks.map((x) => konuKey("TYT", d, x)));
  const tytPct = Math.round((100 * tytKeys.filter((x) => (k[x] || 0) >= 2).length) / tytKeys.length);
  const R = [
    ["🔥", "3 gün seri", enUzun, 3], ["🔥", "7 gün seri", enUzun, 7], ["🏆", "30 gün seri", enUzun, 30],
    ["📚", "1.000 soru", toplamSoru, 1000], ["📚", "5.000 soru", toplamSoru, 5000], ["🎓", "10.000 soru", toplamSoru, 10000],
    ["📝", "İlk deneme", den.length, 1], ["📝", "10 deneme", den.length, 10], ["🔍", "5 deneme analizi", analiz, 5],
    ["📕", "Hata defterinde 20 soru", hata.length, 20], ["✅", "10 hata öğrenildi", hata.filter((h) => h.durum === "ogrenildi").length, 10],
    ["🗺️", "TYT konularının yarısı", tytPct, 50], ["⏱️", "50 saat çalışma", toplamSaat, 50], ["⏱️", "200 saat çalışma", toplamSaat, 200],
  ];
  const kazanilan = R.filter((r) => r[2] >= r[3]).length;
  const hp = hedef ? Math.min(100, Math.round((100 * haftaSoru) / hedef)) : null;
  el.innerHTML = `<div class="card seri-card">
    <div class="seri-top">
      <div class="seri-fire ${seri ? "" : "off"}"><span>🔥</span><b>${seri}</b><small>günlük seri</small></div>
      <div style="flex:1">
        ${hedef ? `<div class="spread small"><span>Bu haftaki soru hedefi</span><b>${haftaSoru.toLocaleString("tr-TR")} / ${hedef.toLocaleString("tr-TR")}</b></div><div class="progress" style="margin:.35rem 0 .6rem"><i style="width:${hp}%"></i></div>`
          : `<div class="small muted" style="margin-bottom:.5rem">Bu hafta ${haftaSoru.toLocaleString("tr-TR")} soru çözdün. Haftalık hedefini koçun belirleyebilir.</div>`}
        <div class="small muted">${bugunGirildi ? "Bugünkü kaydını girdin, seri devam ediyor 💪" : seri ? "Seriyi korumak için bugünkü sorularını girmeyi unutma!" : "Bugün soru girerek yeni bir seri başlat."} · En uzun seri: <b>${enUzun} gün</b></div>
      </div>
    </div>
    <div class="spread" style="margin:1rem 0 .5rem"><h4 style="margin:0">Rozetler</h4><span class="muted small">${kazanilan} / ${R.length}</span></div>
    <div class="rozetler">${R.map(([ic, ad, v, h]) => `<div class="rozet ${v >= h ? "on" : ""}" title="${esc(ad)}: ${Math.min(v, h).toLocaleString("tr-TR")} / ${h.toLocaleString("tr-TR")}"><span>${ic}</span><b>${esc(ad)}</b>${v >= h ? "" : `<i style="--p:${Math.min(100, Math.round((100 * v) / h))}%"></i>`}</div>`).join("")}</div>
  </div>`;
}

// =====================================================================
// PANEL İÇİ POMODORO (süre bitince çalışma süresine eklenir)
// =====================================================================
export function mountPomodoro(me) {
  if ($("#pomoFab")) return;
  const KEY = "pomoState-" + me.id;
  const wrap = document.createElement("div");
  wrap.innerHTML = `<button class="pomo-fab" id="pomoFab" title="Odak zamanlayıcı">⏱️<span id="pomoMini"></span></button>
    <div class="pomo-pop hidden" id="pomoPop">
      <div class="spread"><b>Odak zamanlayıcı</b><button class="modal-x" style="position:static" id="pomoClose">×</button></div>
      <div class="seg" id="pomoMode" style="margin:.6rem 0"><button data-m="odak" class="on">Odak 25</button><button data-m="kisa">Mola 5</button><button data-m="uzun">Uzun 15</button></div>
      <div class="pomo-t" id="pomoT">25:00</div>
      <div class="progress" style="margin:.4rem 0 1rem"><i id="pomoBar" style="width:0"></i></div>
      <div class="row" style="justify-content:center"><button class="btn btn-accent btn-sm" id="pomoStart">Başla</button><button class="btn btn-ghost btn-sm" id="pomoReset">Sıfırla</button></div>
      <p class="muted small" style="margin:.8rem 0 0;text-align:center">Odak turu bitince süre otomatik olarak <b>Soru & süre</b>'ye eklenir. Bugün: <b id="pomoToday">0</b> tur</p>
    </div>`;
  document.body.appendChild(wrap);
  const DUR = { odak: 25, kisa: 5, uzun: 15 };
  let st = ls.get(KEY, { mode: "odak", end: null, left: 25 * 60, tur: 0, gun: today() });
  if (st.gun !== today()) st = { ...st, tur: 0, gun: today() };
  let timer = null;
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const total = () => DUR[st.mode] * 60;
  const remaining = () => (st.end ? Math.max(0, Math.round((st.end - Date.now()) / 1000)) : st.left);
  const render = () => {
    const r = remaining();
    $("#pomoT").textContent = fmt(r); $("#pomoBar").style.width = `${(100 * (total() - r)) / total()}%`;
    $("#pomoMini").textContent = st.end ? fmt(r) : ""; $("#pomoFab").classList.toggle("run", !!st.end);
    $("#pomoStart").textContent = st.end ? "Duraklat" : "Başla"; $("#pomoToday").textContent = st.tur;
    $$("#pomoMode button").forEach((b) => b.classList.toggle("on", b.dataset.m === st.mode));
    ls.set(KEY, st);
  };
  const setMode = (m) => { st = { ...st, mode: m, end: null, left: DUR[m] * 60 }; clearInterval(timer); timer = null; render(); };
  const finish = async () => {
    clearInterval(timer); timer = null;
    try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(); o.frequency.value = 880; o.connect(c.destination); o.start(); o.stop(c.currentTime + .4); } catch {}
    if (st.mode === "odak") {
      st.tur++; toast(`Odak turu bitti! ${DUR.odak} dakika çalışma süresine eklendi.`);
      try {   // bugünkü soru kaydına süre ekle
        const ref = doc(db, "soruKayit", `${me.id}_${today()}`); const s = await getDoc(ref); const cur = s.exists() ? s.data() : {};
        await setDoc(ref, { ogrenciId: me.id, kocId: me.kocId || null, tarih: today(), dersler: cur.dersler || {}, toplam: cur.toplam || 0, sure: (cur.sure || 0) + DUR.odak, updatedAt: serverTimestamp() });
      } catch (e) { console.error(e); toast("Süre kaydedilemedi.", "err"); }
      setMode(st.tur % 4 === 0 ? "uzun" : "kisa");
    } else { toast("Mola bitti, yeni odak turuna hazır mısın?"); setMode("odak"); }
  };
  const run = () => { clearInterval(timer); timer = setInterval(() => { render(); if (remaining() <= 0) finish(); }, 500); };
  $("#pomoFab").onclick = () => $("#pomoPop").classList.toggle("hidden");
  $("#pomoClose").onclick = () => $("#pomoPop").classList.add("hidden");
  $$("#pomoMode button").forEach((b) => (b.onclick = () => setMode(b.dataset.m)));
  $("#pomoStart").onclick = () => { if (st.end) { st.left = remaining(); st.end = null; clearInterval(timer); timer = null; } else { st.end = Date.now() + st.left * 1000; run(); } render(); };
  $("#pomoReset").onclick = () => setMode(st.mode);
  if (st.end) { if (remaining() <= 0) finish(); else run(); }
  render();
}

// =====================================================================
// BİLDİRİM MERKEZİ (zil) — veriden türetilir, "son görülme" tarayıcıda saklanır
// =====================================================================
export function mountBildirim(me, role, { goTab }) {
  const host = $(".user-chip"); if (!host || $("#bellBtn")) return;
  const KEY = "bildirimSon-" + me.id;
  host.insertAdjacentHTML("afterbegin", `<div class="bell-wrap"><button class="bell" id="bellBtn" title="Bildirimler">🔔<span class="badge err hidden" id="bellN"></span></button>
    <div class="bell-pop hidden" id="bellPop"><div class="spread" style="padding:.6rem .9rem;border-bottom:1px solid var(--line)"><b>Bildirimler</b><button class="btn btn-ghost btn-sm" id="bellRead">Tümünü okundu say</button></div><div id="bellList"><div class="empty">Yükleniyor…</div></div></div></div>`);
  let items = [];
  const load = async () => {
    const son = ls.get(KEY, 0), now = Date.now(), t = today(), ms = (x) => (x?.toMillis ? x.toMillis() : 0);
    items = [];
    const [duy] = await Promise.all([safe(getDocs(collection(db, "duyurular")))]);
    docs(duy).filter((d) => d.aktif !== false && (d.hedef === "herkes" || d.hedef === role)).forEach((d) => items.push({ ic: "📣", t: d.baslik, s: d.metin, at: ms(d.createdAt), tab: null }));
    if (role === "ogrenci") {
      const [gor, mes, hata, rand, gnot] = await Promise.all([
        safe(getDocs(query(collection(db, "gorevler"), where("ogrenciId", "==", me.id)))),
        safe(getDocs(query(collection(db, "mesajlar"), where("ogrenciId", "==", me.id)))),
        safe(getDocs(query(collection(db, "hataDefteri"), where("ogrenciId", "==", me.id)))),
        safe(getDocs(query(collection(db, "randevular"), where("ogrenciId", "==", me.id)))),
        safe(getDocs(query(collection(db, "gorusmeler"), where("ogrenciId", "==", me.id)))),
      ]);
      const yeniGorev = docs(gor).filter((g) => ms(g.createdAt) > son);
      if (yeniGorev.length) items.push({ ic: "📋", t: `Koçun ${yeniGorev.length} yeni görev ekledi`, s: yeniGorev.slice(0, 2).map((g) => g.ders + (g.konu ? " – " + g.konu : "")).join(", "), at: Math.max(...yeniGorev.map((g) => ms(g.createdAt))), tab: "hafta" });
      const okun = docs(mes).filter((m) => m.from !== me.id && !m.okundu);
      if (okun.length) items.push({ ic: "💬", t: `${okun.length} okunmamış mesaj`, s: okun[okun.length - 1].text, at: now, tab: "mesaj", sabit: true });
      const due = docs(hata).filter((h) => h.durum !== "ogrenildi" && (h.tekrarTarihi || "") <= t).length;
      if (due) items.push({ ic: "📕", t: `Hata defterinde ${due} soru tekrar bekliyor`, s: "Aralıklı tekrar zamanı geldi.", at: now, tab: "hata", sabit: true });
      docs(rand).filter((r) => r.tarih >= t && r.tarih <= iso(addDays(new Date(), 1))).forEach((r) => items.push({ ic: "📅", t: `Görüşmen ${r.tarih === t ? "bugün" : "yarın"} ${r.saat}'te`, s: "Koçunla birebir görüşme", at: now, tab: "koc", sabit: true }));
      docs(gnot).filter((g) => ms(g.createdAt) > son).forEach((g) => items.push({ ic: "🗒️", t: "Yeni görüşme notu", s: g.hedefler || g.notlar, at: ms(g.createdAt), tab: "gorusme" }));
    } else if (role === "koc") {
      const [mes, rand] = await Promise.all([
        safe(getDocs(query(collection(db, "mesajlar"), where("kocId", "==", me.id)))),
        safe(getDocs(query(collection(db, "randevular"), where("kocId", "==", me.id)))),
      ]);
      const okun = docs(mes).filter((m) => m.from !== me.id && !m.okundu);
      if (okun.length) items.push({ ic: "💬", t: `${okun.length} okunmamış öğrenci mesajı`, s: okun[okun.length - 1].text, at: now, tab: null, sabit: true });
      const r = docs(rand);
      r.filter((x) => ms(x.createdAt) > son).forEach((x) => items.push({ ic: "📅", t: "Yeni randevu", s: `${trDate(x.tarih)} ${x.saat}`, at: ms(x.createdAt), tab: "takvim" }));
      const bugunR = r.filter((x) => x.tarih === t).length;
      if (bugunR) items.push({ ic: "🗓️", t: `Bugün ${bugunR} görüşmen var`, s: "Takvimden detaylara bak.", at: now, tab: "takvim", sabit: true });
    }
    items.sort((a, b) => b.at - a.at);
    const yeni = items.filter((i) => i.sabit || i.at > son).length;
    $("#bellN").textContent = yeni; $("#bellN").classList.toggle("hidden", !yeni);
    $("#bellList").innerHTML = items.length ? items.map((i, n) => `<button class="bell-item ${i.sabit || i.at > son ? "new" : ""}" data-i="${n}"><span class="bi">${i.ic}</span><span><b>${esc(i.t)}</b><small>${esc((i.s || "").slice(0, 110))}</small></span></button>`).join("") : `<div class="empty">Yeni bildirim yok.</div>`;
    $$("#bellList [data-i]").forEach((b) => (b.onclick = () => { const it = items[+b.dataset.i]; $("#bellPop").classList.add("hidden"); if (it.tab) goTab(it.tab); }));
  };
  $("#bellBtn").onclick = (e) => { e.stopPropagation(); $("#bellPop").classList.toggle("hidden"); };
  document.addEventListener("click", (e) => { if (!e.target.closest(".bell-wrap")) $("#bellPop")?.classList.add("hidden"); });
  $("#bellRead").onclick = () => { ls.set(KEY, Date.now()); load(); };
  load(); setInterval(load, 5 * 60 * 1000);
}

// =====================================================================
// RANDEVU (öğrenci) + KOÇ TAKVİMİ
// =====================================================================
const SAATLER = Array.from({ length: 30 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`); // 08:00–22:30
const gunIdx = (d) => (d.getDay() + 6) % 7;   // Pazartesi = 0

export async function renderRandevu(el, me, coach) {
  if (!coach) { el.innerHTML = `<div class="card empty">Koç eşleştirmen yapılınca buradan görüşme saati seçebilirsin.</div>`; return; }
  const [tak, randSnap] = await Promise.all([
    getDoc(doc(db, "kocTakvim", coach.id)).catch(() => null),
    safe(getDocs(query(collection(db, "randevular"), where("kocId", "==", coach.id)))),
  ]);
  const ayar = tak?.exists?.() ? tak.data() : { slots: [] };
  const randevular = docs(randSnap).filter((r) => r.tarih >= today());
  const benim = randevular.filter((r) => r.ogrenciId === me.id).sort((a, b) => (a.tarih + a.saat).localeCompare(b.tarih + b.saat));
  const dolu = new Set(randevular.map((r) => r.tarih + "_" + r.saat));
  const gunler = [...Array(14)].map((_, i) => addDays(new Date(), i));
  const now = new Date();
  el.innerHTML = `<div class="card"><div class="spread"><h3 style="margin:0">📅 Görüşme randevusu</h3><span class="muted small">${ayar.sure || 45} dk · birebir görüntülü</span></div>
    ${benim.length ? `<div style="margin:.8rem 0">${benim.map((r) => `<div class="mini-row"><span>✅ <b>${trDate(r.tarih)} ${GUNLER[gunIdx(new Date(r.tarih + "T12:00"))]}</b> · ${r.saat}</span><button class="btn btn-ghost btn-sm" data-iptal="${r.id}">İptal et</button></div>`).join("")}</div>` : `<p class="muted small" style="margin:.6rem 0">Henüz bir randevun yok. Aşağıdan koçunun müsait olduğu bir saati seç.</p>`}
    ${(ayar.slots || []).length ? `<div class="rv-days">${gunler.map((g) => {
      const t = iso(g), sl = (ayar.slots || []).filter((s) => s.gun === gunIdx(g)).map((s) => s.saat).sort()
        .filter((s) => new Date(`${t}T${s}`) > now);
      if (!sl.length) return "";
      return `<div class="rv-day"><b>${GUN_KISA[gunIdx(g)]} ${trDate(t).slice(0, 5)}</b><div class="chips">${sl.map((s) => dolu.has(t + "_" + s)
        ? `<button class="chip" disabled style="opacity:.4;text-decoration:line-through">${s}</button>`
        : `<button class="chip" data-al="${t}_${s}">${s}</button>`).join("")}</div></div>`;
    }).join("")}</div>` : `<div class="empty">Koçun henüz müsait saatlerini girmedi. Mesajlardan koçunla gün belirleyebilirsin.</div>`}
  </div>`;
  $$("[data-al]", el).forEach((b) => (b.onclick = async () => {
    const [tarih, saat] = b.dataset.al.split("_");
    if (!confirm(`${trDate(tarih)} ${saat} için randevu alınsın mı?`)) return;
    try {
      await setDoc(doc(db, "randevular", `${coach.id}_${tarih}_${saat}`), { kocId: coach.id, ogrenciId: me.id, tarih, saat, durum: "onayli", createdAt: serverTimestamp() });
      toast("Randevun alındı ✓"); renderRandevu(el, me, coach);
    } catch (e) { console.error(e); toast("Bu saat az önce dolmuş olabilir, başka bir saat seç.", "err"); renderRandevu(el, me, coach); }
  }));
  $$("[data-iptal]", el).forEach((b) => (b.onclick = async () => {
    if (!confirm("Randevu iptal edilsin mi?")) return;
    try { await deleteDoc(doc(db, "randevular", b.dataset.iptal)); toast("Randevu iptal edildi."); renderRandevu(el, me, coach); } catch { toast("İptal edilemedi.", "err"); }
  }));
}

export async function renderKocTakvim(el, me, students) {
  let weekStart = monday();
  const ref = doc(db, "kocTakvim", me.id);
  let ayar = { slots: [], sure: 45 };
  try { const s = await getDoc(ref); if (s.exists()) ayar = { slots: [], sure: 45, ...s.data() }; } catch (e) { console.warn(e); }
  const ad = (id) => students.find((s) => s.id === id)?.ad || "Öğrenci";
  const draw = async () => {
    const a = iso(weekStart), b = iso(addDays(weekStart, 6));
    const rand = docs(await safe(getDocs(query(collection(db, "randevular"), where("kocId", "==", me.id))))).filter((r) => r.tarih >= a && r.tarih <= b);
    el.innerHTML = `<div class="spread" style="margin-bottom:1rem">
        <div class="week-nav"><button class="btn btn-ghost btn-sm" id="tkPrev">←</button><b>${trDate(a).slice(0, 5)} – ${trDate(b).slice(0, 5)}</b><button class="btn btn-ghost btn-sm" id="tkNext">→</button></div>
        <div class="row"><span class="badge">${rand.length} görüşme</span><button class="btn btn-accent btn-sm" id="tkEdit">Müsait saatlerimi düzenle</button></div></div>
      <div class="week">${GUNLER.map((g, i) => {
        const t = iso(addDays(weekStart, i));
        const sl = [...new Set([...(ayar.slots || []).filter((s) => s.gun === i).map((s) => s.saat), ...rand.filter((r) => r.tarih === t).map((r) => r.saat)])].sort();
        return `<div class="day ${t === today() ? "today" : ""}"><h5><span>${GUN_KISA[i]} · ${trDate(t).slice(0, 5)}</span></h5>
          ${sl.map((s) => { const r = rand.find((x) => x.tarih === t && x.saat === s);
            return r ? `<div class="task tk-dolu"><div class="t-title">${s} · ${esc(ad(r.ogrenciId))}</div><div class="task-actions"><button data-rsil="${r.id}">İptal</button></div></div>`
              : `<div class="task tk-bos"><div class="t-meta">${s} · müsait</div></div>`; }).join("") || `<div class="muted small">—</div>`}</div>`;
      }).join("")}</div>
      <p class="muted small" style="margin-top:.8rem">Öğrencilerin, müsait saatlerinden önümüzdeki 14 gün için randevu alabilir. Her saat ${ayar.sure} dakikalık bir görüşmedir.</p>`;
    $("#tkPrev", el).onclick = () => { weekStart = addDays(weekStart, -7); draw(); };
    $("#tkNext", el).onclick = () => { weekStart = addDays(weekStart, 7); draw(); };
    $$("[data-rsil]", el).forEach((x) => (x.onclick = async () => { if (!confirm("Randevu iptal edilsin mi?")) return; await deleteDoc(doc(db, "randevular", x.dataset.rsil)).catch(() => toast("İptal edilemedi.", "err")); draw(); }));
    $("#tkEdit", el).onclick = () => {
      const sec = new Set((ayar.slots || []).map((s) => `${s.gun}_${s.saat}`));
      const m = openModal(`<h3>Müsait saatlerim</h3><p class="muted small">Her hafta tekrar eden müsait saatlerini işaretle. Öğrencilerin bu saatlerden randevu alır.</p>
        <div class="field"><label>Görüşme süresi</label><select id="tkS" style="width:auto">${[30, 45, 60].map((d) => `<option value="${d}" ${ayar.sure == d ? "selected" : ""}>${d} dakika</option>`).join("")}</select></div>
        <div class="slot-grid"><div></div>${GUN_KISA.map((g) => `<b>${g}</b>`).join("")}
          ${SAATLER.map((s) => `<span class="small muted">${s}</span>${GUN_KISA.map((_, i) => `<button type="button" class="slot ${sec.has(i + "_" + s) ? "on" : ""}" data-s="${i}_${s}"></button>`).join("")}`).join("")}</div>
        <button class="btn btn-accent" id="tkSave" style="margin-top:1rem">Kaydet</button>`, { wide: true });
      $$(".slot", m.el).forEach((x) => (x.onclick = () => x.classList.toggle("on")));
      $("#tkSave", m.el).onclick = async () => {
        ayar = { slots: $$(".slot.on", m.el).map((x) => { const [g, s] = x.dataset.s.split("_"); return { gun: +g, saat: s }; }), sure: +$("#tkS", m.el).value };
        try { await setDoc(ref, { ...ayar, updatedAt: serverTimestamp() }); toast("Müsait saatler kaydedildi."); m.close(); draw(); } catch (e) { console.error(e); toast("Kaydedilemedi.", "err"); }
      };
    };
  };
  draw();
}

// =====================================================================
// HAFTALIK DERS PROGRAMI (saat saat, koç girer)
// =====================================================================
export async function renderDersProgrami(el, student, { editable, kocId, compact = false }) {
  let weekStart = monday();
  const load = async (ws) => { try { const s = await getDoc(doc(db, "dersProgrami", `${student.id}_${iso(ws)}`)); return s.exists() ? s.data().bloklar || [] : []; } catch { return []; } };
  const renk = (d) => ({ "Türkçe": "#9b0000", "Matematik": "#12172e", "Geometri": "#3a3f57", "Fizik": "#2f54c9", "Kimya": "#1f9d63", "Biyoloji": "#5a9d1f", "Tarih": "#a0522d", "Coğrafya": "#2a8a8a", "Edebiyat": "#7a1f9d", "Felsefe": "#c27a00", "Din Kültürü": "#6c7084", "Yabancı Dil": "#c2185b" }[d] || "#6c7084");
  const draw = async () => {
    const bloklar = await load(weekStart);
    const save = async () => {
      await setDoc(doc(db, "dersProgrami", `${student.id}_${iso(weekStart)}`), { ogrenciId: student.id, kocId, hafta: iso(weekStart), bloklar, updatedAt: serverTimestamp() });
    };
    if (compact) {   // özet ekranında: sadece bugünün blokları
      const g = gunIdx(new Date()), list = bloklar.filter((b) => b.gun === g).sort((a, b) => a.bas.localeCompare(b.bas));
      el.innerHTML = `<div class="card"><div class="spread"><h3 style="margin:0">🕘 Bugünkü ders programın</h3></div>${list.length ? list.map((b) => `<div class="mini-row"><span><span class="dot" style="background:${renk(b.ders)}"></span><b>${b.bas}–${b.bit}</b> · ${esc(b.ders)}${b.not ? ` <span class="muted small">· ${esc(b.not)}</span>` : ""}</span></div>`).join("") : `<div class="empty">Bugün için ders programı girilmemiş.</div>`}</div>`;
      return;
    }
    el.innerHTML = `<div class="card" style="margin-bottom:1rem"><div class="spread" style="margin-bottom:.8rem">
        <div class="row"><h3 style="margin:0">🕘 Haftalık ders programı</h3><div class="week-nav"><button class="btn btn-ghost btn-sm" id="dpPrev">←</button><b class="small">${trDate(iso(weekStart)).slice(0, 5)} – ${trDate(iso(addDays(weekStart, 6))).slice(0, 5)}</b><button class="btn btn-ghost btn-sm" id="dpNext">→</button></div></div>
        ${editable ? `<div class="row"><button class="btn btn-ghost btn-sm" id="dpCopy">Geçen haftayı kopyala</button><button class="btn btn-accent btn-sm" id="dpAdd">+ Ders bloğu</button></div>` : ""}</div>
      ${bloklar.length ? `<div class="tt">${GUN_KISA.map((g, i) => `<div class="tt-day ${i === gunIdx(new Date()) && iso(weekStart) === iso(monday()) ? "today" : ""}"><h5>${g}</h5>${bloklar.map((b, idx) => ({ ...b, idx })).filter((b) => b.gun === i).sort((a, b) => a.bas.localeCompare(b.bas)).map((b) =>
          `<div class="tt-b" style="border-color:${renk(b.ders)}"><b>${b.bas}–${b.bit}</b><span>${esc(b.ders)}</span>${b.not ? `<small>${esc(b.not)}</small>` : ""}${editable ? `<button data-bsil="${b.idx}" title="Sil">×</button>` : ""}</div>`).join("") || `<div class="muted small">—</div>`}</div>`).join("")}</div>`
        : `<div class="empty">${editable ? "Bu hafta için ders programı yok. \"+ Ders bloğu\" ile saat saat program oluştur ya da geçen haftayı kopyala." : "Koçun bu hafta için henüz saatlik ders programı girmedi."}</div>`}</div>`;
    $("#dpPrev", el).onclick = () => { weekStart = addDays(weekStart, -7); draw(); };
    $("#dpNext", el).onclick = () => { weekStart = addDays(weekStart, 7); draw(); };
    if (!editable) return;
    $$("[data-bsil]", el).forEach((x) => (x.onclick = async () => { bloklar.splice(+x.dataset.bsil, 1); await save().catch(() => toast("Kaydedilemedi.", "err")); draw(); }));
    $("#dpCopy", el).onclick = async () => {
      const prev = await load(addDays(weekStart, -7));
      if (!prev.length) return toast("Geçen hafta ders programı yok.", "err");
      if (bloklar.length && !confirm("Bu haftanın programı geçen haftanınkiyle değiştirilsin mi?")) return;
      bloklar.splice(0, bloklar.length, ...prev); await save().catch(() => toast("Kaydedilemedi.", "err")); toast("Kopyalandı."); draw();
    };
    $("#dpAdd", el).onclick = () => {
      const m = openModal(`<h3>Ders bloğu ekle</h3>
        <div class="field"><label>Günler</label><div class="chips" id="dpG">${GUN_KISA.map((g, i) => `<button type="button" class="chip" data-g="${i}">${g}</button>`).join("")}</div></div>
        <div class="grid-3"><div class="field"><label>Başlangıç</label><input type="time" id="dpB" value="16:00"/></div><div class="field"><label>Bitiş</label><input type="time" id="dpE" value="17:30"/></div>
          <div class="field"><label>Ders</label><select id="dpD">${DERS_LISTESI.map((d) => `<option>${d}</option>`).join("")}<option>Deneme</option><option>Tekrar</option><option>Mola / spor</option></select></div></div>
        <div class="field"><label>Not / konu</label><input id="dpN" maxlength="80" placeholder="Örn. Türev soru çözümü"/></div>
        <button class="btn btn-accent" id="dpS">Ekle</button>`);
      $$("#dpG .chip", m.el).forEach((c) => (c.onclick = () => c.classList.toggle("on")));
      $("#dpS", m.el).onclick = async () => {
        const gs = $$("#dpG .chip.on", m.el).map((c) => +c.dataset.g), bas = $("#dpB", m.el).value, bit = $("#dpE", m.el).value;
        if (!gs.length) return toast("En az bir gün seç.", "err");
        if (!bas || !bit || bit <= bas) return toast("Saatleri kontrol et.", "err");
        gs.forEach((g) => bloklar.push({ gun: g, bas, bit, ders: $("#dpD", m.el).value, not: $("#dpN", m.el).value.trim() }));
        try { await save(); m.close(); draw(); } catch (e) { console.error(e); toast("Kaydedilemedi.", "err"); }
      };
    };
  };
  draw();
}

// =====================================================================
// KONU ÇİZELGESİ (tüm konular tek bakışta)
// =====================================================================
export function renderKonuCizelge(el, student, takip) {
  const k = takip.konular || {}, tk = takip.konuTekrar || {}, t = today();
  const bolum = (sin, dersler) => `<div class="cz-sec"><h4>${sin}</h4>${dersler.map((d) => {
    const ks = KONULAR[sin][d] || [], b = ks.filter((x) => (k[konuKey(sin, d, x)] || 0) >= 2).length;
    return `<div class="cz-row"><span class="cz-ders">${esc(d)} <small class="muted">${b}/${ks.length}</small></span><div class="cz-cells">${ks.map((x) => {
      const key = konuKey(sin, d, x), v = k[key] || 0, due = v >= 2 && tk[key]?.sonraki <= t;
      return `<i class="cz c${v} ${due ? "due" : ""}" title="${esc(x)} · ${["Başlanmadı", "Çalışılıyor", "Bitti", "Tekrar edildi"][v]}${due ? " · tekrar zamanı" : ""}"></i>`; }).join("")}</div></div>`;
  }).join("")}</div>`;
  el.innerHTML = `<div class="card"><div class="spread"><h3 style="margin:0">Konu çizelgesi</h3>
      <div class="cz-legend small"><span><i class="cz c0"></i>Başlanmadı</span><span><i class="cz c1"></i>Çalışılıyor</span><span><i class="cz c2"></i>Bitti</span><span><i class="cz c3"></i>Tekrar edildi</span><span><i class="cz c2 due"></i>Tekrar zamanı</span></div></div>
    ${bolum("TYT", Object.keys(KONULAR.TYT))}${bolum("AYT", AYT_ALAN[student.alan] || AYT_ALAN.SAY)}
    <p class="muted small" style="margin:.6rem 0 0">Kutuların üzerine gelince konu adı görünür.</p></div>`;
}

// =====================================================================
// RİSK UYARILARI (koç)
// =====================================================================
export function riskHesapla(st, { tasks, soru, den, gor, odeme, unread }) {
  const r = [], t = today(), gun = (d) => Math.floor((new Date(t) - new Date(d)) / 86400000);
  const s = soru.filter((x) => x.ogrenciId === st.id).map((x) => x.tarih).sort().pop();
  if (!s) r.push(["warn", "Hiç soru kaydı girmemiş"]); else if (gun(s) >= 3) r.push(["err", `${gun(s)} gündür soru girmiyor`]);
  const pzt = iso(monday()), w = tasks.filter((x) => x.ogrenciId === st.id && x.tarih >= pzt && x.tarih <= t);
  if (w.length >= 3) { const p = Math.round((100 * w.filter((x) => x.tamam).length) / w.length); if (p < 50) r.push(["err", `Bu hafta görevlerin %${p}'ini yapmış`]); }
  const d = den.filter((x) => x.ogrenciId === st.id && x.tur === "TYT").sort((a, b) => a.tarih.localeCompare(b.tarih));
  if (d.length >= 2 && d[d.length - 1].toplam < d[d.length - 2].toplam - 5) r.push(["warn", `Son TYT neti ${Math.round(d[d.length - 2].toplam - d[d.length - 1].toplam)} net düştü`]);
  const g = gor.filter((x) => x.ogrenciId === st.id).map((x) => x.tarih).sort().pop();
  if (!g || gun(g) > 8) r.push(["warn", g ? `${gun(g)} gündür görüşme notu yok` : "Henüz görüşme notu yok"]);
  if (unread?.[st.id]) r.push(["warn", `${unread[st.id]} okunmamış mesajı var`]);
  const o = odeme.filter((x) => x.ogrenciId === st.id).sort((a, b) => (b.bitis || "").localeCompare(a.bitis || ""))[0];
  if (o) { const k = Math.ceil((new Date(o.bitis + "T23:59") - new Date()) / 86400000); if (k < 0) r.push(["err", "Koçluk dönemi bitmiş"]); else if (k <= 5) r.push(["warn", `Dönemi ${k} gün içinde bitiyor`]); }
  return r;
}

// =====================================================================
// PROGRAM ŞABLONLARI (koç)
// =====================================================================
export async function sablonKaydet(me, tasks, weekStart) {
  if (!tasks.length) return toast("Bu hafta kaydedilecek görev yok.", "err");
  const m = openModal(`<h3>Şablon olarak kaydet</h3><p class="muted small">Bu haftanın ${tasks.length} görevi gün ve içerikleriyle şablona kaydedilir; başka öğrencilere tek tıkla uygulayabilirsin.</p>
    <div class="field"><label>Şablon adı</label><input id="sbA" maxlength="60" placeholder="Örn. Sayısal 12. sınıf – yoğun hafta"/></div><button class="btn btn-accent" id="sbS">Kaydet</button>`);
  $("#sbS", m.el).onclick = async () => {
    const ad = $("#sbA", m.el).value.trim(); if (!ad) return toast("Şablon adı yaz.", "err");
    const gorevler = tasks.map((t) => ({ gun: gunIdx(new Date(t.tarih + "T12:00")), ders: t.ders, konu: t.konu || "", tur: t.tur, hedef: t.hedef || "", aciklama: t.aciklama || "" }));
    try { await addDoc(collection(db, "sablonlar"), { kocId: me.id, ad, gorevler, createdAt: serverTimestamp() }); toast("Şablon kaydedildi."); m.close(); } catch (e) { console.error(e); toast("Kaydedilemedi.", "err"); }
  };
}
export async function sablonUygula(me, st, weekStart, onDone) {
  let list = [];
  try { list = docs(await getDocs(query(collection(db, "sablonlar"), where("kocId", "==", me.id)))); } catch (e) { console.error(e); }
  const m = openModal(`<h3>Şablon uygula · ${esc(st.ad)}</h3><p class="muted small">Seçtiğin şablonun görevleri ${trDate(iso(weekStart))} haftasına eklenir.</p>
    ${list.length ? list.map((s) => `<div class="mini-row"><span><b>${esc(s.ad)}</b> <span class="muted small">· ${s.gorevler.length} görev</span></span><span class="row" style="gap:.3rem"><button class="btn btn-accent btn-sm" data-uy="${s.id}">Uygula</button><button class="btn btn-danger btn-sm" data-sbsil="${s.id}">Sil</button></span></div>`).join("")
      : `<div class="empty">Henüz şablonun yok. Bir öğrencinin haftasını "Şablon olarak kaydet" ile kaydedebilirsin.</div>`}`);
  $$("[data-uy]", m.el).forEach((b) => (b.onclick = async () => {
    const s = list.find((x) => x.id === b.dataset.uy); const batch = writeBatch(db);
    s.gorevler.forEach(({ gun, ...g }) => batch.set(doc(collection(db, "gorevler")), { ...g, tarih: iso(addDays(weekStart, gun)), ogrenciId: st.id, kocId: me.id, tamam: false, ogrenciNotu: "", createdAt: serverTimestamp() }));
    try { await batch.commit(); toast(`${s.gorevler.length} görev eklendi.`); m.close(); onDone?.(); } catch (e) { console.error(e); toast("Uygulanamadı.", "err"); }
  }));
  $$("[data-sbsil]", m.el).forEach((b) => (b.onclick = async () => { if (!confirm("Şablon silinsin mi?")) return; await deleteDoc(doc(db, "sablonlar", b.dataset.sbsil)).catch(() => {}); m.close(); sablonUygula(me, st, weekStart, onDone); }));
}

// =====================================================================
// HAFTALIK SORU HEDEFİ (koç belirler)
// =====================================================================
export async function getKocAyar(ogrId) { try { const s = await getDoc(doc(db, "kocAyar", ogrId)); return s.exists() ? s.data() : {}; } catch { return {}; } }
export function hedefModal(st, cur, onSaved) {
  const m = openModal(`<h3>Haftalık soru hedefi · ${esc(st.ad)}</h3><div class="field"><label>Haftalık hedef (soru)</label><input type="number" id="hh" min="0" max="5000" step="50" value="${cur || ""}" placeholder="Örn. 700"/></div><button class="btn btn-accent" id="hhS">Kaydet</button>`);
  $("#hhS", m.el).onclick = async () => {
    try { await setDoc(doc(db, "kocAyar", st.id), { haftalikSoruHedefi: Number($("#hh", m.el).value) || 0, updatedAt: serverTimestamp() }, { merge: true }); toast("Hedef kaydedildi."); m.close(); onSaved?.(); }
    catch (e) { console.error(e); toast("Kaydedilemedi.", "err"); }
  };
}
