// =====================================================
//  TEK AYAR DOSYASI — marka ve Firebase bilgileri
//  İsim/iletişim değişince sadece burayı düzenleyin.
// =====================================================

export const BRAND = {
  ad: "24 Akademi",                   // kısa marka adı
  tamAd: "24 Akademi",                // tam ad
  slogan: "Online Eğitim Platformu",
  email: "info@ornek.com",            // TODO: gerçek e-posta
  whatsapp: "905000000000",           // TODO: ülke koduyla, + ve boşluk olmadan
  instagram: "https://instagram.com/yirmidortakademi",
  instagramKullanici: "@yirmidortakademi",
  baslangicFiyat: "2.900 TL",         // ana sayfada görünen başlangıç fiyatı
};

// Ana sayfadaki "Koçlarımız" bölümü. foto: "assets/koclar/mert.jpg" gibi (boşsa baş harfler görünür)
export const KOCLAR = [
  { ad: "Mert Tekin", okul: "Boğaziçi Üni. – Ekonomi", derece: "EA-398", foto: "" },
  // { ad: "Ad Soyad", okul: "İTÜ – Bilgisayar Müh.", derece: "SAY-1.250", foto: "" },
];

// Firebase Console → Proje ayarları → Web uygulaması → config
export const firebaseConfig = {
  apiKey: "BURAYA_API_KEY",
  authDomain: "PROJE-ID.firebaseapp.com",
  projectId: "PROJE-ID",
  storageBucket: "PROJE-ID.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxx",
};
