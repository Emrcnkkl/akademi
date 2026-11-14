// YKS konu listeleri (konu takibi için). İstediğiniz zaman ekleme/çıkarma yapabilirsiniz;
// öğrencinin işaretleri konu adına göre saklanır, sıralama değişse de kaybolmaz.
export const KONULAR = {
  TYT: {
    "Türkçe": ["Sözcükte Anlam", "Cümlede Anlam", "Paragraf", "Ses Bilgisi", "Yazım Kuralları", "Noktalama İşaretleri", "Sözcük Türleri", "Fiiller ve Fiilimsiler", "Cümlenin Ögeleri", "Cümle Türleri", "Anlatım Bozuklukları"],
    "Matematik": ["Temel Kavramlar", "Sayı Basamakları", "Bölme ve Bölünebilme", "EBOB – EKOK", "Rasyonel Sayılar", "Basit Eşitsizlikler", "Mutlak Değer", "Üslü Sayılar", "Köklü Sayılar", "Çarpanlara Ayırma", "Oran – Orantı", "Denklem Çözme", "Sayı ve Kesir Problemleri", "Yaş Problemleri", "Yüzde, Kâr – Zarar", "Karışım Problemleri", "Hareket Problemleri", "İşçi Problemleri", "Kümeler", "Fonksiyonlar", "Permütasyon – Kombinasyon", "Olasılık", "Veri – İstatistik", "Polinomlar"],
    "Geometri": ["Doğruda ve Üçgende Açılar", "Özel Üçgenler", "Üçgende Alan", "Benzerlik", "Çokgenler", "Dörtgenler", "Çember ve Daire", "Katı Cisimler", "Analitik Geometri"],
    "Fizik": ["Fizik Bilimine Giriş", "Madde ve Özellikleri", "Hareket ve Kuvvet", "İş, Güç, Enerji", "Isı ve Sıcaklık", "Elektrostatik", "Elektrik Akımı", "Manyetizma", "Basınç ve Kaldırma", "Dalgalar", "Optik"],
    "Kimya": ["Kimya Bilimi", "Atom ve Periyodik Sistem", "Kimyasal Türler Arası Etkileşimler", "Maddenin Halleri", "Kimyanın Temel Kanunları", "Mol Kavramı", "Kimyasal Tepkimeler", "Karışımlar", "Asitler, Bazlar, Tuzlar", "Kimya Her Yerde"],
    "Biyoloji": ["Canlıların Ortak Özellikleri", "Temel Bileşenler", "Hücre", "Canlıların Sınıflandırılması", "Hücre Bölünmeleri", "Kalıtım", "Ekosistem Ekolojisi"],
    "Tarih": ["Tarih Bilimi", "İlk Uygarlıklar", "İlk Türk Devletleri", "İslam Tarihi", "Türk – İslam Devletleri", "Osmanlı Kuruluş ve Yükselme", "Osmanlı Duraklama ve Gerileme", "Osmanlı Dağılma", "Kurtuluş Savaşı", "Atatürk İlke ve İnkılapları"],
    "Coğrafya": ["Doğa ve İnsan", "Dünya'nın Şekli ve Hareketleri", "Harita Bilgisi", "İklim Bilgisi", "Yer Şekilleri", "Nüfus ve Yerleşme", "Ekonomik Faaliyetler", "Bölgeler", "Doğal Afetler"],
    "Felsefe": ["Felsefeye Giriş", "Bilgi Felsefesi", "Varlık Felsefesi", "Ahlak Felsefesi", "Sanat Felsefesi", "Din Felsefesi", "Siyaset Felsefesi", "Bilim Felsefesi"],
    "Din Kültürü": ["Bilgi ve İnanç", "İbadet", "Ahlak ve Değerler", "Hz. Muhammed", "Din ve Hayat"],
  },
  AYT: {
    "Matematik": ["Fonksiyonlar", "Polinomlar", "2. Dereceden Denklemler", "Karmaşık Sayılar", "Eşitsizlikler", "Parabol", "Trigonometri", "Logaritma", "Diziler", "Limit ve Süreklilik", "Türev", "İntegral"],
    "Geometri": ["Çember ve Daire", "Analitik Geometri", "Dönüşümler", "Katı Cisimler", "Çemberin Analitiği"],
    "Fizik": ["Vektörler", "Kuvvet, Tork, Denge", "Kütle Merkezi", "Basit Makineler", "Newton'un Hareket Yasaları", "Atışlar", "İş, Güç, Enerji", "İtme ve Momentum", "Elektrik Alan ve Potansiyel", "Kondansatörler", "Manyetizma ve İndüksiyon", "Alternatif Akım", "Çembersel Hareket", "Basit Harmonik Hareket", "Dalga Mekaniği", "Atom Fiziği", "Modern Fizik"],
    "Kimya": ["Modern Atom Teorisi", "Gazlar", "Sıvı Çözeltiler", "Tepkimelerde Enerji", "Tepkime Hızı", "Kimyasal Denge", "Asit – Baz Dengesi", "Çözünürlük Dengesi", "Elektrokimya", "Organik Kimya"],
    "Biyoloji": ["Sinir Sistemi", "Endokrin Sistem", "Duyu Organları", "Destek ve Hareket", "Sindirim", "Dolaşım", "Solunum", "Boşaltım", "Üreme", "Komünite ve Popülasyon", "Genden Proteine", "Canlılarda Enerji Dönüşümleri", "Bitki Biyolojisi"],
    "Edebiyat": ["Şiir Bilgisi", "Edebi Sanatlar", "İslamiyet Öncesi Edebiyat", "Halk Edebiyatı", "Divan Edebiyatı", "Tanzimat", "Servet-i Fünun ve Fecr-i Ati", "Milli Edebiyat", "Cumhuriyet Dönemi", "Roman ve Hikâye", "Tiyatro", "Edebi Akımlar"],
    "Tarih": ["Osmanlı Kültür ve Medeniyeti", "XX. Yüzyıl Başlarında Osmanlı", "I. Dünya Savaşı", "Milli Mücadele", "Atatürkçülük", "İki Savaş Arası Dönem", "II. Dünya Savaşı", "Soğuk Savaş", "Yumuşama ve Küreselleşme"],
    "Coğrafya": ["Ekosistemler", "Nüfus Politikaları", "Türkiye Ekonomisi", "Küresel Ortam", "Çevre ve Toplum"],
    "Felsefe Grubu": ["Mantık", "Psikoloji", "Sosyoloji"],
    "Din Kültürü": ["Dünya ve Ahiret", "Kur'an'da Bazı Kavramlar", "İslam Düşüncesinde Yorumlar", "Hint ve Çin Dinleri"],
    "Yabancı Dil": ["Kelime Bilgisi", "Dilbilgisi", "Cloze Test", "Cümle Tamamlama", "Çeviri", "Okuma Parçası", "Diyalog Tamamlama", "Paragraf Tamamlama", "Anlam Bütünlüğü"],
  },
};

// Alana göre AYT dersleri
export const AYT_ALAN = {
  SAY: ["Matematik", "Geometri", "Fizik", "Kimya", "Biyoloji"],
  EA: ["Matematik", "Geometri", "Edebiyat", "Tarih", "Coğrafya"],
  SOZ: ["Edebiyat", "Tarih", "Coğrafya", "Felsefe Grubu", "Din Kültürü"],
  DIL: ["Yabancı Dil"],
};

export const SORU_DERSLERI = ["Türkçe", "Matematik", "Geometri", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "Felsefe", "Din", "Edebiyat", "Yabancı Dil"];

export const konuKey = (sinav, ders, konu) =>
  `${sinav}_${ders}_${konu}`.toLocaleLowerCase("tr").replace(/[^a-z0-9ğüşıöç]+/g, "-").replace(/^-|-$/g, "");
