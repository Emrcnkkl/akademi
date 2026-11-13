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

// Geri sayım: ÖSYM 2027 takvimi – TYT 19 Haziran 2027, 10:15
export const SINAV = { ad: "YKS 2027", tarih: "2027-06-19T10:15:00+03:00" };

// Ana sayfadaki "Koçlarımız" bölümü. foto: "assets/koclar/mert.jpg" gibi (boşsa baş harfler görünür)
export const KOCLAR = [
  { ad: "Mert Tekin", okul: "Boğaziçi Üni. – Ekonomi", alan: "EA", derece: "EA-398", foto: "" },
  // { ad: "Ad Soyad", okul: "İTÜ – Bilgisayar Müh.", alan: "SAY", derece: "SAY-1.250", foto: "" },
];

// Firebase Console → Proje ayarları → Web uygulaması → config
export const firebaseConfig = {
  apiKey: "AIzaSyA8WunLwtkMr9St14j7iRRTb1td8Gil7Ks",
  authDomain: "akademi-8d8cb.firebaseapp.com",
  projectId: "akademi-8d8cb",
  storageBucket: "akademi-8d8cb.firebasestorage.app",
  messagingSenderId: "1062206754627",
  appId: "1:1062206754627:web:1b899b2c003679263de9f6",
  measurementId: "G-D812QCG7YX",
};
