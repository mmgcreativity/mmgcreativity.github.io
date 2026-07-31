# DEVİR NOTU — Dijital Finans Asistanı (mmgcreativity.com)

Son güncelleme: **2026-07-31 (5. otonom oturum)** · Son deploy işareti: `service-worker.js → SW_VERSION = '2026-07-31-firmakodu-zorunlu'` (repo ~430 commit). ⏳ Kullanıcı bekleyen: IAM signBlob rolü (hesap geçişi INTERNAL). ⏳ Kullanıcı bekleyen: `firebase deploy --only firestore:indexes` (davet listesi) + IAM signBlob rolü (hesap geçişi). **En kritik değişiklik: service worker artık NETWORK-FIRST** (aşağıda 4. oturum). Şifre sıfırlama maili TAM çalışır durumda (Resend canlı).

> ✅ **Sürümleme çözüldü:** "Güncelleme var, yenile" banner'ı (index.html #mmgUpdateBanner) NE app-version.json NE de SW_VERSION'a bakar — index.html'e HEAD atıp ETag/Last-Modified karşılaştırır (tamamen otomatik). `SW_VERSION` sadece cache-bust; `app-version.json` artık okunmuyor ama ikisi senkron tutuluyor. Her deploy'da ikisini de bump'la.

> ⚠️ **OneDrive senkron tuzağı:** OneDrive çalışmıyorken dosyalar "cloud-only" görünür; bash "Invalid argument" verir, düzenleme kaybolabilir veya ESKİ sürüm yüklenir. Deploy öncesi işaret (marker) kontrolü şart. (Kayıtlı skill: `mmg-onedrive-sync-guard`.) Bu klasörde `DEVIR-NOTU-DESKTOP-V12JA3F.md` gibi "DESKTOP-xxxx" çakışma kopyaları OneDrive'ın ürettiği artıklardır — silinebilir.

## 🟢 2026-07-31 (5. OTONOM OTURUM) — CANLIYA ALINANLAR
**Onuncu tur (Firma Kodu ZORUNLU) — SW `2026-07-31-firmakodu-zorunlu`:**
- **Excel'de Firma Kodu artık 3 içe aktarımda da ZORUNLU** (`VeriGirisPaneli.html`, firma kapsamında): Müşteri/Tedarikçi, IBAN'larım, Muhataplar. Kod boş ya da eşleşmeyen satır **KAYDEDİLMEZ** (atla + "⚠️ N satır atlandı: Firma Kodu boş/eşleşmedi (…)" raporu). IBAN'da isim-fallback ve aktif-firma-fallback kaldırıldı — tek doğruluk kaynağı KOD.
- **Elle eklemede kod istenmez, otomatik atanır:** cari + muhatap manuel kayıtları `appliesTo` boşsa artık otomatik `[scopeId]` (aktif firma) alır; IBAN manuel kaydı zaten öyleydi. Atanmamış "global" kayıt artık hiçbir yoldan oluşamaz.
- 3 Excel şablonunun örnek satırlarına kod örneği (1000/1001) kondu; notlar "Firma Kodu ZORUNLUDUR… eşleşmeyen satır KAYDEDİLMEZ" olarak güncellendi.
- ✅ Kullanıcı `firebase deploy --only firestore:indexes` çalıştırdı (firmas.firmaId index'i CANLI) → bekleyen davetler artık panelde görünür. Kalan tek kullanıcı işi: IAM signBlob (hesap geçişi).

**Dokuzuncu tur (IBAN import eşleşme) — SW `2026-07-31-iban-import-eslesme`:**
- **IBAN Excel içe aktarımında "karışma"nın ASIL kaynağı bulundu:** satırdaki firma adı/kodu grup firmalarıyla eşleşmeyince kod satırı SESSİZCE AKTİF firmaya bağlıyordu → tüm IBAN'lar tek firmaya (YAŞAR CİHAN) yığılıp gönderen listesinde düzinelerce görünüyordu. Düzeltme (`VeriGirisPaneli.html` banksBulkConfirm): firma YAZILMIŞ ama eşleşmemişse satır **ATLANIR ve uyarıyla raporlanır** (ilk 5 eşleşmeyen ad gösterilir); yalnızca firma kolonu tamamen BOŞ satırlar aktif firmaya bağlanır. Kullanıcının akışı: Tüm IBAN'ları Sil → Excel'de firma adı/kodu düzelt → yeniden yükle → her IBAN kendi firmasında.

**Sekizinci tur — SW `2026-07-31-iban-strict-tabhome`:**
- **IBAN gönderen SIKI filtre:** `fetchFirmaGonderenBilgisi` banks okuması artık YALNIZCA aktif firmaya AÇIKÇA atanmış (`appliesToFirmaIds` içeren) hesapları alır; **af-null "global" ve başka firma IBAN'ları GELMEZ**. (Yedinci turda kayitliMuhataplar zaten kaldırıldı; düzinelerce IBAN'ın asıl kaynağı grup HUB'ındaki af-null banks kayıtlarıydı — VeriGiriş sıkı filtreliyor, Talimat af-null'ı gösteriyordu.) ⚠️ Atanmamış IBAN görünsün istenirse VeriGiriş → IBAN'larım'da "🏢 tüm firmalar" rozetine tıklayıp aktif firmaya atanmalı. Test: Ctrl+Shift+R (iframe cache!).
- **Sekme şeridi Ana Sayfa (⌂) ikonu KALDIRILDI** (mmgRenderTabs `html=''`) — sol menüde zaten var, masaüstünde mükerrerdi.
- **Bekleyen davet listede görünmüyordu:** `collectionGroup('firmas').where('firmaId')` için index yoktu → sorgu patlıyor → davet ne "Kullanıcılarım"da ne "Bekleyen Davetler"de görünüyordu. `firestore.indexes.json`'a **`firmas.firmaId` COLLECTION_GROUP fieldOverride** eklendi. **Kullanıcı `firebase deploy --only firestore:indexes` çalıştırmalı** (index ~1 dk'da kurulur), sonra davetler görünür.

**Yedinci tur (IBAN gönderen kök çözüm) — SW `2026-07-31-iban-gonderen-fix`:**
- **Talimat "Gönderen IBAN" düzinelerce IBAN gösteriyordu** ("sildim ama geliyor"). Kök neden: gönderen listesi hem VeriGiriş'in yönettiği `firmaAccounts/{firmaId}/banks` (3-4) HEM DE legacy `talimat/kayitliMuhataplar.ibans` dizisinden (toplu içe aktarımla düzinelerce) besleniyordu; VeriGiriş silmesi yalnız `banks`'i temizlediği için legacy dizi kalıyordu. Çözüm (`Talimat_Hazirlama.html`): (a) `fetchFirmaGonderenBilgisi` artık kayitliMuhataplar okumaz, gönderen IBAN'ı YALNIZCA `banks`'ten. (b) `refreshIbanSelectForFirma` gönderen (`fGonderenIbanSaved`) için **yalnız `_db` (banks) girişleri** gösterir — SADECE firma kapsamında (`scopeCollection==='firmaAccounts'`); kişisel kapsam eski davranışta (regresyon yok). (c) `autoFillGonderenIban` da firma kapsamında yalnız `_db`. (d) `loadMyFirms` dedup'ı artık yalnız diğer `_db`'ye karşı (legacy aynı-IBAN gerçek banka kaydını gizlemesin). Alıcı (recipient) listesi değişmedi.
- ⚠️ Legacy `kayitliMuhataplar.ibans` verisi SİLİNMEDİ (alıcı tarafında hâlâ görünebilir); istenirse VeriGiriş "Tüm IBAN'ları Sil" bunu da temizleyecek şekilde genişletilebilir.
- **#1023 gibi boş kayıt gizleme** (KullaniciYonetimi Admin tablosu): ad VE e-posta yoksa listede gösterilmez (veri silinmez, kod ileride atanabilir).

**Altıncı tur (menü/flyout hızlı düzeltmeler) — SW `2026-07-31-menu-flyout-fix`:**
- **Flyout boş-sekme hatası:** alt-menülü flyout başlıkları ("Krediler", "Vade Hesapları") `data-target` taşımadığı için tıklanınca `openTarget(undefined)` → saçma boş sekme açıyordu. `openTarget` başına `if(!target) return;` guard'ı eklendi.
- Firma kodu input placeholder'ından "(zorunlu)" kaldırıldı ("Kod"). Validasyon (zorunluluk) duruyor.
- **"Günlük Panorama" Bütçeleme menüsünden kaldırıldı** (Nakit Akış'ta günlük görünüm zaten var). Sayfa dosyası `Gunluk_Panorama.html` duruyor, sadece nav öğesi çıkarıldı.
- ⏳ **AÇIK/BEKLEYEN (kullanıcı bu turda bildirdi, YAPILMADI):** (1) **Hesaplar arası geçiş "INTERNAL"** — `accountSwitchToken` Cloud Function'da `createCustomToken` patlıyor; kök neden büyük olasılıkla runtime servis hesabına **`roles/iam.serviceAccountTokenCreator`** verilmemiş (gen2). Kullanıcı GCP'de bu rolü vermeli. (2) Sekme şeridi anasayfada hero ALTINA. (3) Masaüstünde tab-şeridi ev ikonu + üstteki KUR/hesap ikonları — ya sol menü gibi ışıldaklı ya da (kullanıcı fikir değiştirdi) masaüstünde kaldır. (4) Düzenle (kalem) ikonu masaüstünde `position:fixed` sağ-üstte kalmıyor (regresyon). (5) Döviz panosuna Gram Altın + kullanıcı-eklemeli parite. (6) İstatistik/Tüm Kullanıcılar'da #1023 gibi boş (ad/e-posta/tarih yok) kayıtlar.

**Beşinci tur (nav gating) — SW `2026-07-31-panel-nav-admin`:**
- **"Veri Yönetimi → Kullanıcı Yönetim Paneli" nav öğesi site yöneticisinde görünmüyordu.** Sebep: `navKullaniciYonetimBtn` yalnızca `mmgAdminFirmaIds.length>0` (firma admini) ile açılıyordu; site-admin (yalnız `isAdmin=true`, firma admini değil) için gizli kalıyordu (İstatistikler/Referans ise `data.isAdmin` ile açılıyor). Düzeltme (`index.html`): global `mmgIsSiteAdmin` (onAuthStateChanged'de `data.isAdmin`'den set) eklendi; `loadAdminFirmas` gating'i `mmgAdminFirmaIds.length>0 || mmgIsSiteAdmin` oldu. Bu turda index.html İLK KEZ yeniden deploy edildi (canlı = benim 'kullanici-paneli' sürümümdü; sekmeli-arayüz için ayrı bir index.html deploy'u yoktu). Anasayfa ilk-açılış mantığı korunuyor.

**Dördüncü tur (panel düzeltmeleri) — SW `2026-07-31-panel-arama-cikis`:**
- İstatistikler'e yanlışlıkla eklenen "🛠 Kullanıcı Yönetim Paneli" butonu KALDIRILDI. Doğru yer zaten var: **index.html Nav → "Veri Yönetimi" çekmecesinde `navKullaniciYonetimBtn`** (firma admini olana gating ile görünür, line ~1611+4629). index.html'e dokunulmadı.
- `KullaniciYonetimi.html`: **"← Ana Sayfa"** çıkış butonu eklendi (hem pageWrap hem guard ekranına; `mmg_last_open_page` temizlenip index.html'e top-navigate). Admin "Tüm Kullanıcılar" tablosuna **sütun başına arama kutuları** (fltKod/fltAd/fltEposta/fltDurum/fltKayit, `.ky-col-filter`) eklendi; global arama + sütun filtreleri AND mantığıyla birlikte çalışır.

**Üçüncü tur (admin tüm kullanıcılar) — SW `2026-07-31-panel-tum-kullanicilar`:**
- **Kullanıcı Yönetim Paneli'nde admin-only "🛡️ Tüm Kullanıcılar" tablosu** (`KullaniciYonetimi.html`): `users/{uid}.isAdmin===true` ise girişte `getDocs(collection('users'))` ile TÜM site kullanıcıları (arama + #kod + ad + e-posta + durum + kayıt) listelenir. Normal firma yöneticileri DEĞİŞMEDEN yalnızca kendi firma/kullanıcılarını görür. Firması olmayan site-admin de paneli açıp bu tabloyu görebilir (firma grid'i gizlenir). İstatistikler'deki "🛠 Kullanıcı Yönetim Paneli" bağlantısı buraya götürür.
- ⚠️ **index.html'e DOKUNULMADI:** oturum sırasında `service-worker.js`/`app-version.json` dışarıdan `2026-07-31-sekmeli-arayuz` olarak değiştirilmişti (muhtemelen sekmeli arayüz için ayrı çalışma). Onu ezmemek için bu turda yalnızca `KullaniciYonetimi.html` + SW + app-version deploy edildi; index.html YENİDEN YÜKLENMEDİ. Sekmeli arayüz deploy edilirken SW_VERSION tekrar bump edilmeli.

**İkinci tur (Kullanıcı Yönetim Paneli + anasayfa) — SW `2026-07-31-kullanici-paneli`:**
- **İlk açılışta HER ZAMAN anasayfa** (`index.html`): `sessionStorage['mmg_session_started']` ile ilk giriş (yeni sekme/PWA açılışı) tespit edilir → `mmg_last_open_page` temizlenir, `home` açılır. Aynı oturum içindeki F5'te (masaüstü) açık araç yine geri yüklenir.
- **Firma kodu ZORUNLU** (`KullaniciYonetimi.html` +Ekle): boşsa uyarı verir, otomatik üretim kaldırıldı; input placeholder "Kod (zorunlu)".
- **Kullanıcılarım kod/isim eşleşme hatası düzeltildi:** firma admin başka kullanıcının `users/{uid}` dokümanını okuyamadığı için kod `userDirectory`'den (uid ile) çözülüyordu; kullanıcı kodu değişince eski userDirectory kaydı silinemeden kaldığından (kurallar delete'e izin vermiyor) `docs[0]` ESKİ kodu veriyordu (sema 1022 iken 1021). Artık **en yüksek sayısal kod** (en güncel) seçiliyor.
- **Davet: "🔍 Sorgula" + maskeli ad onayı:** kod girilip Sorgula'ya basınca `userDirectory/{kod}`'dan ad çekilip **maskeli** (a**** b***) gösterilir; "Davet Gönder" artık önce sorgulama zorunlu (`inviteVerifiedCode===code`), kod değişince doğrulama sıfırlanır → yanlış kişiye davet önlenir.
- **Davet aşaması:** Bekleyen davet satırına "ne zaman gönderildi" (göreli zaman) + "kişi henüz kabul etmedi" etiketi eklendi (mevcut "Bekleyen Davetler / Davet Gönderildi" akışı zaten aşamayı gösteriyordu).
- **Kullanıcı listesi mimarisi (karar):** İstatistikler'deki tablo = TÜM site kullanıcıları (yalnız site-admin); Kullanıcı Yönetim Paneli = tek firmanın kullanıcıları. Kapsamlar farklı olduğundan tablo taşınMADI (firma adminine tüm siteyi açmak güvenlik riski). İstatistikler'e **"🛠 Kullanıcı Yönetim Paneli" bağlantısı** eklendi (sayıdan panele geçiş). Panelin firma-kullanıcı listesi zaten mevcut. Tam "firma-kullanıcı tablosu" istenirse ayrı iş.

- **Beğeni / geri bildirim ("Uygulamayı beğendiniz mi?") KALDIRILDI** (kullanıcı isteği): `mmg-feedback-widget.js` **no-op** yapıldı → tüm sayfalardan soru/popup anında kalktı (dosya, `<script src>` referansları 404 vermesin diye boş bırakıldı; eski sürüm git geçmişinde). `Istatistikler.html`'de "💬 Beğenme Geri Bildirimleri" bölümü (HTML + `render()`/`loadFeedback()`/`tblBody`/`refreshBtn`/filter-btn JS'i + Promise.all çağrısı + kullanılmayan const'lar) tamamen çıkarıldı; sayfa altyazısı "...talimat kullanım istatistikleri" olarak güncellendi (tr+en). SW `2026-07-31-begeni-kaldirildi-2`. Canlı doğrulandı.
- ⚠️ **Orphan dosya:** repoda `Begen_Istatistikleri.html` hâlâ var ama YERELDE YOK ve index.html menüsünden hiçbir yere BAĞLI DEĞİL (erişilemez eski sayfa). İstenirse GitHub'dan silinebilir; bağlı olmadığı için canlı bir etkisi yok.
- ℹ️ **Talimat kullanım istatistiği "veri gelmiyor" teşhisi:** Kod/kurallar tam ve canlı; okuma başarılı (admin), 0 kayıt = feature canlıya geçtikten SONRA girişli kullanıcı henüz talimat (PDF/Word) üretmemiş. Sadece İLERİYE dönük sayar (geçmiş talimatlar backfill edilmez). Test: girişliyken bir talimat üret → Istatistikler "↻ Yenile".

## 🟢 2026-07-30 (4. OTONOM OTURUM) — CANLIYA ALINANLAR

**⭐ EN KRİTİK — Service Worker NETWORK-FIRST (deploy'lar artık ANINDA geliyor)**
- Şikâyet: "deploy ediyorum ama değişiklik cihaza gelmiyor / çoğu iş yok gibi görünüyor." Sebep: SW **stale-while-revalidate** idi → açılışta ESKİ cache'i gösteriyordu.
- `service-worker.js` yeniden yazıldı: **HTML/JS/CSS/JSON = NETWORK-FIRST** (önce ağdan en güncel, çevrimdışıysa cache'e düşer). Görsel/font = stale-while-revalidate. Artık her açılış güncel kodu çeker.
- ⚠️ **Oto-yenileme DENENDİ ve KALDIRILDI:** "yeni SW devralınca sayfayı bir kez otomatik yenile" (controllerchange) eklenmişti; **telefonda giriş/SMS akışının ortasına denk gelip oturumu düşürüyordu** ("telefonla gir kayboldu"). Kaldırıldı — network-first zaten güncelliği sağlıyor, zorla yenilemeye gerek yok. Bir daha eklenmesin.

**Firma Kodu (isim-eşleşme sorununu bitiren özellik)**
- `KullaniciYonetimi.html`: firma açarken **oto kod üretir** (`mmgGenFirmaCode`, isimden + rastgele son ek; `mmgNormalizeFirmaCode` A-Z0-9), kullanıcı **kendi kodunu** da girebilir (`#newFirmaCode`), seçili firmanın kodunu **düzenle/kaydet** (`#firmaCodeEditRow`, `saveFirmaCodeBtn` → `firmaAccounts/{id}.firmaCode`). Aynı kod iki firmada olamaz.
- `VeriGirisPaneli.html`: **3 Excel şablonuna** (Müşteri/Tedarikçi, IBAN'larım, Muhataplar) "Firma Kodu" sütunu; toplu içe aktarım **önce firma koduyla** eşleşir (`mmgFirmaCodeToId`/`codeToId`), kod yoksa isimle, o da yoksa aktif firmaya. Muhataplar import da artık aktif firmaya bağlanıyor (eskiden global). Firma-seç kutularında firma adının yanında `[KOD]` gösteriliyor.

**Menü / Mobil (`index.html`)**
- **"Vade Hesapları"** flyout grubu eklendi (Ortalama Vade, Kredi Kartı Vade Farkı, Vadeli Mevduat + Vade Sapması); "Diğer Araçlar" başlığı navdan kaldırıldı.
- **Mobil hesap/firma çubuğu:** `#mmgBottomLeftBar` (hesap) + `.mmg-firma-bar-wrap` (aktif firma) `<nav>` DIŞINDaydı → mobilde aside en üstte kalıp "hesabım hep yukarıda" oluyordu. Artık JS ile mobilde **`<nav>`'ın en altına** taşınıyor (menü kapalıyken görünmez, açılınca dipte); masaüstünde yer-imi yorumlarıyla eski yerine döner.
- **Alt menü çakışması:** mobilde `.nav-drawer{position:static !important; inset:auto !important …}` — inline `position:fixed` koordinatları ezilir, alt maddeler ana başlığın altında girintili açılır.
- **Aktif firma listesi:** çubuğa basınca açılan `#mmgFirmaSwitchPopup` `bottom:100%` (çubuğun üstü) idi; çubuk üstteyken ekran dışına taşıp "gelmiyor" görünüyordu → mobilde **inline** (`position:static !important`) açılır.
- Hero açıklaması ("İşletmeler…") mobilde gizli (zaten vardı, doğrulandı).

**Talimat (`Talimat_Hazirlama.html`)**
- Gizli kalmış **"⚠️ ÇOK ÖNEMLİ" IBAN uyarı metni tamamen silindi** (`#fGonderenIbanHint` boş div).
- **Gönderen tarafı:** banka SEÇİLİYKEN o bankaya ait IBAN yoksa artık yanlış bankanın IBAN'ı kalmıyor, **temizleniyor** (alıcı tarafıyla aynı davranış; `autoFillGonderenIban` içinde `if(banka && byBank.length===0){ ibanEl.value=''… }`).

**Şifre Sıfırlama Maili — TAM ÇALIŞIR (Resend canlı)**
- Resend kurulumu tamam: domain **mmgcreativity.com VERIFIED** (DNS Netlify'de; DKIM `resend._domainkey`, SPF `include:amazonses.com`, MX eu-west-1), `RESEND_API_KEY` secret tanımlı ve `sendPasswordResetMail`'e bağlı, deploy edildi. Artık `noreply@mmgcreativity.com`'dan gerçek mail gidiyor.
- Şablon (`functions/index.js` → `resetEmailHtml`) **markalı** ve **site paletiyle** yeniden yazıldı: koyu lacivert #0D1420 degrade zemin (mercan/azure hafif parıltı), kart #141C2B, **3D degradeli mercan buton** (gölge + iç parlaklık), brass "MMG Creativity / Dijital Finans Asistanı".
- **Logo GÖMÜLÜ (inline/CID):** `functions/index.js`'te `MMG_LOGO_B64` sabiti (96px DFA_icon base64) var; Resend `attachments`'ta `content_id:"mmglogo"` + HTML'de `<img src="cid:mmglogo">` → Outlook "uzak görsel engellendi" demeden gösterir.
- Sıfırlama **sayfası Türkçe:** üretilen link `lang=tr`'ye çevriliyor (Firebase varsayılan `lang=en` ekliyordu).
- ⚠️ Bu değişiklikler **backend** — kullanıcı `firebase deploy --only functions:sendPasswordResetMail` ile deploy etti (tasarım onaylandı: "tasarım ok").

**Denetim (önemli teşhis)**
- Kullanıcı "yaptım dediğin işlerin çoğu yok" dedi. **4 Explore alt-ajanıyla** index/Talimat/VeriGiris/functions+Istatistikler+chat+KullaniciYonetimi satır satır denetlendi → **iddia edilen işlerin HEPSİ kodda kanıtlandı**. Gerçek sebep = SW cache (yukarıda network-first ile çözüldü).

**Telefonla giriş (netleştirildi, kod değişmedi)**
- Tasarım gereği: telefon numarası bir e-posta hesabına **bağlı değilse** SMS girişi boş "misafir" hesap açar ve `onAuthStateChanged` guard'ı (index.html ~3299) onu **siler + giriş ekranına atar**. Çözüm kullanıcıda: önce e-posta/şifre ile gir → **Ayarlar → Telefonumu Bağla** → sonra telefonla giriş çalışır.

### 📌 4. OTURUM SONU — KALAN İŞLER
- **Node 20 → 22:** fonksiyon ortamı **30 Ekim 2026**'da kalkıyor. `functions/package.json` `engines.node="22"` + `firebase-functions@latest` → test ederek yükselt (kırıcı değişiklik riski, birlikte yapılmalı).
- **Fonksiyon bölge uyumu (opsiyonel):** `pushOnNotification` ve `notifyAdminsOnReferralSignup` fonksiyonları `us-central1`, tetikleyicileri `eur3` → küçük gecikme/maliyet. İstenirse `eur3`'e taşınır.
- **Güvenlik:** ekran görüntülerinde görünen Resend API anahtarını yenile (Resend'de sil + yeni oluştur + `firebase functions:secrets:set RESEND_API_KEY` 3 satırlık `Set-Content` yöntemiyle).
- **BÜYÜK (ertelendi):** Logo j-Platform tarzı **sekmeli/çok-ekranlı arayüz** — ana sayfada araçların sekmelerde açılıp aralarında geçilmesi. Başlanmadı; `index.html` shell yapısı hazır (`#home-screen`, `#frame-wrap`, `#app-frame`, `openTarget`). Çekirdek kabuğu değiştirir + canlı test gerektirir → ayrı, odaklı oturum. Blind deploy RİSKLİ (canlı finans uygulaması).
- **`notifyAdminsOnReferralSignup`** fonksiyonu eklendi (referans kaydında adminlere bildirim); kod sahibine bildirim zaten istemci + `pushOnNotification` ile gidiyor.
- Klasörde `._ck_1.mjs` adlı zararsız geçici dosya kaldı (OneDrive silme izni vermedi) — kullanıcı elle silebilir, deploy'a dahil değil.

## 🟢 2026-07-30 (3. OTONOM OTURUM) — CANLIYA ALINANLAR
**Giriş / hesap**
- **Giriş butonu çalışmıyordu** → gizli `#authUsername` alanındaki statik `required` formu görünmez şekilde geçersiz kılıyordu. `required` HTML'den kaldırıldı, `setAuthMode` içinde moda göre toggle edilir. ✓ canlı doğrulandı.
- **E-posta normalize (`mmgNormalizeEmail`):** ASCII küçük harfe çevirir, birleşik aksan işaretlerini soyar → autofill'in gönderdiği "FİNANS@…" (büyük Türkçe İ) artık reddedilmiyor. `#authEmail{text-transform:lowercase}` + autofill koyu-tema CSS (`-webkit-autofill`).
- **"Oturumu açık tut"** kalıcı (`mmg_keep_signed_in`); seçilince hep tikli gelir.
- **Rozet** artık **"#kod ad"** (e-posta yok); ad yoksa e-posta local-part fallback.

**Menü / index.html**
- **Ayarlar** artık açılır-pencere değil, diğer modüller gibi ana alanda açılıyor (`#mmgSettingsOverlay` sol=`var(--sidebar-w)`); başka modüle geçince kapanır (`_stOv.hidden=true`).
- **"Kurumsal Hesap"** bölümü kaldırıldı; **"Entegrasyon"** nav öğesi gizlendi (`display:none`).
- **"Veri Analizi" → "Veri Yönetimi"**; nav yazı boyu +1.
- **Krediler alt-menüsü sağa açılan (flyout):** `.nav-subwrap`/`.nav-subdrawer` hover CSS → Rotatif / Taksitli / **Kredi Karşılaştır** (eski "Kredi Teklif Karşılaştırma" yeniden adlandırıldı).
- **Günlük Panorama** Bütçeleme çekmecesinin en üstüne alındı.
- **Masaüstü döviz/altın widget'ı** artık sabit (`position:fixed; top:64px`) — sayfayla aşağı kaymıyor.
- **Mobil:** `.app-card p{display:none}` (kartlarda sadece başlık); `.brand-row-logo/-fallback` 88px'e küçültüldü; `.brand-title` 15px. ✓ canlı doğrulandı.

**IBAN kök çözümü (kullanıcının en çok uğraştığı sorun)**
- Sebep: paylaşımlı havuzda bankalar firmaya etiketsizdi → her firmada 15+ IBAN görünüyordu.
- `VeriGirisPaneli.html`: **IBAN Excel içe aktarımına "Firma" kolonu** eklendi (şablon başlığı `['Firma', …]`); firma adı → id eşlenir (`groupFirmaMembers`/`nameToId`) ve `docData.appliesToFirmaIds=[fid]` yazılır. Yükleme sırasında **tekilleştirme** (`dedupeBanks`), kayıtta **mükerrer IBAN engeli**, **"🗑 Tüm IBAN'ları Sil"** (çift onay) butonu.
- `Talimat_Hazirlama.html`: "Kayıtlı" IBAN dropdown'u `appliesToFirmaIds`'e göre **firmaya göre filtreler** + dedup; Akbank seçiliyken diğer bankalar gelmez. Gönderen/alıcı firma alanına tıklayınca grup firmaları anında açılır (odakta hepsi listelenir); "GRUP FİRMASI" etiketi kaldırıldı; dropdown kırpılması giderildi (`.xcell-group{overflow:visible}`). PDF logo y 12→26mm (~2.6cm üst boşluk). Logo/kaşe Yükle+Kaldır 3 kutu yan yana.

**Kullanıcı Yönetimi (`KullaniciYonetimi.html`)**
- **Gruba firma ekleme/çıkarma** (`deleteFirmaById`, onaylı); Firmalarım'da firma seçici + küçük 🗑; grup listesinde firma-başı 🗑.
- **Kullanıcılarım** artık **"#kod ad"** (e-posta gizli, tıklayınca alta açılır panelde); üye çıkar ✕ → 🗑; tüm silmeler "emin misiniz?" sorar.
- **#kod görünmüyordu** (firma-admin diğer `users/{uid}` dokümanını okuyamıyor) → **`userDirectory`'den fallback** (uid ile sorgu; doküman anahtarı = müşteri no, `{uid, username, email}` içerir). ✓ canlı doğrulandı.

**Chat (`mmg-chat-widget.js`)**
- **Dürt butonu** (kabul beklenen kişiyi dürtme) gönderilen-istekler listesinde; İstek↔Grup sekmeleri yer değiştirdi; bildirimlerde **"🗑 Tümünü Sil"**; toast üst sınırı 3.
- **Dürt ✅ işareti tam 60 sn kalır** (`applyCooldown()` → `localStorage['mmg_last_nudge_'+uid]` okur, kalan süre boyunca disable+✅, her render'da yeniden uygulanır). ✓ canlı doğrulandı.

**Hesaplama araçları**
- **Rotatif Kredi:** bileşik faiz eklendi (`bilesikPeriyot` → `tutar*(pow(1+oran*P/gbFaiz, vade/P)-1)`), "Bileşik Faiz Periyodu" girişi; BSMV kutusu 2 haneye daraltıldı.
- **Taksitli Kredi → "📤 Kredi Karşılaştırma'ya Aktar"** butonu: `trancheRows` → offers'a map, `localStorage['mmg_kk_transfer']`, `mmg_last_open_page='kredi-karsilastirma.html'`, `index.html`'e yönlendirir. `kredi-karsilastirma.html` init'te bunu okuyup offers'ı ezer; özet stat kartları gizlendi.
- **Ortalama Vade / Vade Sapma / Vadeli Mevduat:** açıklama tablo üstüne alındı, gün kutusu daraltıldı, toolbar tek satır, cafcaflı stat kartları kaldırıldı. Vade Sapma açıklaması yeniden yazıldı (tr+en).

**Performans**
- **`service-worker.js` stale-while-revalidate'e çevrildi** (aynı-origin GET): önbellekte varsa anında döner, arka planda tazeler → modüller çok daha hızlı açılır. Firestore/CDN (cross-origin) ve non-GET dokunulmaz, kullanıcı verisi bayatlamaz. Cache adı `SW_VERSION`'a bağlı.

### ✅ 3. OTURUM — İKİNCİ TUR (kalan maddeler frontend'de çözüldü)
1. **Forum logosu ÇÖZÜLDÜ (frontend):** Kullanıcının PDF/Talimat logosu `users/{uid}` kökünde değil, **`{scope}/{scopeId}/talimat/firmaProfili.logoBase64`** altında saklanıyordu — o yüzden kendi logosu bile forumda gelmiyordu. `Forum.html`'e **`resolveScopeLogo(uid, userData)`** eklendi (Talimat ile aynı kapsam mantığı: `mmg_active_data_scope` → firmaAccounts/hub veya companies veya users/uid). `currentUserAvatar` artık bunu da dener → **kendi logo forumda görünür**. Yeni post/yanıtta `authorAvatar` gömülü kaydedildiği için logo **diğer herkese de yayılır** (ileriye dönük). `resolveForumAvatar` ayrıca `users/{uid}/talimat/firmaProfili`'yi de fallback dener (kişisel kapsamlı kullanıcılar için). *Kalan tek sınır: başka bir firma-kullanıcısının ESKİ (authorAvatar boş) post'unda logo, o kullanıcı foruma girip yeni post atana kadar veya kurallar ortak okuma izni verene kadar gelmeyebilir.*
2. **İlk-giriş bildirim pop-up'ı EKLENDİ (frontend):** `index.html` → **`mmgShowPushPrompt()`** sağ-altta "🔔 Bildirimleri aç" kartı gösterir (bir kez; `mmg_push_prompt_dismissed` bayrağı). "Aç" → `mmgEnablePush()` (izin ister + FCM token'ı `users/{uid}/fcmTokens`'a yazar). Kullanıcı hareketiyle istendiği için tarayıcı-gesture kısıtı sorun olmaz. *Kalan: teslimat TUTARLILIĞI (1018→admin gelip admin→1018 gelmemesi) `pushOnNotification` backend işi — `firebase functions:log --only pushOnNotification` gerekli.*
3. **Mobil brand+hero birleştirme YAPILDI:** Mobilde ayrı `.brand`/`.brand-row` logo bloğu **gizlendi** (hero ile aynı kimliği iki kez gösterip yer kaplıyordu); **hero tek kompakt başlık** oldu (app-icon 56px, başlık 20px, dar padding/boşluklar, `Powered by mmgcreativity` pill'i zaten hero'da). *İsteğe bağlı ileri iş: tek birleşik SVG/PNG grafiği (tasarım).*

### 📌 BACKLOG (kullanıcı istekleri — sonra yapılacak)
- ✅ **Talimat kullanım istatistiği — TAMAMLANDI & CANLIDA** (2026-07-31 doğrulandı): `Talimat_Hazirlama.html` her PDF/Word çıktısında `mmgLogTalimatUsage(tur, method)` → `talimatUsage` koleksiyonuna yazar (`addHistoryEntry`'nin tüm çağrı noktalarına bağlı: havale-tekli, generic, serbest-metin; PDF ve Word). `Istatistikler.html` → `loadTalimatUsage()` bunu tür bazında (Toplam/PDF/Word) + en çok kullanan kişiler olarak raporlar. `firestore.rules`'ta `talimatUsage` match'i var. Canlı Istatistikler sayfasında "📝 Talimat Kullanımı" bölümü görünüyor.
- **Mobil düzen (devam):** üst firma logo+kod+ad scope bar'ı açılır menü EN ALTINA taşı (hero üstte kalsın); flyout alt-menüler (Krediler/Vade Hesapları) mobilde ana maddelerle çakışmasın (inline aç). Hero açıklama kesilmesi düzeltildi (`white-space:normal`).
- **Google Cloud free trial kredisi** (~₺14k, 27 Eki 2026'da yanar): Gemini/Document AI ile "belge→otomatik giriş", j-Platform konektörü gibi işlerde değerlendirilebilir.

### ⏳ KALAN (frontend'de çözülemez)
4. **FCM push TESLİMAT tutarlılığı:** yukarıda #2 — backend log analizi. İzin+token akışı ve pop-up artık hazır.
5. **Misafir beğeni (anonim auth + kurallar):** "isimsiz hesap istemiyorum" ilkesiyle çelişiyor — ürün kararı bekliyor.
6. **Backend (2026-07-29'da deploy edildi, kullanıcı doğrulasın):** markalı Türkçe şifre-sıfırlama (Resend), Blogger publish. `functions/index.js`'te Blogger bloğu YORUMDA; lazımsa yorumdan çıkar + secret'ları tanımla.

## 🟢 2026-07-29 (2. OTONOM OTURUM) — CANLIYA ALINANLAR
- **Tablet:** Gelir/Gider "büyük boş alan" (flex-basis 440px kartı yükseklik yapıyordu) düzeltildi (`.add-io-row .add-payment-card{flex:0 0 auto}`); Talimat önizleme tablette tam genişlik.
- **Menü:** "Sosyal" → **"Keşfet"** (TR/EN "Explore"); Finans Sözlüğü Hesaplamalar'dan **Keşfet** altına taşındı; Keşfet + Veri Analizi başlıklarına favori yıldızı; "Logo/Zirve Entegrasyonu" → **"Entegrasyon"**; mobil nav alt-öğe girintisi düzeltildi (alt öğeler başlık altına hizalandı).
- **Hesap/rozet:** "#kod ad" formatı; firma yoksa mükerrer sol-alt kapsam çubuğu gizlendi.
- **Ayarlar:** tam ekran yapıldı; içine **Entegrasyon** butonu + **Telefonumu Bağla** eklendi.
- **Nakit Akış — GRUP (eski "Konsolide") görünümü baştan yazıldı:** "Konsolide"→**"Grup Göster"**; grup görünümü artık firma-kırılım DEĞİL, **gün gün tarih tablosu** (seçili firmaların günlük toplamı); günü tıklayınca kalem kalem açılır (firma adlı, `groupExpanded`); **Haftalık** pill'leri kaldırıldı, ◀▶ ile hafta gezinme (aylık mantığı); **Yıllık** grup = ay-bazlı tablo; **Günlük grup = kategori-bazlı PANORAMA** (Müşteri Çekleri=Çek Tahsilatı, Kredi Kartları, Kredi Taksitleri, Teminat, Komisyon…); toolbar "Grup Göster" kesilmesi düzeltildi (wrap); **Bugün** ve **Kaydet** butonları kaldırıldı (otomatik kayıt var); özet kartlar (Gelir/Gider/Net) toolbar hizasına alındı.
- **Günlük Panorama sayfası** (`Gunluk_Panorama.html`, menü: Bütçeleme): mevcut Gelir/Gider (cashflow) verisinden kategoriye göre günlük panorama. (İlk sürümde ayrı detaylı giriş vardı; kullanıcı "çift giriş istemiyorum" deyince mevcut veriden çekmeye çevrildi.)
- **Telefon ile giriş (Firebase Phone Auth, istemci tarafı):** login ekranına "📱 Telefon ile giriş" (+90 önden dolu, 0/90/5 normalize, Enter=gönder); Ayarlar → Telefonumu Bağla (mevcut hesaba `linkWithPhoneNumber`). **Phone provider Firebase Console'da AÇILDI** (Claude tarafından). mmgcreativity.com zaten Authorized domains'te.
- **Ayşen firma erişimi kök nedeni:** `members.uid` için **collectionGroup index'i yoktu** → sorgu bayat `firmaIds`'e düşüyordu. `firestore.indexes.json`'a fieldOverride eklendi → **kullanıcı `firebase deploy --only firestore:indexes` çalıştırmalı** (kod değişikliği gerekmez).

## ✅ BACKEND — TAMAMLANDI (2026-07-29 sonu, canlıda)
1. ✅ `firebase deploy --only firestore:indexes` çalıştırıldı → `members.uid` collectionGroup index'i canlıda → Ayşen tüm firmaları görür.
2. ✅ **Cloud Functions deploy edildi** (10 fonksiyon canlıda): `sendPasswordResetMail`, `pushOnNotification`, `firmaSetSeats/CreateMemberInvite/CreateAdminInvite/AcceptInvite/RemoveMember`, `accountLinkConfirm/SwitchToken/Unlink`.
3. ✅ **Spam mail çözüldü:** Resend'de **mmgcreativity.com domain VERIFIED** (SPF+DKIM+DMARC DNS kayıtları Netlify `cihangrupfinans` ekibi altındaki mmgcreativity.com DNS zone'una eklendi). `RESEND_API_KEY` secret tanımlandı ve servis hesabına bağlandı. Artık `noreply@mmgcreativity.com`'dan markalı Türkçe mail gider, spam'e düşmez.
4. ✅ **Mobil push:** `pushOnNotification` canlıda (`notifications/{id}` yazılınca FCM data-only push). İlk deploy'da Eventarc izin yayılması için gecikti, 2. denemede geçti.

### Blogger NOT'U (önemli):
- `functions/index.js` içindeki **`publishToBlogger` + 4 `BLOGGER_*` defineSecret YORUM SATIRINA ALINDI** — çünkü modül yüklenirken secret değeri arayıp her deploy'da `BLOGGER_CLIENT_ID` soruyordu (kullanıcı Blogger kullanmıyor). Blogger ileride lazım olursa: bloğu yorumdan çıkar + `firebase functions:secrets:set BLOGGER_CLIENT_ID` (ve diğer 3'ü) tanımla.
- `firebase deploy --only functions` artık sorunsuz çalışır (Blogger devre dışı olduğu için secret sormaz).

## ⏳ KULLANICI TARAFI KALAN (opsiyonel)
1. **Giriş için mobil onay (2FA):** Firebase Console → Authentication → "SMS Multi-factor Authentication" **Identity Platform upgrade** ister (billing kararı — kullanıcı verecek).
2. Telefon girişi mevcut hesaba bağlanmak için **Ayarlar → Telefonumu Bağla** (yoksa ayrı boş hesap açar).
3. Runtime uyarısı: Node.js 20, 2026-10-30'da kullanımdan kalkacak; o tarihe kadar `functions/package.json`'da Node 22'ye + `firebase-functions@latest`'e yükseltmek iyi olur.

## ⚠️ Bir sonraki oturum için not
- Grup modu **read-only**; monthData geçici swap ile birleştirilir, sonra gerçek veri geri yüklenir (kayıt bozulmaz).
- Telefon girişi mevcut e-posta hesabına ULAŞMAK için önce **Ayarlar → Telefonumu Bağla** ile linklenmeli (yoksa ayrı boş hesap açar).

---

## 1) PROJE & ALTYAPI
- **Site:** https://mmgcreativity.com (GitHub Pages özel domain; ayrıca https://mmgcreativity.github.io)
- **Repo:** https://github.com/mmgcreativity/mmgcreativity.github.io (branch: `main`)
- **Çalışma klasörü (yerel):** `C:\Users\muham\OneDrive\0.mmgcreativity\web\html` (OneDrive senkron; bazı dosyalar "cloud-only" olabilir — düzenlemeden önce indirilir)
- **Firebase projesi:** `mmgcreativity-31263` (Blaze) — Firestore + Auth + Functions + FCM
- **Frontend:** düz HTML/JS, build YOK. Ortak parçalar: `mmg-chat-widget.js` (sohbet), `mmg-undo.js` (Geri Al/Ctrl+Z), `i18n-core.js` (TR/EN), `mmg-doviz-widget.js` (kur widget'ı), `mmg-feedback-widget.js` (beğeni).

## 2) DEPLOY AKIŞI (statik site)
Klasör yerelde **git deposu değil** → deploy GitHub web arayüzünden yapılır:
1. Dosyayı yerelde düzenle.
2. `service-worker.js` içindeki **`SW_VERSION`**'ı değiştir (ör. tarih+kısa etiket).
3. https://github.com/mmgcreativity/mmgcreativity.github.io/upload/main → değişen dosyaları seç (aynı adlılar overwrite eder).
4. **Commit changes** (Doğrudan `main`).
5. GitHub Pages ~30-60 sn'de derler; kullanıcı **Ctrl+Shift+R** ile tazeler.
- Not: GitHub yükleme arayüzü Türkçe locale'de dosya adlarını çevirir gibi gösterir (`service-worker.js` → "hizmet-çalışanı.js"); dosya adı BOZULMAZ.
- **Kayıtlı skill:** `mmg-site-deploy` — bu akışı ve "sırayla, sormadan çalış" tarzını içerir.

## 3) FIREBASE DEPLOY (KULLANICININ BİLGİSAYARINDAN — GitHub'a yüklemek YETMEZ)
Proje klasöründe (firebase.json'ın olduğu yer):
```
firebase deploy --only functions           # BEKLIYOR (aşağıdaki backend işleri buna bağlı)
firebase deploy --only firestore:rules     # gerekirse (misafir beğeni/kurallar)
firebase functions:log --only publishToBlogger   # blog hatasını görmek için
```
`functions/index.js` ve `firestore.rules` yerelde güncel; sadece bu komutlarla Firebase'e gider.

---

## 4) BU OTURUMDA (2026-07-29) CANLIYA ALINANLAR
**Yeni araçlar & sayfalar**
- `teminat-mektubu-komisyonu-hesaplama.html` — teminat tutarı/oran/süre → dönem komisyonu + BSMV + toplam.
- `cek-iskontosu-hesaplama.html` — nominal/oran/gün → iskonto faizi + BSMV + net.
- `finans-sozlugu.html` — ~56 terimlik aramalı finans/bankacılık sözlüğü.
- `aylik-taksitli-kredi-hesaplama.html` — **Rotatif tasarımına birebir çevrildi** (sağ döküm + Çoklu Kredi tablosu + Excel/PDF). Formül: aylık faiz × (1+KKDF %15+BSMV %15) → annüite. 7 banka örneğiyle kuruşuna doğrulandı. (Menüde adı "Taksitli Kredi Hesaplama".)
- `entegrasyon.html` — **Logo & Zirve entegrasyon kılavuzu** (araştırmaya dayalı: j-Platform REST/SOA, İşbaşı REST, Tiger LObjects/SQL, Zirve Express Aktarım/API). 3 seviye + adım adım + talep maili.
- Yeni araçlar `index.html` Hesaplamalar drawer'ı + `Hesaplama_Araclari.html` sekme/kartlarına (TR/EN) eklendi.

**Menü / index.html**
- Arama kutusu **menünün en üstünde** (Ana Sayfa'nın üstünde), autofill/kayıtlı-parola kapatıldı (`readonly` + `type=search`), dışarı-tıkla kapanış capture fazında.
- **Ana Sayfa** artık küçük kare ev ikonu, sağında arama.
- **Sosyal** ve **Veri Analizi** artık açılır menü (drawer). Bölüm başlıkları (ARAÇLAR/SOSYAL/VERİ ANALİZİ) kaldırıldı.
- **Işıldama sadece hover + basınca** (`.nav-item:hover, :active`); çekmece başlıkları ve ev ikonu **kalıcı parlamıyor** (`updateDrawerToggleActiveState` → sadece `remove('active')`).
- Alt menü başlıklarından "Hesaplama" kelimesi kaldırıldı (Rotatif Kredi, Ortalama Vade, Vade Sapması, Vadeli Mevduat Faizi, Taksitli Kredi).
- Firma bloğu kendi ince satırında (hesap rozetinin üstünde), footer'daki 2. imza kaldırıldı; hero imzası sağ altta, tanıtım+özellik satırları logonun sağ sütununa alındı.

**Kur widget'ı (`mmg-doviz-widget.js`)**
- Daha önce **hiçbir sayfaya bağlı değildi**. `<script src="mmg-doviz-widget.js" defer>` **9 araç sayfasına** eklendi (Gelirler, Giderler, Hesaplama_Araclari, Kredi_Karti_Vade_Farki, Nakit_Akis, Ortalama_Vade, Rotatif, Talimat_Hazirlama, aylik-taksitli). Hesap makinesinin (#mmgCalcBtn) soluna oturur.
- Pariteler **USD, EUR** (open.er-api.com) + **Gram Altın** (api.genelpara.com, graceful fallback). Gold kaynağı CORS'ta sorun çıkarırsa sadece USD/EUR görünür — **canlı doğrula**.

**Chat (`mmg-chat-widget.js`)**
- Sağ altta **"+" yeni sohbet butonu** (yalnız Kişilerim listesinde) → "Kişi Ekle" akışı (kiminle olacağını sorar).
- Bildirim gövdesinde artık **kod + ad** ("#1018 - AYŞEN…"); `mmgNotify` `fromName` kaydeder; bildirime tıklayınca `openChatFromNotif` ile ilgili 1:1 sohbet açılır (`pairChatId`).
- `labelForCode` her yerde **"#kod ad"** döndürür; avatar harfi `avatarLetterFromLabel` ile.

**Diğer sayfalar**
- `Talimat_Hazirlama.html`: alıcıda **"Grup içi" sola alındı ve varsayılan** yapıldı.
- `KullaniciYonetimi.html`: üye satırı **"#kod ad"** (kod önce, brass renkli).
- `manifest.json`: **`orientation:"any"`** (tablet yatay kilidi açıldı). Yüklü PWA'da etki için uygulamayı kaldır-yeniden ekle gerekir.
- Tablet: Nakit Akış/Gelirler/Giderler masthead başlık kelime-kelime kırılması düzeltildi (≤820px dikey istifleme).

## 5) BEKLEYEN İŞLER
**Frontend (bir sonraki oturumda — bazıları canlı veri/test ister):**
1. **Günlük Panorama (#9) — EN BÜYÜK.** Excel'deki panoramayı tasarıma uyarla: müşteri/firma çekleri, senetler, kredi kartları, kredi taksitleri, faturalar, teminat mektubu komisyonları → **bugün vadesi gelenler** bölüm bölüm. Giriş yapınca karşılasın + menüde yer. Veri, mevcut **Gelir/Gider** (Firestore: `{scopeCollection}/{scopeId}/cashflow` vb., alanlar `dueDate`, `category`, `vade`) modelinden beslenecek. **Giriş-sonrası canlı veriye erişip test gerektirir; kullanıcı giriş yapmışken yapılmalı.**
2. **Tablet kalanları (#18):** Gelir/Gider'de açılır menü altındaki büyük boş alan; Talimat önizleme + aksiyon butonlarının tablette dar sola sıkışması.
3. **Logo/Zirve — canlı (API) entegrasyon:** kılavuz + talep akışı hazır. Gerçek senkron için j-Platform REST konektörü (Cloud Function) veya yerel SQL agent + müşteri API bilgileri gerekir.

**Backend (Firebase — KULLANICI tarafında):**
4. **Blog gönderilemiyor (#12):** `publishToBlogger` "internal" veriyor. Muhtemel: `BLOGGER_CLIENT_ID/SECRET/REFRESH_TOKEN/BLOG_ID` secret'ları yok ya da fonksiyon deploy edilmemiş. `firebase functions:secrets:set ...` + `firebase deploy --only functions:publishToBlogger`; `firebase functions:log` çıktısı paylaşılırsa koddaki pay düzeltilir.
5. **Spam görünen mailler (#13):** şablon + SPF/DKIM/DMARC.
6. **Chat push (#15):** dürtme/mesaj/eklemelerde mobil FCM + web pop-up. `pushOnNotification` tetikleyici + `firebase deploy --only functions`.
7. **Misafir beğeni verisi (#17):** feedback yalnız giriş yapmış kullanıcıda (`mmgCloud.currentUser`) Firestore'a yazılıyor → reklamdan gelen misafirlerin beğenisi kaydolmuyor. Çözüm: misafir için **anonim auth** + `feedback` Firestore kuralları.

## 6) ÖNEMLİ TEKNİK NOTLAR
- **ES module JS doğrulaması:** `mmg-chat-widget.js` bir kez eksik `}` yüzünden tüm chat'i kırmıştı. Değişiklikten sonra `node --check mmg-chat-widget.js` çalıştır (bu oturumda hep yapıldı, temiz).
- **i18n:** `data-i18n` metinleri yükleme anında sözlükten gelir. Görünen metni değiştirirken **HTML + `MMGI18N.registerDict` sözlüğünü birlikte** güncelle, yoksa eski değere döner.
- **Nav drawer:** yeni açılır menü eklerken `<div class="nav-drawer-wrap"><button data-drawer-toggle …><div class="nav-drawer">…subitem(nav-subitem)…</div></div>` + `wireDrawerToggle('xToggle','xDrawer')` çağrısı şart.
- **Büyük dosyalar** (Rotatif, Talimat, Nakit ~200-450KB) Read yerine `grep -n`/`sed -n` ile hedefli okunmalı.
- **Firebase client config:** apiKey `AIzaSyCWzcRqmwhIBqjnYqyMoIrO8zj2p8oj5kU`, projectId `mmgcreativity-31263`, senderId `243143536600`.
- **Callable functions (us-central1):** `publishToBlogger`, `accountSwitchToken`, `accountLinkConfirm`, `accountUnlink`, `sendPasswordResetMail`, `pushOnNotification`, firma yetki fonksiyonları.

## 7) YENİLEDİKTEN SONRA HIZLI TEST
- [ ] Menü: Sosyal/Veri Analizi drawer açılıyor mu; ışıldama sadece hover/basınca mı; ev ikonu kalıcı parlamıyor mu
- [ ] Arama menü üstünde; kayıtlı parola açılmıyor; boşluğa tıkla kapanıyor
- [ ] Kur widget'ı araç sayfalarında hesap makinesi solunda; USD/EUR/Gram Altın geliyor mu
- [ ] Chat "+" ile yeni sohbet; bildirimde "#kod ad"; bildirime tıkla → sohbet açılıyor
- [ ] Taksitli Kredi: 100.000 / %3,29 / 12 ay → Aylık Taksit 10.827,17 TL
- [ ] Tablet yatay dönüyor mu; başlıklar kırılmıyor mu
- [ ] Entegrasyon sayfası + menü linki açılıyor mu
