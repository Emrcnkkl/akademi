# 24 Akademi – Web Sitesi

Statik site (HTML + JS modülleri) · Firebase Authentication + Firestore · Vercel'de yayın.

## Yapı (Astro)
```
public/              → değişmeyen dosyalar (logo, favicon, og görseli, robots.txt)
src/config.js        → marka, iletişim, fiyat, YKS tarihi, koç listesi, araç listesi  ← çoğu değişiklik burada
src/layouts/         → Base.astro (herkese açık sayfalar), Panel.astro (portal/admin)
src/components/      → Header, Footer, CoachCards
src/pages/           → her dosya bir sayfa: index, koclar, araclar, tyt-net, ayt-net, yks-sayac,
                       pomodoro, hakkimizda, sss, iletisim, kvkk, portal, admin
src/scripts/         → main.js (tüm sayfaların etkileşimleri), site.js (formlar), portal.js, admin.js, fb*.js (Firebase)
src/styles/          → style.css, landing.css
```
- Sayfa geçişleri Astro **ClientRouter** ile yeniden yükleme olmadan yapılır; linkin üzerine gelince sayfa önceden indirilir.
- Firebase npm paketiyle kullanılır; herkese açık sayfalarda sadece form doldurulunca yüklenir.
- Yerelde çalıştırma: `npm install` → `npm run dev` (http://localhost:4321)
- Vercel ayarları `vercel.json` içinde (framework: astro, çıktı: dist).

## Kurulum (bir kerelik)

1. **Firebase projesi:** https://console.firebase.google.com → Yeni proje (ör. `24akademi`).
2. **Web uygulaması ekle** → çıkan `firebaseConfig` değerlerini `src/config.js` içine yapıştır.
3. **Authentication** → Sign-in method → **Email/Password**'ü aç.
   Authentication → Settings → **Authorized domains**'e Vercel adresini (ve sonra kendi domainini) ekle.
4. **Firestore Database** → Create database (bölge: `eur3` önerilir) → **Rules** sekmesine `firestore.rules` içeriğini yapıştır → Publish.
5. **İlk admin hesabı** (elle, bir kez):
   - Authentication → Users → *Add user* (e-posta + şifre) → oluşan **UID**'yi kopyala.
   - Firestore → `roles` koleksiyonu → belge ID = UID → alan `role` (string) = `admin`
   - Firestore → `users` koleksiyonu → belge ID = UID → alanlar: `ad` (string), `email` (string), `rol` = `admin`, `aktif` = `true` (boolean)
6. `portal.html`'den bu hesapla giriş yap → otomatik olarak admin paneline yönlenirsin. Bundan sonraki tüm hesaplar admin panelinden açılır.

## GitHub + Vercel
1. Repo GitHub'a gönderilince Vercel otomatik derler (`vercel.json` → Astro).
3. Domain alınca Vercel → Settings → Domains'ten bağla ve Firebase *Authorized domains*'e ekle.

## Veri yapısı (Firestore)
- `roles/{uid}` → `{ role: "ogrenci" | "koc" | "admin" }` (yetkinin tek kaynağı; sadece admin yazar)
- `users/{uid}` → ad, email, telefon, rol, aktif + rol alanları
  - öğrenci: sinif, alan, hedef, veliTelefon, **kocId** (sadece öğrencilerin koçu olur)
  - koç: universite, bolum, alan, siralama, kapasite, foto
- `gorevler` → ogrenciId, kocId, tarih (YYYY-MM-DD), ders, konu, tur, hedef, aciklama, tamam, ogrenciNotu
- `denemeler` → ogrenciId, kocId, tarih, tur (TYT/AYT), alan, yayin, netler{ders:{d,y,net}}, toplam
- `gorusmeler` → ogrenciId, kocId, tarih, sure, notlar, hedefler
- `ogrenciBasvurulari`, `mentorBasvurulari` → ana sayfa formları (herkes yazar, sadece admin okur)

## Notlar
- Admin yeni hesap açınca kullanıcıya otomatik **şifre belirleme e-postası** gider; geçici şifre de bir kez gösterilir.
- Kullanıcı silmek yerine **pasif** yapılır (giriş engellenir). Auth'tan tamamen silmek için Firebase Console kullanılır.
- Öğrenci başka koça aktarılırsa eski görev ve denemeler yeni koçta görünmez (yeni kayıtlar görünür).
- Spam'e karşı ileride Firebase **App Check** (reCAPTCHA) eklenmesi önerilir.
