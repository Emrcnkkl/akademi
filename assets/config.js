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
// ornek: true → kartta "Örnek profil" etiketi çıkar. Gerçek koçlar gelince bu satırları silin/değiştirin.
export const KOCLAR = [
  { ad: "Mert Tekin",    okul: "Boğaziçi Üni. – Ekonomi",            alan: "EA",  derece: "EA-398",    foto: "" },
  { ad: "Zeynep A.",     okul: "İTÜ – Bilgisayar Mühendisliği",       alan: "SAY", derece: "SAY-1.240", foto: "", ornek: true },
  { ad: "Elif K.",       okul: "Hacettepe Üni. – Tıp",                alan: "SAY", derece: "SAY-2.105", foto: "", ornek: true },
  { ad: "Burak Y.",      okul: "ODTÜ – Elektrik-Elektronik Müh.",     alan: "SAY", derece: "SAY-890",   foto: "", ornek: true },
  { ad: "Selin D.",      okul: "Galatasaray Üni. – Hukuk",            alan: "EA",  derece: "EA-612",    foto: "", ornek: true },
  { ad: "Can B.",        okul: "Koç Üni. – İşletme",                  alan: "EA",  derece: "EA-1.050",  foto: "", ornek: true },
  { ad: "Ahmet Ç.",      okul: "Ankara Üni. – Tarih",                 alan: "SOZ", derece: "SÖZ-154",   foto: "", ornek: true },
  { ad: "İrem S.",       okul: "Boğaziçi Üni. – Mütercim Tercümanlık", alan: "DIL", derece: "DİL-97",    foto: "", ornek: true },
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
