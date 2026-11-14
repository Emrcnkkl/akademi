// Tüm herkese açık sayfalarda ortak: duyuru çubuğu, menü (açılır + mobil), footer, WhatsApp butonu, animasyonlar.
// Kullanım: <body data-page="koclar"> ... <div id="site-header"></div> ... <div id="site-footer"></div>
import { BRAND, SINAV } from "./config.js";
import { $, $$, fillBrand } from "./ui.js";

const page = document.body.dataset.page || "";

export const ARACLAR = [
  { href: "#/tyt-net", key: "tyt-net", ic: "🧮", ad: "TYT Net Hesaplama", ac: "Doğru-yanlıştan netini anında hesapla" },
  { href: "#/ayt-net", key: "ayt-net", ic: "📐", ad: "AYT Net Hesaplama", ac: "Sayısal, EA, sözel ve dil için" },
  { href: "#/yks-sayac", key: "yks-sayac", ic: "⏳", ad: "YKS Sayacı", ac: "Sınava kalan gün, hafta ve saat" },
  { href: "#/pomodoro", key: "pomodoro", ic: "🍅", ad: "Pomodoro Zamanlayıcı", ac: "25 dk odak, 5 dk mola" },
];

// Tek sayfa: index.html içinde sekmeler (#/koclar gibi). Başka bir sayfadaysak (kvkk) önce index'e git.
const IS_INDEX = !!document.getElementById("views");
const H = IS_INDEX ? "" : "index.html";
const isTool = ARACLAR.some((a) => a.key === page) || page === "araclar";
const on = (k) => (page === k ? "active" : "");

const header = `
<div class="topbar"><div class="container"><span class="dot"></span>
  <span><b id="tbDays">—</b> gün sonra YKS. Ön görüşme ücretsiz.</span><a href="${H}#kayit">Hemen başla →</a></div></div>
<nav class="nav" id="nav"><div class="container">
  <a href="${H}#/" class="logo"><img src="assets/logo-24-sm.png" alt="24 Akademi" width="80" height="72" /></a>
  <div class="nav-links" id="navLinks">
    <a href="${H}#/" data-v="home" class="${on("home")}">Ana sayfa</a>
    <a href="${H}#/koclar" data-v="koclar" class="${on("koclar")}">Koçlarımız</a>
    <div class="dd ${isTool ? "active" : ""}" id="ddTools">
      <button class="dd-btn" aria-expanded="false" aria-haspopup="true">YKS Araçları <span class="chev">▾</span></button>
      <div class="dd-menu" role="menu">
        ${ARACLAR.map((a) => `<a role="menuitem" href="${H}${a.href}" data-v="${a.key}" class="${on(a.key)}"><span class="dd-ic">${a.ic}</span><span><b>${a.ad}</b><small>${a.ac}</small></span></a>`).join("")}
        <a role="menuitem" href="${H}#/araclar" data-v="araclar" class="dd-all">Tüm araçlar →</a>
      </div>
    </div>
    <a href="${H}#/rehber" data-v="rehber" class="${on("rehber")}">Rehber</a>
    <a href="${H}#/hakkimizda" data-v="hakkimizda" class="${on("hakkimizda")}">Hakkımızda</a>
    <a href="${H}#/sss" data-v="sss" class="${on("sss")}">SSS</a>
    <a href="${H}#/iletisim" data-v="iletisim" class="${on("iletisim")}">İletişim</a>
    <a href="portal.html" class="btn btn-ghost btn-sm nav-login">Giriş</a>
    <a href="${H}#kayit" class="btn btn-accent btn-sm">Ön kayıt</a>
  </div>
  <button class="burger" id="burger" aria-label="Menüyü aç" aria-expanded="false"><span></span><span></span><span></span></button>
</div></nav>`;

const footer = `
<footer class="foot2"><div class="container">
  <div class="cols">
    <div>
      <a href="${H}#/" class="logo" style="margin-bottom:.8rem"><img src="assets/logo-24-sm.png" alt="24 Akademi" style="height:52px;width:auto" /></a>
      <p class="muted small" style="max-width:280px">Derece yapmış üniversite öğrencilerinden birebir YKS koçluğu. ${BRAND.slogan}.</p>
    </div>
    <div><h5>Platform</h5><a href="${H}#nasil">Nasıl çalışır</a><a href="${H}#panel">Panel</a><a href="${H}#fiyat">Fiyat</a><a href="${H}#/rehber">Rehber</a><a href="${H}#/sss">SSS</a></div>
    <div><h5>YKS Araçları</h5>${ARACLAR.map((a) => `<a href="${H}${a.href}">${a.ad}</a>`).join("")}</div>
    <div><h5>Kurumsal</h5><a href="${H}#/hakkimizda">Hakkımızda</a><a href="${H}#/koclar">Koçlarımız</a><a href="${H}#koc-ol">Koç ol</a><a href="${H}#/iletisim">İletişim</a><a href="portal.html">Panele giriş</a></div>
  </div>
  <div class="bottom"><span>© ${new Date().getFullYear()} ${BRAND.tamAd}</span>
    <span class="row" style="gap:1.2rem"><a data-insta href="#" style="color:inherit"></a><a href="kvkk.html" style="color:inherit">KVKK Aydınlatma Metni</a></span></div>
</div></footer>
<div class="mcta" id="mcta"><a href="${H}#kayit" class="btn btn-accent">Ücretsiz ön görüşme</a></div>
<a class="wa-float" data-wa href="#" target="_blank" rel="noopener" aria-label="WhatsApp">
  <svg viewBox="0 0 32 32"><path d="M16 3C9 3 3.3 8.6 3.3 15.6c0 2.2.6 4.4 1.7 6.3L3 29l7.3-1.9c1.8 1 3.8 1.5 5.8 1.5 7 0 12.7-5.6 12.7-12.6S23 3 16 3zm0 23.1c-1.9 0-3.7-.5-5.3-1.4l-.4-.2-4.3 1.1 1.2-4.2-.3-.4c-1-1.7-1.6-3.6-1.6-5.5C5.3 9.8 10.1 5.1 16 5.1s10.7 4.7 10.7 10.5S21.9 26.1 16 26.1zm5.9-7.8c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.6.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.1 1.4 3.4c.2.2 2.4 3.6 5.7 5 .8.3 1.4.5 1.9.7.8.3 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.7-.4z"/></svg>
</a>`;

$("#site-header")?.insertAdjacentHTML("afterend", header); $("#site-header")?.remove();
$("#site-footer")?.insertAdjacentHTML("afterend", footer); $("#site-footer")?.remove();
fillBrand();

// ---------- açılır menü ----------
const dd = $("#ddTools"), ddBtn = dd.querySelector(".dd-btn");
const setDD = (open) => { dd.classList.toggle("open", open); ddBtn.setAttribute("aria-expanded", open); };
ddBtn.addEventListener("click", (e) => { e.stopPropagation(); setDD(!dd.classList.contains("open")); });
document.addEventListener("click", (e) => { if (!dd.contains(e.target)) setDD(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { setDD(false); setMenu(false); } });

// ---------- mobil menü ----------
const burger = $("#burger"), links = $("#navLinks");
const setMenu = (open) => {
  if (open) links.style.top = Math.max(0, $("#nav").getBoundingClientRect().bottom) + "px";
  document.body.classList.toggle("menu-open", open); burger.setAttribute("aria-expanded", open);
};
burger.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
links.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });

// ---------- kaydırma: nav gölgesi + mobil CTA ----------
const nav = $("#nav"), mcta = $("#mcta");
const onScroll = () => {
  nav.classList.toggle("scrolled", scrollY > 10);
  const form = $("#kayit")?.getBoundingClientRect();
  const nearForm = form && form.top < innerHeight && form.bottom > 0;
  mcta.classList.toggle("show", scrollY > 500 && !nearForm && !document.body.dataset.noMcta);
};
addEventListener("scroll", onScroll, { passive: true }); onScroll();

// ---------- duyuru çubuğu sayacı ----------
const days = () => Math.max(0, Math.floor((new Date(SINAV.tarih).getTime() - Date.now()) / 86400000));
$("#tbDays").textContent = days();

// ---------- scroll animasyonu ----------
const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
export function observeReveal(root = document) {
  $$(".reveal:not(.in)", root).forEach((el, i) => {
    // ilk ekranda görünenler beklemeden gösterilir
    if (el.getBoundingClientRect().top < innerHeight) { el.style.transition = "none"; el.classList.add("in"); return; }
    el.style.transitionDelay = `${(i % 4) * 50}ms`; io.observe(el);
  });
}
observeReveal();

// Sekme değişince menüdeki aktif bağlantıyı güncelle (tek sayfa yönlendirici çağırır)
export function setActive(view) {
  const v = view.startsWith("rehber") ? "rehber" : view;
  $$("#navLinks [data-v]").forEach((a) => a.classList.toggle("active", a.dataset.v === v));
  $("#ddTools").classList.toggle("active", ARACLAR.some((a) => a.key === view) || view === "araclar");
  setDD(false); setMenu(false);
}
