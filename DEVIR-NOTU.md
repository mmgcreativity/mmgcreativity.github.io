# DEVİR NOTU — MMG Creativity web uygulaması (27 Temmuz 2026)

Bu dosya, başka bir bilgisayarda **yeni bir Cowork sohbetinden** devam edebilmek için yazıldı.
Bu klasör OneDrive'da; iki bilgisayar arasında ortak hafıza = BU DOSYA. Sohbet geçmişi
senkronize OLMAZ, o yüzden her devir bu dosyaya yazılır.

## OTURUM PROTOKOLÜ (her bilgisayarda)
**BAŞLARKEN:**
1. OneDrive `html` klasörü senkronlu olsun (klasör → "Bu cihazda her zaman tut" / hidrate).
2. Yeni Cowork sohbeti aç → bu klasörü bağla → şunu yaz:
   "DEVIR-NOTU.md'yi oku ve kaldığımız yerden devam et."
**BİTİRİRKEN (önemli — hafıza bu):**
3. Claude'a "devir notunu güncelle" de: tamamlananları ✅ işaretle, yeni bekleyen işleri ekle,
   deploy durumunu ve app-version'ı yaz. OneDrive senkronu bitene kadar bekle, sonra kapat.

## ⭐⭐ ÖNCELİKLİ / KALICI ÇÖZÜM: DOMAIN → FIREBASE (reklamlar + güncellemeler görünmüyor sorunu) (28 Tem 2026)
**SORUNUN KÖKÜ (kesin, teşhis edildi):** `firebase deploy` ile güncellediğimiz gerçek site
`https://mmgcreativity-31263.web.app` adresinde CANLI (sürüm 2026-07-28-3) — ama **kullanıcıların
girdiği `mmgcreativity.com` bambaşka, ESKİ bir kopyayı gösteriyor** (sürüm 2026-07-26-1).
Yani domain Firebase'e bağlı DEĞİL. Bu yüzden ne AdSense reklamları ne de son değişiklikler
gerçek domainde / Android (TWA) uygulamasında görünüyor. "Reklam yok" ve "güncelleme görünmüyor"
şikâyetlerinin TEK gerçek sebebi budur. (Not: TWA host'u = mmgcreativity.com; app da bu eski kopyayı yüklüyor.)

**KESİN TEKNİK DURUM (WHOIS + DNS ile doğrulandı):**
- Registrar: **Name.com** (domain 17 Tem 2026'da alınmış; büyük olasılıkla **Netlify üzerinden**,
  Netlify domainleri Name.com'a kaydeder). WHOIS gizli (Domain Protection Services).
- Nameserver'lar: `dns1–4.p07.nsone.net` = **NS1 = Netlify DNS**. Yani DNS zonu Netlify'da.
- `mmgcreativity.com` şu an **GitHub Pages**'ten yayınlanıyor (A kaydı `185.199.108.153` = GitHub Pages).
  Yani eski/donmuş site GitHub Pages'te duruyor.
- KULLANICI ERİŞİMİ: Firebase Console ✅ , GitHub ✅ , **Netlify ❌ (kilitli — DNS burada)** ,
  Name.com ❌ (Netlify reseller'ında). Netlify erişim sorunu için açık destek talebi **#1073233**.

### YOL A — KALICI/DOĞRU ÇÖZÜM (kullanıcı bunu istiyor; DNS erişimi gelince yap)
mmgcreativity.com'u Firebase Hosting'e bağla. Böylece her `firebase deploy` doğrudan gerçek domaine
yansır; site + AdSense hem web'de hem uygulamada görünür. Adımlar:
1. Firebase Console → Hosting → **Add custom domain** → `mmgcreativity.com` (ZATEN EKLENDİ, 28 Tem;
   "Needs setup" durumunda bekliyor. Redirect kutusu İŞARETLENMEDİ = doğru).
2. Firebase'in verdiği DNS değişikliklerini **Netlify DNS panelinde** uygula:
   **EKLE:**
   - `A`   @ (mmgcreativity.com) → `199.36.158.100`
   - `TXT` @ (mmgcreativity.com) → `hosting-site=mmgcreativity-31263`
   **SİL (eski GitHub Pages A kayıtları):**
   - `A` → `185.199.108.153`  (ve varsa `185.199.109.153` / `.110.153` / `.111.153`)
3. Firebase custom domain ekranında "Verify / Bağlan" tamamlanınca SSL sertifikası çıkar (birkaç saat).
4. Doğrula: `https://mmgcreativity.com/app-version.json` artık `web.app` ile AYNI sürümü göstermeli.
   Reklamlar için AdSense zaten hazır (aşağı bak), domain düzelince görünmeye başlar.
- **TEK ENGEL:** DNS kayıtları Netlify NS1'de; kullanıcı Netlify hesabına erişemiyor (talep #1073233).
  Bu erişim gelince Yol A birkaç dakikalık iştir. Alternatif: registrar Name.com'a ulaşılıp nameserver'lar
  kullanıcının kontrolündeki bir DNS'e çevrilebilir (ama o da Netlify reseller'ı yüzünden zor).

### YOL B — HIZLI GEÇİCİ ÇÖZÜM (DNS'e dokunmadan; kullanıcı ŞİMDİLİK ERTELEDİ)
Site zaten GitHub Pages'te olduğu için, güncel `web/html` içeriğini o **GitHub Pages deposuna** yükle
(CNAME + .nojekyll'i koru) → mmgcreativity.com hemen güncellenir, reklamlar görünür. Kullanıcı GitHub'a
erişebiliyor. Kalıcı çözüm (Yol A) yerine geçmez ama bugün reklamları canlıya alır. (Kullanıcı "önce DNS'i
çözüp Yol A'yı yapalım" dedi; Yol B'yi tercih ederlerse GitHub deposunu tespit edip oraya yükle.)

### AdMob — BU UYGULAMA İÇİN GEREKSİZ (bir daha uğraşma)
Uygulama bir **TWA** (mmgcreativity.com'un Android sarmalayıcısı). TWA'ya AdMob mobil SDK reklamı
KOYULAMAZ (desteklenmiyor). AdMob'da açılan uygulama (`ca-app-pub-7339763610555735~1278388228`) ve
banner birimi (`.../8441608085`) bu app'te asla reklam göstermez — geliri **AdSense (web)** sağlar.
AdMob "hesap onaylanmadı" uyarısı bu senaryoda ÖNEMSİZ, yok sayılabilir.

### AdSense DURUMU (kod tarafı HAZIR)
- Hesap **ONAYLI**; `mmgcreativity.com` için **Otomatik reklamlar AÇIK** (AdSense panelinde doğrulandı).
- Kodda: `index.html` sat.31 loader `ca-pub-7339763610555735` yüklü; `ads.txt` doğru; gizlilik politikası uygun.
- Manuel `<ins>` reklam bloğu YOK → reklamlar Otomatik Reklamlar'a bağlı. App tipi düzende otomatik
  yerleşim az/hiç olabilir; istenirse belirli yerlere manuel reklam birimi (AdSense'ten slot ID alıp) eklenebilir.
- ‼️ AMA hepsinden önce YOL A/B ile domainin GÜNCEL sürümü yayınlaması şart; yoksa reklam kodu canlıya ulaşmıyor.

## Proje
- Firebase web uygulaması. Proje ID: **mmgcreativity-31263**. Hosting: https://mmgcreativity-31263.web.app
- Kaynak klasör (deploy buradan yapılıyor): makineye göre değişir — bu bilgisayarda
  `C:\Users\muham\OneDrive\0.mmgcreativity\web\html` (diğer makinede `C:\Users\CihanFinans\OneDrive\...`)
- Deploy komutları (bu klasörden):
  - `firebase deploy --only hosting`
  - `firebase deploy --only firestore:rules`
  - `firebase deploy --only functions`   (Blaze planı gerekir)
- Sürüm bilgisi `app-version.json` içinde; her deploy'da bir artır (kullanıcılara "güncelle" çıkar).
- Sözdizimi doğrulama: `node --check functions/index.js` ; HTML script blokları için scriptle node --check.
- NOT: firebase.json hosting `ignore`'una `.bat/.ps1/.exe/.md` eklendi (Spark planında exe yasağı hatası çözüldü).

## BUGÜN TAMAMLANAN İŞLER (hepsi kodda; bazıları HENÜZ DEPLOY EDİLMEDİ — aşağıya bak)
1. index.html — mobil `main{margin-left}` sıfırlama (280px sağa kayma düzeldi).
2. Vade_Sapma_Hesaplama.html — Çalışma Şekli select genişletildi, ✕ dikey ortalandı.
3. kredi-karsilastirma.html — banka adı zaten "→" sonrası gösteriliyor (doğrulandı).
4. Nakit_Akis_Tablosu.html — **VERİ KAYBI bug'ı düzeltildi**: erken `monthCloudLoaded=true` hole'u
   kapatıldı + yerel/bulut tazelik kıyası (zaman damgası) eklendi.
5. Nakit_Akis_Tablosu.html — **KONSOLİDE GÖSTER**: sağ üst tetik konsolide moda geçiyor; ana tablo
   seçili firmaların Gelir/Gider/Net + firma kırılımını dönem/tarih-aralığına göre gösteriyor.
6. index.html — sol-alt kapsam göstergesi: firma yoksa "👤 Kendi Hesabım" gösteriyor.
7. Forum.html — "İsimsiz" gönderilerin adı görüntüde profiles→users'tan çekilip yamanıyor.
8. Anasayfa kısayol düzenleme (index.html): kalem→✕ garanti; +/− büyüteç en+boy ORANTILI ölçek
   (`--dfa-card-h`); hepsi silinince "Varsayılan Kısayolları Geri Yükle" boş-durum kutusu.
9. usageStats "Kullanım verisi okunamadı": firestore.rules'a `match /{path=**}/openers/{uid}`
   recursive collectionGroup okuma kuralı eklendi (admin). NOT: hesabın isAdmin=true olmalı.
10. **Bildirim sistemi (çan/badge)** — YENİ `notifications` koleksiyonu:
    - firestore.rules: `match /notifications/{notifId}` (create: fromUid==auth.uid; read/update/delete:
      toUid==auth.uid veya admin).
    - mmg-chat-widget.js: notifications onSnapshot dinleyici + badge + "Bildirimler" sekmesinde render
      (okundu işaretle/sil) + global `window.mmgNotify(toUid, {type,title,body})` yardımcısı + stopAll temizliği.
    - #3 Davet bildirimi: KullaniciYonetimi.html — üye/yönetici daveti gönderilince davet edilene
      "🏢 Firma daveti / {Firma} sizi ekledi" bildirimi (invitee uid: userDirectory→chatCodes fallback).
    - #4 Hatırlatma: KullaniciYonetimi.html "Bekleyen Davetler"de her satıra "🔔 Hatırlat" (günde 1,
      invite dokümanında lastRemindedAt ile sınırlı).
    - #17 Referans: index.html kayıt akışında referans koduyla kayıt olununca kod sahibine
      "🎁 Referansınız kullanıldı — referans kodunuz ile kayıt yapılmıştır" bildirimi.
    - AdSense (#9): ads.txt + gizlilik-politikasi.html + iletisim.html + hakkinda.html + kullanim-sartlari.html
      oluşturuldu (footer linkleri artık kırık değil). AdSense onayı "tamamlandı" göründü.

## DEPLOY DURUMU
- ✅ TAMAMLANDI (27 Tem 2026, sürüm 2026-07-27-3): firestore:rules + hosting deploy edildi.
  Bildirim sistemi (çan/badge), usageStats kuralı, kısayol düzeltmeleri, referans/davet
  bildirimleri artık CANLIDA. Bugünkü hosting işleri tamamen deploy edildi.
- Not: functions henüz deploy EDİLMEDİ (Blaze + Resend secret bekliyor — bkz. #10).
- ✅ TAMAMLANDI (28 Tem 2026, sürüm 2026-07-28-1): `service-worker.js` oluşturuldu + hosting deploy
  edildi (57 dosya, "Deploy complete"). Eski "dosya yok / sessizce başarısız" bug'ı çözüldü; PWA
  "Ana Ekrana Ekle" artık çalışıyor. Minimal SW (agresif cache YOK, network-passthrough).

## BEKLEYEN İŞLER
### #10 Şifre sıfırlama (kendi domainden, spam'e düşmeden) — KOD HAZIR, kurulum bekliyor
- functions/index.js'e `sendPasswordResetMail` eklendi: Admin SDK `generatePasswordResetLink` +
  **Resend** ile markalı Türkçe mail. Secret: `RESEND_API_KEY`. Gönderen: `noreply@mmgcreativity.com`
  (RESET_FROM sabiti). İzin/güvenlik: kullanıcı yoksa da "gönderildi" döner.
- index.html: "Şifremi unuttum?" artık `httpsCallable(functions,'sendPasswordResetMail')` çağırıyor;
  fonksiyon yoksa Firebase'e fallback. getFunctions/httpsCallable import edildi, `functions` init (us-central1).
- YAPILACAKLAR (kullanıcı tarafı):
  1. Resend hesabı açıldı, domain `mmgcreativity.com` eklendi. DNS kayıtları (eu-west-1):
     - TXT `resend._domainkey` = p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDFQiQfTPs0Ym3ZeFoViaRb3uf4YYlv/uPYIYuniILm53MAc7AevoLobL0LUgUcepSDz+oolWETmrrnqh11quA7BcX8jBgUGxzKL8J5cSIksW8vzjaRxXFzSg++py5iRg35N5idEjcDHFMgKTIFaYYtnzJ5RfYMl7AtTq+P8Ccx9QIDAQAB
     - MX `send` = feedback-smtp.eu-west-1.amazonses.com (priority 10)
     - TXT `send` = v=spf1 include:amazonses.com ~all
     - TXT `_dmarc` = v=DMARC1; p=none;
  2. **DNS ENGELİ:** mmgcreativity.com'un DNS'i Netlify NS1 (nsone.net) üzerinde, ama erişilebilen
     iki hesapta da (mmgcreativity@gmail.com, muhammed.mutlu.guler@gmail.com) çıkmıyor. Domain,
     "zippy-hotteok-cd806e" projesiyle başka bir Netlify takımında. Registrar: Name.com.
     → Açık Netlify destek talebi **#1073233**'e cevap yazıp yukarıdaki 4 kaydı eklemelerini/hesabı
       vermelerini istedik. Netlify DNS'i çözünce Resend'de domain "Verified" olur.
  3. Firebase'i **Blaze** planına yükselt (functions ve secret bunu gerektiriyor).
  4. Sonra:
     ```
     firebase functions:secrets:set RESEND_API_KEY   (Resend API anahtarını yapıştır)
     firebase deploy --only functions
     firebase deploy --only hosting
     ```
- Alternatif: mmgcreativity.com DNS'ine hiç ulaşılamazsa RESET_FROM'u erişilebilen bir domaine çevir
  (cihanbeton.com.tr kullanıcı istemedi).

### #16 Mobil push (uygulama kapalıyken) — KOD HAZIR, kurulum/deploy bekliyor (28 Tem 2026)
- ✅ `firebase-messaging-service-worker.js` OLUŞTURULDU (arka plan onBackgroundMessage → data-only
  bildirim gösterir; notificationclick → uygulamayı öne getirir/açar). PWA `service-worker.js`'den ayrı.
- ✅ index.html: `firebase-messaging.js` import edildi; `MMG_VAPID_KEY` sabiti (ŞU AN BOŞ),
  `mmgInitMessaging()`, `mmgRegisterPushToken(user)` (onAuthStateChanged içinde çağrılıyor) ve
  butondan çağrılabilir `window.mmgEnablePush()` eklendi. Token → `users/{uid}/fcmTokens/{token}`.
  TASARIM: VAPID boşken + izin yokken TAMAMEN no-op; mevcut çan/badge/tarayıcı bildirimi etkilenmez.
- ✅ functions/index.js: `pushOnNotification` = `onDocumentCreated('notifications/{notifId}')` →
  alıcının token'larına `sendEachForMulticast` (data-only) + geçersiz token temizliği. (firebase-functions
  ^6.1.0 + firebase-admin ^12.6.0 zaten uyumlu, paket değişmedi.)
- ✅ firestore.rules: DEĞİŞİKLİK GEREKMEDİ — `users/{userId}/{document=**}` kuralı fcmTokens'ı zaten
  kapsıyor (sahibi yazar/okur; fonksiyon Admin SDK ile okur).
- YAPILACAKLAR (kullanıcı tarafı — hepsi #10 ile aynı Blaze engelini paylaşır):
  1. Firebase Console → Proje Ayarları → Cloud Messaging → "Web Push certificates" → anahtar çifti
     oluştur; public key'i index.html'deki `MMG_VAPID_KEY = ""` içine yapıştır.
  2. Firebase'i **Blaze**'e yükselt (functions için).
  3. `firebase deploy --only functions` + `firebase deploy --only hosting`.
  4. app-version.json'ı bir artır (kullanıcılara "güncelle" çıksın).
  5. Bir cihazda giriş yapıp bir butona `mmgEnablePush()` bağla (ya da konsoldan çağır) → izin ver →
     kendine bir test bildirimi (`mmgNotify`) göndert → uygulamayı kapat → push gelmeli.
- NOT: Deploy edilmeden ÖNCE bu oturumda shell çalışmadığı için `node --check` yapılamadı; kod elle
  gözden geçirildi. Deploy öncesi bir kez `node --check functions/index.js` çalıştırman iyi olur.

## KULLANICI TERCİHİ (Global instructions'a da eklendi)
"Elimde iş varsa sormadan otonom çalış; bekleyen görevleri sırayla tamamla, gereksiz onay isteme;
yalnızca gerçek engelde dur ve sor."

### i18n (Türkçe/İngilizce) — DENETLENDİ (28 Tem 2026)
- ✅ TR MODU ZATEN NEREDEYSE TAM TÜRKÇE. Tüm öncelikli sayfalar denetlendi; TR modunda kullanıcıya
  görünen tek İngilizce sızıntı footer'daki "powered by" idi → `hazırlayan` yapıldı (index.html,
  Gelirler, Giderler, Hesaplama_Araclari — sadece tr sözlükleri; en sürüm "powered by" kaldı). DEPLOY BEKLİYOR.
- ⏳ ASIL AÇIK = TERS YÖN (EN modunda Türkçe kalan yerler). Kullanıcı "tam Türkçe olmuyor" derken
  muhtemelen dili EN'e düşmüş görüp Türkçe kalıntılarla karışık görüyor. EN tarafı eksik olan yerler:
  - `mmg-chat-widget.js` + `mmg-feedback-widget.js`: hiç i18n yok, her zaman Türkçe (EN'de Türkçe kalır).
  - `Talimat_Hazirlama.html`: registerDict/data-i18n yok, tüm sayfa sabit Türkçe.
  - `profil.html`: i18n yüklü ama registerDict çağrılmıyor.
  - Eksik sözlük anahtarları (EN'de Türkçe kalır): Hesabim.html (change_login_email vb. ~15 anahtar),
    Istatistikler.html (usage_title/usage_desc), VeriGirisPaneli.html (bank_cur/note), index.html (nav_talimat_full).
  - Dil kontrolsüz Türkçe JS literalleri: KullaniciYonetimi.html, Istatistikler.html, Hesabim.html (bkz. denetim).
  → Bu, EN sürümünü tamamlama işi; büyük ama düz. Kullanıcı İngilizce kullanıcıları önemsiyorsa yapılır.

### Nakit Akış ana tablo — serbest tarih aralığı (X–Y) — BEKLİYOR (büyük, test şart)
- Konsolide görünüme serbest tarih aralığı ZATEN eklendi (önceki oturum). ANA tabloya "tüm veriler için
  X–Y aralığı" modu henüz yok. Rapor/dönem mantığı ~30 yerde `reportTab`'e bağlı + çok-ay yüklemesi
  gerekiyor. Finansal veri, bu oturumda shell/test yok — körlemesine yapmak riskli. Kullanıcı onayı + test ile yapılmalı.

### CHAT & UI — kullanıcı talepleri (28 Tem 2026) — HEPSİ DEPLOY BEKLİYOR
Kullanıcı bir liste verdi. Durum:
- ✅ YAPILDI: Feedback beğenme sorusu ayda 1 → **3 günde 1** (mmg-feedback-widget.js).
- ✅ YAPILDI: Chat'te "Kod: 1002" yerine **kullanıcının adı** (mmg-chat-widget.js). userDirectory/{kod}
  (herkese açık) 'dan username çözülüyor; ad yoksa koda düşer. Başlık + liste + toast + grup gönderen etiketi.
  Mevcut sohbetlerde de çalışır (salt-okunur lookup, önbellekli).
- ℹ️ ZATEN KODDA VAR (deploy edilince çalışmalı; kullanıcı canlıda eski/cache görmüş olabilir):
  - Chat dışına tıklayınca panel kapanır (mmg-chat-widget.js ~satır 510 pointerdown capture).
  - "Gruptan ayrıl" yalnızca grup açıkken görünür (openChat: leaveGroupBtn.hidden = collection!=='chatGroups').
  - Favoriye alınca menüde öğe yerinde kalır (index.html ~1914). Kullanıcının "Gelirler kayboldu" algısı:
    Gelirler "Bütçeleme" alt menüsünde, o grup kapalı olduğu için üstte görünmüyor — favoriyle ilgisi yok.
  - Mesaj/bildirim gelince sağ-alttan toast ZATEN var (showChatToast). Kullanıcı "gelmiyor" diyor —
    canlıda test + gerekirse hata ayıklama gerek (bu oturumda çalıştırılamıyor).
- ✅ YAPILDI (28 Tem, bu oturum): #8 Mesaja tıklayınca menü — Cevapla / İlet / Emoji / Sil. Eski kötü 🗑
  ve 🙂+ butonları kaldırıldı; baloncuğa tıkla → menü. Cevapla: mesajın üstünde alıntı + input üstünde
  cevap çubuğu (replyTo). İlet: sohbet/grup seçme sayfası → o sohbete iletir (forwarded:true). Panel
  dış-tık kapanışı bu menüleri yutmayacak şekilde düzeltildi (react picker'ı da düzeltir).
- ✅ YAPILDI (28 Tem): #6 üst sekme etiketleri kısaltıldı (Davetler / İstekler / Ekle / Admin) — taşma giderildi.
  NOT: Eğer "sohbet modülü" ile daha köklü bir yeniden düzen (ör. ⋮ menü) istiyorsan, tam tasarımı belirt.
- ℹ️ ZATEN KODDA VAR (deploy + HARD REFRESH ile görünür): #12 masaüstü düzenleme modunun TAMAMI
  (kaleme basınca tüm kartlarda ✕ / kalem altı eksi kaldırıldı / +/- büyüteç tüm kutuları eşit ölçekler /
  tüm kutular silinince "Geri Yükle" kutusu / Sıfırla fabrikaya değil mevcut kartların boyutuna döner) —
  index.html satır 2201-2377, yorumlar birebir kullanıcının tarifiyle uyuşuyor. Ayrıca #13'ün sol-alt firma
  çubuğu da kodda var (renderFirmaBadge, satır 3489; firması olmayan → "👤 Kendi Hesabım").
- ✅/⏳ #13 mobil "görüntü kayması": teşhis — içerik sağa ~sidebar kadar kaymış = mobilde masaüstü
  düzeni devreye giriyor (bir öğe yatay taşınca layout viewport genişleyip @media 860px devre dışı
  kalıyor olabilir). DÜZELTME uygulandı: html,body{ overflow-x:hidden; max-width:100% } + mobil
  main{ margin-left:0 !important }. Deploy + HARD REFRESH sonrası test edilmeli; hâlâ kayıksa canlıyı
  Chrome devtools ile (mobil genişlikte) inceleyip taşan öğe bulunmalı.
  Sol-alt firma çubuğu (mmgActiveFirmaBar, satır 1397) + renderFirmaBadge (satır 3495) zaten kodda;
  firması olmayanda "👤 Kendi Hesabım", olanda firma adı gösterir — deploy sonrası görünmeli.
- ‼️ EN ÖNEMLİ: Kullanıcının "çalışmıyor" dediği maddelerin ÇOĞU koda zaten yazılmış ama CANLIDA ESKİ
  sürüm görünüyor. Çözüm: `firebase deploy --only hosting` + tarayıcıda **HARD REFRESH (Ctrl+Shift+R)**.
- Deploy: app-version.json artırıldı (2026-07-28-3) + `firebase deploy --only hosting`.

### DOMAIN / DNS DURUMU (28 Tem 2026 — güncel, doğrulanmış) — SONRAYA BIRAKILDI
- mmgcreativity.com'u **GitHub Pages** sunuyor (A kayıtları 185.199.108–111.153 = GitHub). Netlify DEĞİL.
- Nameserver'lar **Netlify DNS / NS1**: dns1-4.p07.nsone.net. Yani DNS zone bir Netlify takımında.
- Kullanıcı Netlify'a **GitHub ile giriş yapabiliyor** → "mmgcreativity" takımı (mmgcreativity@gmail.com).
  AMA bu takımın DNS listesi BOŞ (app.netlify.com/teams/mmgcreativity/dns). Bu takımda "classy-pika-8b44c5"
  adlı, Netlify Drop ile 18 Tem'de yüklenmiş eski site var (domain buna bağlı değil).
  → mmgcreativity.com'un DNS zone'u BAŞKA bir Netlify takımında (muhtemelen "zippy-hotteok"). Takım
  değiştiriciden (sol üst ↕) diğer takımlar bulunup o takımın /dns sayfasına bakılacak.
- Registrar: kullanıcının Name.com hesabı YOK (Google ile giriş "hesap yok" dedi). Domain Netlify/GitHub
  üzerinden alınmış; muhtemelen Netlify üzerinden kayıtlı.
- SEÇİLEN PLAN (A): domaini Firebase'e bağla. Adımlar: (1) doğru Netlify takımını/DNS zone'unu bul →
  (2) Firebase Console → Hosting → Add custom domain → mmgcreativity.com → TXT + A kayıtlarını al →
  (3) Netlify DNS'te GitHub A kayıtlarını Firebase'inkilerle değiştir + TXT ekle → yayıl.
- O ZAMANA KADAR güncel/gerçek siteyi test etmek için: https://mmgcreativity-31263.web.app

### (ESKİ NOT) mmgcreativity.com = NETLIFY (eski), web.app = FIREBASE (güncel)
- Kullanıcı siteyi mmgcreativity.com'dan açınca HİÇ değişiklik görmüyor + "güncelleme" uyarısı gelmiyordu.
  Sebep: mmgcreativity.com Netlify'daki eski donmuş kopya; `firebase deploy` oraya dokunmuyor. Doğrulandı:
  web.app/app-version.json = 2026-07-28-3 ve chat dosyası tüm değişiklikleri içeriyor (web_fetch ile bakıldı).
  → GÜNCEL SİTE: https://mmgcreativity-31263.web.app  (kalıcı çözüm = #10 DNS: domaini Firebase'e yönlendir).
- "Güncelleme var" uyarısı web.app'te çıkmıyor çünkü kullanıcı zaten en son sürümde; uyarı yalnızca sayfa
  açıkken DAHA YENİ sürüm deploy edilince çıkar (normal davranış).
- ✅ (28 Tem) checkDesktopEmpty düzeltildi: admin/gated kartlar display:none olarak DOM'da durduğu için
  "kart var" sanılıyor, tüm görünür kutular silinince "Geri Yükle" kutusu çıkmıyordu → artık GÖRÜNÜR kart
  kontrolü yapılıyor (sürüm 2026-07-28-4).

## DISPATCH (telefondan görev → masaüstünde çalışır)
- "Dispatch" = telefondan Claude'a görev verip masaüstü bilgisayarında (yerel dosyalar, connector,
  uygulamalar üzerinde) çalıştırma. Tek kesintisiz thread; telefon+masaüstü otomatik senkron, hafıza taşınır.
- Gereksinim: Claude MASAÜSTÜ + MOBİL uygulamalarının EN SON sürümü (claude.com/download) + Pro/Max
  (Max var). Kurulum: Cowork → sol panel "Dispatch" → Get started → dosya erişimi + "bilgisayarı uyanık
  tut" aç → Finish setup.
- ÖNEMLİ SINIR: görev, o an AÇIK ve uyanık olan masaüstünde koşar (bulutta değil). İki-bilgisayar
  düzeninde Dispatch bu devir notunun YERİNE GEÇMEZ, onu tamamlar — OneDrive + bu dosya hâlâ köprü.
- ⏳ SONRA YAPILACAK (28 Tem 2026): Dispatch masaüstünde KURULAMADI. Telefonda Dispatch var ama
  "pairing failed" veriyor; masaüstü uygulamasının sol panelinde "Dispatch" HİÇ görünmüyor (uygulama
  güncellendi/yeniden kuruldu, yine yok). Muhtemel sebep: kademeli beta dağıtımı bu hesabın MASAÜSTÜNE
  henüz ulaşmadı (telefonda olması yetmiyor). → Birkaç gün sonra masaüstü sol panelde "Dispatch"
  çıkmış mı diye tekrar bak; çıkınca Get started → dosya erişimi + uyanık tut → Finish setup, sonra
  telefondan test görevi. Zorlamaya gerek yok, iş bloke değil (OneDrive + devir notu çalışıyor).

## NOTLAR
- Dosyalar OneDrive'da; başka cihazda `html` klasörünü "Bu cihazda her zaman tut" ile hidrate et,
  yoksa erişim kopar.
- ✅ service-worker.js OLUŞTURULDU (28 Tem 2026). index.html satır ~1884'te register ediliyordu ama
  dosya yoktu (sessizce başarısız oluyordu); artık var. Minimal PWA SW: "Ana Ekrana Ekle" için
  gereken fetch dinleyicisi + agresif cache YOK (bayat içerik riski önlendi). DEPLOY BEKLİYOR (yukarı bak).
  NOT: Bu, FCM push için YETMEZ — #16 için AYRI bir `firebase-messaging-service-worker.js` gerekir.
