# MMG Creativity — Bugün Yapılan Değişiklikler (2026-07-26)

Tüm değişiklikler, sitenin gerçek kaynak dosyalarına **doğrudan** işlendi
(`C:\Users\muham\OneDrive\0.mmgcreativitiy\web\html`). Ayrı bir yere kopya atılmadı.

## Değiştirilen / eklenen dosyalar ve ne yapıldı

1. **Vade_Sapma_Hesaplama.html**
   - Faturalar kutusu düzeni: "Çalışma Şekli" seçimi genişletildi; "Vade (Gün)" etiketi input üstüne alındı;
     seçenekler "Fatura +" ve "Ay sonu +" olarak sadeleştirildi; ne anlama geldiklerini açıklayan metin eklendi;
     ✕ sil butonu dikey hizalandı; alan genişlikleri optimize edildi.
   - "Sıfırla" butonu sonuç (Vade Sapması) kartının sağ üst köşesine taşındı.

2. **Sıfırla butonu sonuç kartına taşındı** (aşağıdaki hesaplayıcılarda):
   - vadeli-mevduat-faizi-hesaplama.html, Rotatif_Kredi_Hesaplama.html,
     Kredi_Karti_Vade_Farki_Hesaplama.html, Ortalama_Vade_Hesaplama.html, Vade_Sapma_Hesaplama.html.
   - NOT: kredi-karsilastirma.html'de Sıfırla butonu HENÜZ taşınmadı (küçük kalan iş).

3. **kredi-karsilastirma.html**
   - Karşılaştırma mantığı düzeltildi: artık yalnızca AYNI tutar VE aynı vadeye sahip teklifler
     birbiriyle kıyaslanıyor. Üstte "tutar + vade grubuna göre en uygun teklif" özeti eklendi
     (ör. "100.000 ₺ / 24 Ay → X"). Tablodaki yeşil "en iyi" vurgusu da grup bazlı yapıldı.

4. **İsim çözümlemesi düzeltmesi** (Forum.html, Blog.html, profil.html)
   - Kullanıcı adı artık şu sırayla çözülüyor: profiles/{uid} (displayName/name/username) →
     users/{uid} (displayName/username/email) → yedek. "İsimsiz"/yanlış isim sorununu azaltır.

5. **Forum.html — Gönderi kutusu yeniden tasarlandı (Twitter tarzı)**
   - Tek satır araç çubuğu; yuvarlak emoji ve görsel butonları; **GIF/görsel bağlantısı ile ekleme**
     (animasyonlu GIF'ler için); pill "Paylaş" butonu; odak parıltısı.

6. **index.html — Giriş (login) "self-kick" hatası düzeltildi** [EN KRİTİK]
   - Tek-oturum koruması, yeni giriş sunucuda onaylanmadan eski değeri görüp kullanıcıyı
     anında atıyordu ("hesabınıza başka bir yerden girildi"). Artık: yeni girişte kendi oturumu
     doğrulanana kadar kick yok; sayfa yenilemede tek-oturum korunuyor.

7. **Nakit_Akis_Tablosu.html — Veri kaybı koruması** [KRİTİK]
   - Sayfa açılırken bulut verisi yüklenmeden tetiklenen otomatik-kayıt, Firestore'daki gerçek veriyi
     boş halle ezip kalıcı kayba yol açabiliyordu. Artık o ayın bulut kaydı okunmadan buluta yazma yapılmıyor.

8. **firestore.rules — Güvenlik kilitleri**
   - `companies`: üye e-postaları yalnızca o firmanın üyelerine/sahibine; ayarlar yalnızca sahibe.
   - `invites` (eski e-posta daveti): tamamen kapatıldı (davetler artık kod tabanlı; e-posta sızıntısı + istismar giderildi).
   - `referrals`: katılanların e-posta/kullanıcı bilgileri yalnızca kişinin kendisi, kod sahibi ve yöneticiye görünür.

9. **functions/index.js — Firma güvenliği Cloud Functions (backbone)**
   - firmaSetSeats (kota/koltuk), firmaCreateMemberInvite, firmaCreateAdminInvite, firmaAcceptInvite,
     firmaRemoveMember. Admin yetkisi güvenilir kaynaktan (admins/createdBy) doğrulanıyor.
   - Bu, firma verisi güvenliğinin 1. fazı; istemci taşıma (faz 2) ve kural kilidi (faz 3) sırada.

10. **Yardımcı / dokümantasyon**
    - Blog.html & Forum.html: teşhis için konsol logları eklendi ([MMG_BLOG]/[MMG_FORUM]).
    - GUVENLIK-INCELEMESI.md: güvenlik risk raporu.
    - CLAUDE.md (proje kökünde): çalışma tercihin + proje notları (kalıcı hafıza).

11. **mmg-odemeler-sync.js (YENİ DOSYA) — Aktarım motoru** [KRİTİK]
    - Bu dosya projede HİÇ yoktu; bu yüzden girilen giderler Nakit Akış'a hiç aktarılmıyordu.
      Motor yazıldı ve Giderler.html + Nakit_Akis_Tablosu.html'e `<script>` ile bağlandı.
    - Vadesi gelen giderler Nakit Akış'a (bulut + yerel) otomatik işlenir; mükerrer eklenmez.
    - Tekrarlama: "Her ay/hafta/yıl" kayıtları her periyot için o gün otomatik düşer.

12. **Giderler.html — durum rozeti + motor bağlantısı**
    - "Aktarıldı/Bekliyor/Aktarılıyor" durumu tekrarlı kayıtlarda doğru hesaplanıyor.

13. **Nakit_Akis_Tablosu.html — "🔄 Yenile" butonu**
    - Gelir/Giderlerden vadesi gelen aktarımları elle çekmek için.

14. **index.html — Sol-alt "aktif firma" göstergesi**
    - Hangi firmada işlem yapıldığı her sayfada her zaman görünür; tıklayınca firma değiştirilir.

15. **Giderler.html & Gelirler.html — kutu düzeni**
    - "Yeni ekle" kutusu sola daraltıldı; Excel/PDF/Yükle/Şablon butonları kutunun sağına alt alta alındı.

## Deploy durumu

- **1. deploy yapıldı (canlıda):** login düzeltmesi, Nakit Akış veri kaybı koruması, companies + invites kuralları.
- **Sonradan eklenenler — YENİ DEPLOY BEKLİYOR:** aktarım motoru (mmg-odemeler-sync.js) + tekrarlama +
  durum rozeti + Nakit Akış "Yenile" + aktif firma göstergesi + Gider/Gelir kutu düzeni + kredi karşılaştırma +
  Forum kutusu + isim fallback'leri + referrals kuralı + firma Cloud Functions.
- **Hepsini canlıya almak için:**
  `firebase deploy --only hosting,functions,firestore:rules`
  (veya sadece sayfalar için `firebase deploy --only hosting`)

## Sıradaki işler

- Canlı test: Alex girişi kalıcı mı + Forum/Blog açılıyor mu; Nakit Akış verisi kalıcı mı.
- kredi-karsilastirma.html'de Sıfırla butonunu karta taşımak.
- "Uygulama tam Türkçe olmuyor": Türkçe olmayan ekranın tespiti (görsel bekleniyor).
- Firma güvenliği Faz 2 (istemci taşıma) + Faz 3 (kural kilidi), test ederek.
