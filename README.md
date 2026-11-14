# 24 Akademi – Web Sitesi

Statik site (HTML + JS modülleri) · Firebase Authentication + Firestore · Vercel'de yayın.

## Yapı (tek sayfa – sekmeler yeniden yükleme olmadan değişir)
| Dosya | İçerik |
|---|---|
| `index.html` | Herkese açık sitenin tamamı. Her sekme bir `<section class="view" data-view="...">`: ana sayfa, koclar, araclar, tyt-net, ayt-net, yks-sayac, pomodoro, hakkimizda, sss, iletisim. Adresler `#/koclar` gibi; `#kayit`, `#fiyat` gibi bölüm bağlantıları ilgili sekmeyi açıp kaydırır. |
| `assets/app.js` | Sekme yönlendiricisi + her sekmenin kodu (`INIT` nesnesi) |
| `assets/layout.js` | Ortak üst menü (açılır YKS Araçları), mobil menü, footer |
| `assets/site.js` | Koç kartları, ön kayıt ve koç başvuru formları (Firebase sadece formda yüklenir) |
| `portal.html` + `assets/portal.js` | Öğrenci ve koç panelleri |
| `admin.html` + `assets/admin.js` | Yönetim paneli |
| `kvkk.html` | KVKK aydınlatma metni **şablonu** (yayından önce hukukçuya kontrol ettirin) |

Marka, iletişim, fiyat, YKS tarihi ve koç kartları: **`assets/config.js`**

## Kurulum (bir kerelik)

1. **Firebase projesi:** https://console.firebase.google.com → Yeni proje (ör. `24akademi`).
2. **Web uygulaması ekle** → çıkan `firebaseConfig` değerlerini `assets/config.js` içine yapıştır.
3. **Authentication** → Sign-in method → **Email/Password**'ü aç.
   Authentication → Settings → **Authorized domains**'e Vercel adresini (ve sonra kendi domainini) ekle.
4. **Firestore Database** → Create database (bölge: `eur3` önerilir) → **Rules** sekmesine `firestore.rules` içeriğini yapıştır → Publish.
5. **İlk admin hesabı** (elle, bir kez):
   - Authentication → Users → *Add user* (e-posta + şifre) → oluşan **UID**'yi kopyala.
   - Firestore → `roles` koleksiyonu → belge ID = UID → alan `role` (string) = `admin`
   - Firestore → `users` koleksiyonu → belge ID = UID → alanlar: `ad` (string), `email` (string), `rol` = `admin`, `aktif` = `true` (boolean)
6. `portal.html`'den bu hesapla giriş yap → otomatik olarak admin paneline yönlenirsin. Bundan sonraki tüm hesaplar admin panelinden açılır.

## GitHub + Vercel
1. Bu klasördeki her şeyi `akademi` reposunun köküne yükle (`index.html` kökte olmalı).
2. Vercel → *Add New Project* → `akademi` reposunu seç → Framework: **Other** → Deploy. Build ayarı gerekmez.
3. Domain alınca Vercel → Settings → Domains'ten bağla ve Firebase *Authorized domains*'e ekle.

## Veri yapısı (Firestore)
- `roles/{uid}` → `{ role: "ogrenci" | "koc" | "admin" }` (yetkinin tek kaynağı; sadece admin yazar)
- `users/{uid}` → ad, email, telefon, rol, aktif + rol alanları
  - öğrenci: sinif, alan, hedef, veliTelefon, **kocId** (sadece öğrencilerin koçu olur)
  - koç: universite, bolum, alan, siralama, kapasite, foto
- `gorevler` → ogrenciId, kocId, tarih (YYYY-MM-DD), ders, konu, tur, hedef, aciklama, tamam, ogrenciNotu
- `denemeler` → ogrenciId, kocId, tarih, tur (TYT/AYT), alan, yayin, netler{ders:{d,y,net}}, toplam
- `gorusmeler` → ogrenciId, kocId, tarih, sure, notlar, hedefler
- `takip/{ogrenciId}` → konular (konu durumları), hedef {bolum, tyt, ayt}
- `soruKayit/{ogrenciId}_{tarih}` → günlük soru sayıları
- `mesajlar` → koç–öğrenci mesajları (ogrenciId, kocId, from, text, okundu)
- `odemeler` → dönem/ödeme kayıtları (admin yönetir)
- `veliRaporlari` → koçun hazırladığı haftalık veli raporları
- `ogrenciBasvurulari`, `mentorBasvurulari` → ana sayfa formları (herkes yazar, sadece admin okur)

## Notlar
- Admin yeni hesap açınca kullanıcıya otomatik **şifre belirleme e-postası** gider; geçici şifre de bir kez gösterilir.
- Kullanıcı silmek yerine **pasif** yapılır (giriş engellenir). Auth'tan tamamen silmek için Firebase Console kullanılır.
- Öğrenci başka koça aktarılırsa eski görev ve denemeler yeni koçta görünmez (yeni kayıtlar görünür).
- Spam'e karşı ileride Firebase **App Check** (reCAPTCHA) eklenmesi önerilir.
