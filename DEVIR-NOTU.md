# DEVİR NOTU — Dijital Finans Asistanı (mmgcreativity.com)

Son güncelleme: **2026-08-02 (11. oturum — `muham` bilgisayarı, 4 yeni modül + mobil menü düzeltmesi)** · Son deploy işareti: `service-worker.js → SW_VERSION = '2026-08-02-yeni-moduller'` (repo **527 commit**).

> 🚨 **EN KRİTİK KEŞİF (10. oturum): mmgcreativity.com FIREBASE'DEN DEĞİL, GITHUB PAGES'TEN YAYINLANIYOR.**
> Kaynak repo: **`mmgcreativity/mmgcreativity.github.io`** (`CNAME` → mmgcreativity.com). `firebase deploy --only hosting` YALNIZCA `mmgcreativity-31263.web.app` adresini günceller — **canlı siteye HİÇBİR etkisi yoktur**. 10. oturumda saatlerce "deploy ediyorum ama değişiklik gelmiyor" yaşandı; sebebi buydu.
> **Statik dosya (html/js/json) yayınlamanın TEK yolu: GitHub reposuna dosya yüklemek** (repo → Add file → Upload files → Commit). GitHub Pages derlemesi 1–3 dk sürer; `https://mmgcreativity.com/app-version.json` ile doğrula.
> Firebase yalnızca **Firestore kuralları** (`firebase deploy --only firestore:rules`), **indexler** ve **Cloud Functions** için gereklidir — bunlar hangi statik dosya sunulursa sunulsun canlıya gider.

> 📁 **KLASÖR ADI NOTU:** 9. oturum notunda yerel klasörün `web\site` olarak yeniden adlandırıldığı yazıyor; 10. oturumda `muham` makinesinde klasör hâlâ **`web\html`** olarak görüldü ve tüm çalışma orada yapıldı. İki makine arasında ad farkı varsa senkron öncesi teyit et.

> 📁 **KLASÖR ADI DEĞİŞTİ (2026-08-01):** Yerel çalışma klasörü artık `…\0.mmgcreativity\web\`**`site`** — eskiden `web\html` idi. Sebep: Cowork, `web\html\Scheduled` yolunu "korumalı konum" olarak kayıtlı tuttuğu için (klasör fiziksel olarak YOK, bayat kayıt) `html` ve tüm üst klasörleri bağlanamıyordu; junction ile atlatma da işe yaramadı (gerçek yolu çözüyor). Klasör `site` olarak yeniden adlandırılınca sorun bitti. OneDrive değişikliği diğer makineye de yansıtır → `C:\Users\muham\OneDrive\0.mmgcreativity\web\site`. Yayına etkisi YOK (deploy GitHub web arayüzünden dosya yükleyerek yapılıyor). Eski adı geri koyarsan bağlama sorunu geri gelir.

> ⚠️ **İKİ BİLGİSAYAR UYARISI (yeni):** Bu proje artık iki makineden yürütülüyor — `C:\Users\muham\...` ve `C:\Users\CihanFinans\...`. 7. oturumda, 6. oturumun (diğer makine) yazdığı devir notu ve `firestore.rules` değişikliği OneDrive üzerinden **oturumun ortasında** geldi. Devir notunu **ASLA baştan yazma, kendi bölümünü EKLE**; yoksa diğer makinenin notlarını silersin. Deploy öncesi `git`/GitHub commit listesine bakıp başka bir oturumun commit atıp atmadığını kontrol et.

## 🔴 YENİ OTURUMA HIZLI BAŞLANGIÇ (önce bunu oku)
0. **✅ PLAY CONSOLE VERİ GÜVENLİĞİ FORMU TAMAMLANDI (9. oturum, 2026-08-01)** — adım 4'teki 3 eksik alt form (Kullanıcı kimlikleri, Diğer bilgiler, Kullanıcı ödeme bilgileri) dolduruldu; Uygulama etkinliği + Cihaz veya diğer kimlikler için "Paylaşıldı" düzeltmesi yapıldı (AdSense/Analytics çelişkisi bitti); Reklam Kimliği (AD_ID), Finans ile ilgili özellikler, Oturum açma bilgileri, Gizlilik politikası URL'i zaten doğru doluydu, tek tek doğrulandı. Değişiklik **Yayınlama özeti'nden Google'a GÖNDERİLDİ** ("İncelenmekte olan değişiklikler" listesinde görünüyor). **Bu konuda YENİDEN İŞ YOK** — detay için aşağıdaki 9. oturum bölümüne bak. Google'ın incelemesi genelde 7 gün sürer.
1. **OneDrive senkron kontrolü ŞART** (`mmg-onedrive-sync-guard` skill). Deploy öncesi marker kontrolü: `service-worker.js → SW_VERSION` yukarıdaki değerle aynı olmalı. Yerel dosya farklıysa GÜNCEL KAYNAK = GitHub repo (`main`); yereldeki eski dosyayı repodan tazele, ASLA eski yerel dosyayı deploy etme.
   ⚠️ 7. oturumda bu tuzak GERÇEKTEN yaşandı: ilk okumada yerel dosyalar bayattı, birkaç saniye sonra senkron bitince değiştiler. Dosyayı okuduktan sonra bile bir kez daha doğrula.
2. **⛔ KULLANICI TARAFINDA BEKLEYEN — ÖNCELİKLİ:**
   - ✅ **GÜVENLİK — 10. OTURUMDA TAMAMEN KAPANDI.** Google OAuth client secret yenilendi (yeni sürüm Secret Manager'da v3, `publishToBlogger` yeniden deploy edildi, eski secret Cloud Console'da devre dışı bırakılıp silindi). **Resend API anahtarı** da yenilendi (`RESEND_API_KEY` v3, `sendPasswordResetMail` yeniden deploy edildi; kullanılmayan 3 eski key Resend panelinden silindi). ⚠️ Ayrıca `firebase-debug.log` dosyasının `functions:secrets:set` komutunun API gövdesini **base64 olarak logladığı** tespit edildi — dosya silindi. **Bir daha secret set ederken bu log dosyasının oluştuğunu unutma; hiçbir zip/commit'e dahil etme.**
   - **ÖDEME MODELİ:** Satış **yalnızca Google Play Billing** ile olacak; sitede web üzerinden satış YOK. Kullanıcı vergiden muaf gerçek kişi, firma değil — sözleşme metinlerinde ünvan/MERSİS kullanma.
   - **YASAL:** 3 sözleşme sayfası 8. oturumda OLUŞTURULDU (`mesafeli-satis-sozlesmesi.html`, `iptal-iade.html`, `kvkk.html`) — deploy edilince 404 biter. Kimlik bilgileri dolduruldu (Muhammed Mutlu Güler, Nilüfer/Bursa). **Kalan tek iş:** metinlerin bir hukukçuya okutulması — Play Store'da satış açılmadan önce.
   - `firebase deploy --only firestore:rules` (bekleyen davet listesi — 6. oturumdan kalan).
3. **Doğrulama bekleyenler (kod tamam, kullanıcı testi bekliyor):**
   - ✅ Ana sayfa / "← Ana Sayfa" gizleme: kullanıcı "ana sayfa ok" dedi (6. oturum).
   - ✅ Hesap geçişi (INTERNAL): ÇALIŞIYOR ("kullanıcı geçişi ok") — ama avatar/logo eski hesapta kalıyordu → 6. oturumda düzeltildi (aşağıda), kullanıcı yeni sürümle tekrar test etmeli.
   - ⏳ **Bekleyen davet listesi:** index YETMEDİ — kök neden `collectionGroup('firmas')` için kural yoktu; `firestore.rules`'a `{path=**}/firmas` read kuralı eklendi. **KULLANICI ÇALIŞTIRMALI: `firebase deploy --only firestore:rules`** — sonra davetler görünür.
   - IBAN akışı: "Tüm IBAN'ları Sil → yeni şablonla (Firma Kodu zorunlu) yeniden yükle" hâlâ uygulanmadı; sonuç doğrulanmalı.
3.5. **11. OTURUMDAN KALAN (2026-08-02):**
   - ⏳ **Yeni 4 modül kullanıcı testi bekliyor:** Tahsilat Makbuzu, Stok Takip, Risk Yönetimi, Portföy. Kod canlıda ve dumanı-testi geçti (Stok'ta ürün+hareket girip stok/maliyet doğrulandı, test verisi temizlendi), ama kullanıcı henüz gerçek veriyle denemedi.
   - 🚨 **KULLANICI ÇALIŞTIRMALI — TEK KOMUT: `firebase deploy --only firestore:rules`**
     `firestore.rules` 11. oturumda güncellendi ama kurallar GitHub'a yüklemekle canlıya geçmez, Firebase CLI şart. Bu tek komut şunların HEPSİNİ birden canlıya alır:
     1. **`companies` alt koleksiyonlarına yazma kuralı (YENİ, gerçek bir hata düzeltmesi).** index.html'deki "Firma Oluştur" akışı hâlâ `users/{uid}.companyId` yazıyor; o kullanıcı bilinçli bir "Veri Kaynağı" seçmediyse Gelirler/Giderler/Nakit Akış verisini `companies/{id}` altına yazmaya çalışıyordu — oysa buraya yazma kuralı HİÇ YOKTU, yazmalar **sessizce reddediliyordu**. Eklenen kural: `companies/{id}/{col}/{doc=**}` → firmanın **üyesi** olan herkes okur/yazar (`members` hariç, onun kendi sıkı kuralları duruyor). Veri taşıma/migrasyon GEREKMEZ, davranış değişmez.
     2. **Misafir blog okuma** (`blogPosts` → `status == 'published'` girişsiz okunabilir) — bu kural yalnızca OneDrive çakışma kopyasında kalmıştı, ana dosyaya birleştirildi.
     3. 6. oturumdan beri bekleyen `{path=**}/firmas` okuma kuralı (bekleyen davet listesi).
   - 🧹 **Yerel klasör temizliği (2026-08-02):** 4 OneDrive çakışma kopyası + 4 eski zip ana klasörden çıkarılıp **`_SILINECEK\`** klasörüne taşındı (silme izni onaylanamadığı için silinemediler). İçinde ne olduğunu anlatan `OKU-BENI.txt` var. **Kullanıcı bu klasörü komple silebilir.** ⚠️ Taşımadan önce `firestore-DESKTOP-V12JA3F.rules` ile `firestore.rules` DIFF'lendi: çakışma kopyası daha YENİ tarihliydi ve misafir-blog kuralını içeriyordu, ana dosyada ise admin `customerNumber` + `userDirectory` kuralları vardı. **İkisi de gerekliydi → birleştirildi**, sonra kopya silindi. Bundan sonra da çakışma kopyalarını körü körüne "eski" sayıp silme, önce diff al.
   - 💤 **Premium:** kullanıcı kararıyla Play Store yayınına kadar ERTELENDİ (aşağıdaki PREMIUM DURUMU bölümü).
   - ⏳ Spec bekleyen: her kayıtta admin'e bildirim.
4. **Muhtemel sıradaki istekler:** KUR/hesap-makinesi üst ikonlarının görsel stili (ışıldak) netleşmedi; Personeller sekmesine Excel toplu yükleme; Talimat'ta personel kullanımı.
5. Çalışma tarzı: `mmg-site-deploy` skill — sormadan, kuyruk bitene kadar; kapanışta HER ZAMAN (1) yayınlananlar (2) bekleyenler listesi ver ("bekleyen yok" deme hatası kullanıcıyı kızdırdı). **En kritik değişiklik: service worker NETWORK-FIRST** (4. oturum). Şifre sıfırlama maili TAM çalışır (Resend canlı).

## 🟢 2026-08-02 (11. OTURUM — 2. bölüm) — İŞLETME MODÜLLERİ ZİNCİRİ + RAPORLAR MENÜSÜ (commit 532)

**Sürüm:** `2026-08-02-isletme-raporlar`

### Mimari karar — TEK KAYNAK İLKESİ
Kullanıcı: *"müşteriler zaten veri girişinden yapılıyor… işletme yönetiminde sadece listeleri gelebilir"* ve *"risk yönetimi sadece rapor ekranı olacak, verileri diğer modüllerden çekecek."*

| Veri | TEK KAYNAK | Okuyanlar |
|---|---|---|
| Müşteri / tedarikçi + **risk limiti, tanınan vade, vergi no, telefon, not** | `VeriGirisPaneli.html` → `customers` koleksiyonu | Risk, Çek/Senet, Teminat |
| **Firmalarım** (YAŞAR CİHAN, ADERANS…) | `Banka_Yonetimi.html` → Tanımlar sekmesi (`mmgModules/firmalar`) | Çek/Senet, Teminat, Banka, Abonelik |
| Çek / senet / DBS | `Cek_Senet.html` | Risk, Banka (portföydeki çekler) |
| Teminat mektupları | `Teminat_Mektubu.html` | Risk (alınan → riski düşürür, verilen → banka riski) |
| Banka limit / risk / bakiye | `Banka_Yonetimi.html` | Risk (Banka Riski sekmesi) |

Ortak yardımcılar `mmg-store.js`'e eklendi: `MMGStore.cariler(kind)`, `cariDoldur()`, `firmalar()`, `firmaDoldur()`.
⚠️ Cari eşleştirme **ünvan metnine göre** (büyük/küçük harf duyarsız) yapılır. Veri Girişi'nde kayıtlı olmayan cariler raporda "Veri Girişi'nde kayıtlı değil" uyarısıyla yine gösterilir — **hiçbir tutar rapordan düşmez**.

### Yeni modüller
1. **`Cek_Senet.html`** — Portföy + **pivot rapor** (satır: tahsil tarihi / hafta / ay, sütun: firmalar, hücre: tutar; kullanıcının Excel'indeki tabloyla aynı). Tipler: müşteri çeki/senedi, DBS, kendi çekimiz/senedimiz. Durum: portföyde / teminatta / ciro / tahsil / karşılıksız. Yalnızca **açık** kıymetler takvime girer.
2. **`Teminat_Mektubu.html`** — Verilen + alınan + **iade süreçleri**. Excel'deki tüm sütunlar (banka, no, firma, mektup sınıfı, muhatap, konu, oran, taksit, kullanım tarihi, vade, tutar) + **firma bazlı ve genel toplam**. Vade **SÜRESİZ** olabilir. Yıllık tahmini komisyon = Tutar × Oran% × Taksit. ⚠️ Vadesi geçen mektup otomatik düşmez — banka fiilen iade almadıkça risk sürer.
3. **`Banka_Yonetimi.html`** — 4 sekme:
   - **Limit & Risk**: çek karşılığı ve kefalet için limit/risk/kalan; **konsolide veya firma bazında** görünüm; bir bankada firma ayrımı yoksa "çatı limit" işaretlenir. Açıklamalar tablosu ayrı.
   - **Bakiyeler**: banka × firma × **her döviz** (TL/USD/EUR/GBP); hücrelere doğrudan yazılır; "PORTFÖYDEKİ ÇEKLER" satırı Çek/Senet modülünden **otomatik**.
   - **İletişim**: şube + müdür / portföy yöneticisi / müşteri temsilcisi (ad-tel-mail). **Kısmi paylaşım**: istenen bankalar + istenen roller + istenen alanlar seçilip Kopyala / WhatsApp / E-posta / PDF.
   - **Tanımlar**: Firmalarım ve Bankalar (tüm modüllerin ortak listesi).
4. **`Abonelik_Faturalari.html`** — Elektrik/su/internet gibi düzenli faturalar; Excel'deki sütunlar (tür, tedarikçi, abone-firma, santral, sözleşme no, abone no, ödeme günü, banka, tutar). Ödeme takvimi + firma bazlı aylık yük. **"Giderler'e Aktar"** düğmesi kayıtları `mmg_odemeler_list`'e aylık tekrarlı olarak yazar → Nakit Akış Tablosu'na da düşer (mükerrer kayıt kontrolü var).

### `Risk_Yonetimi.html` YENİDEN YAZILDI — artık SALT RAPOR
Manuel müşteri kartı ve manuel risk kalemi girişi **kaldırıldı**. 4 sekme: Müşteri Riski · Yaşlandırma · Banka Riski · Risk Kalemleri (birleşik). Üstte "kaynak şeridi" her modülden kaç kayıt geldiğini gösterir ve modüle link verir.
Yeni hesap: **Net risk = açık risk − o cariden alınan teminat mektubu.** Skor bu net risk üzerinden hesaplanır.

### Menü
Yeni ana menü **Raporlar** (Risk Yönetimi, Çek/Senet Raporu, Banka Limit & Risk, İstatistikler). İşletme Yönetimi artık: Çek/Senet · Teminat Mektupları · Banka Yönetimi · Abonelik/Fatura · Stok Takip · Portföy. Ana sayfa kartları 26 → 30, bölüm sayısı 7.

### ⏳ BU BÖLÜMDEN KALAN
- Alış/satış **faturası** modülü yapılmadı — kullanıcı son mesajında faturayı *abonelik/düzenli gider* olarak tarifledi ("faturalar yine raporlara veriyi giderlerden çekecek"), o yüzden `Abonelik_Faturalari.html` yapıldı. Klasik cari hesap faturası (fatura no + vade + tahsilat eşleştirme) isteniyorsa AYRI modül gerekir; Risk'teki "açık hesap" kalemi şu an yalnızca çek/senetten besleniyor.
- Tahsilat Makbuzu henüz cari ile ilişkilendirilmedi (kendi cari alanı serbest metin).
- Modüllerin hiçbiri gerçek veriyle kullanıcı tarafından test edilmedi.

## 🟢 2026-08-02 (11. OTURUM — `muham` bilgisayarı) — 4 YENİ MODÜL + MOBİL MENÜ DÜZELTMESİ (commit 527)

**Yayınlanan sürüm:** `SW_VERSION = '2026-08-02-yeni-moduller'` (app-version.json ile aynı). Canlıda doğrulandı.

### Yeni ortak altyapı (3 dosya — bundan sonraki modüller bunları kullansın)
| Dosya | İş |
|---|---|
| `mmg-cloud-init.js` | `type="module"`. Firebase app/auth/db kurulumu + **veri kapsamı** (kişisel `users/{uid}` / firma `firmaAccounts/{id}`) tek yerden. `mmg-auth-ready` ve `mmg-scope-ready` olaylarını yayar. Gelirler/Giderler'deki ~90 satırlık kopyala-yapıştır bloğun yerini alır. |
| `mmg-store.js` | `MMGStore('ad')` → yerel-önce, bulut-sonra depo. Yerelden ANINDA okur, buluttan yalnızca `updatedAt` daha yeniyse tazeler. Bulut yolu: `{kapsam}/{id}/mmgModules/{ad}`. Ayrıca ortak yardımcılar: `uid/fmt/parse/today/trDate`. |
| `mmg-module.css` | Yeni modüllerin ortak görünümü (panel, tablo, KPI, rozet, sekme). Mevcut hesaplama sayfalarıyla aynı renk değişkenleri. |

⚠️ `mmg-cloud-init.js` içindeki `canWrite()`, kapsam **`companies`** ise buluta YAZMAZ. Sebep: `firestore.rules`, `companies/{id}` altında `members` dışında hiçbir alt koleksiyona yazma izni vermiyor. **Bu ESKİ sistemde gerçek bir hata:** `Gelirler.html` gibi sayfalar `companies/{id}/gelirler` yazmayı deniyor ve sessizce reddediliyor olabilir. Kullanıcı "veri kayboldu" derse ilk buraya bak.

### Yeni modüller (4 sayfa)
1. **`Tahsilat_Makbuzu.html`** — Seri–sıra numaralı makbuz. Nakit/Havale/Çek/Senet/DBS/Kredi Kartı/Mahsup. Çek-senet-DBS seçilince banka, çek no, vade, keşideci alanları açılır. **Tutar yazıyla** (Türkçe kurallarına uygun: "BİRBİN" değil "BİN"; kuruş `# … TL … KR #` biçiminde) — 11 senaryoda test edildi. Yazdır/PDF (yazdırma diyaloğu üzerinden, Türkçe karakter sorunu olmasın diye jsPDF metni kullanılmıyor), firma bilgisi hatırlanır, sıra no otomatik artar, mükerrer seri-sıra uyarısı verir.
2. **`Stok_Takip.html`** — Ürün kartı (kod/ad/birim/KDV/alış/satış/kritik/depo/barkod), Giriş–Çıkış–Sayım hareketleri, ürün ekstresi, Excel/PDF. **Maliyet yöntemi: hareketli ağırlıklı ortalama.** Girişte ortalama yeniden hesaplanır, çıkışta ortalama değişmez ve SMM birikir, sayımda stok girilen değere eşitlenir. Negatif stok uyarısı ve kritik seviye rozeti var. Node ile 4 senaryoda doğrulandı.
3. **`Risk_Yonetimi.html`** — Müşteri kartı (limit, tanınan vade), risk kalemleri (Açık Hesap/Çek/Senet/DBS/Teminat/Fatura), **alacak yaşlandırma** (vadesi gelmedi / 1-30 / 31-60 / 61-90 / 90+) ve **risk skoru**. Skor 0–100: limit kullanımı %40 + vadesi geçen oranı %35 + karşılıksız geçmişi %25, 90 günü aşan gecikmede +10. Limit tanımlanmamışsa nötr 20 puan verilir ve satırda "limitsiz" rozeti çıkar.
4. **`Portfoy.html`** — Hisse alış/satış/temettü elle girişi. **İki maliyet yöntemi seçilebilir: FIFO (varsayılan, vergi uygulamasında yaygın) ve ağırlıklı ortalama.** Komisyon alışta maliyete eklenir, satışta hasılattan düşülür. Açık pozisyonlarda güncel fiyat elle girilir (cihazda saklanır) → gerçekleşmemiş K/Z. **Kâr/Zarar Ekstresi** sekmesinde tarih aralığı + sembol filtresiyle gerçekleşen K/Z, temettü ve dönem getirisi. Node ile FIFO/ortalama/komisyon/aşırı-satış senaryolarında doğrulandı.

Menüde yeni ana başlık: **İşletme Yönetimi** (Stok Takip · Risk Yönetimi · Portföy). Tahsilat Makbuzu, **Talimatlar** menüsüne eklendi. TR+EN i18n anahtarları yazıldı.

### Mobil menü — kullanıcının şikâyeti çözüldü
Şikâyet: *"mobilde menüler karışık geliyor, ana menü alt menü bir arada, hatta bazı menüler hiç yok mesela vade sapma yok."*
**Kök neden:** Ana sayfadaki `#cardGrid` elle yazılmış **12 kartlık düz bir listeydi**; sol menüde 23 hedef vardı, yani **12 sayfanın hiç kartı yoktu** (Vade Sapma, Çek İskontosu, Teminat Mektubu, Kredi Karşılaştırma, Finans Sözlüğü…). Üstelik kategori kartı ("Hesaplama Araçları") ile tekil araçlar ("Gelirler") aynı düzlemdeydi — mobilde tek sütuna düşünce "karışık" görünüyordu.
**Çözüm:** Izgara, sol menüdeki kategorilerle **birebir aynı başlıklar** altında gruplandı (`.card-sec`) ve menüdeki her sayfaya kart açıldı → 12 kart **26 karta** çıktı.
⚠️ `sortCardGrid()` de yeniden yazıldı: eski hâli tüm kartları `grid.appendChild` ile sona taşıyordu, bu başlıkları tepede öbekleyip grupları dağıtırdı. Yeni hâli favorileri en üstte **"★ Favoriler"** bölümünde toplar, gerisini kendi kategorisinde bırakır; kullanıcının sonradan eklediği kısayollar en sonda **"Eklediklerim"** başlığı altına gider. Bölümdeki tüm kartlar gizliyse başlık da gizlenir (`.card-sec[hidden]`).

### Google Play rozeti
Yıldızlar tek `★★★★★` metni yerine 5 ayrı `<i>` oldu; `display:flex + width:100% + space-between` ile **"Google Play" yazısının tam genişliğine** yayılıyor (soldan ve sağdan birebir hizalı). Boyut 9px → 11px (12,5px'lik yazıyla orantılı).

### Bu oturumda ÖĞRENİLEN (tekrar etme)
- Chrome MCP ile test ederken `confirm()` diyaloğu **CDP'yi kilitler**; `left_click` 30 sn sonra timeout verir. Silme butonlarını test etmek gerekiyorsa önce `javascript_tool` ile `window.confirm = () => true` yap.
- Chrome MCP'de `left_click` **ref ile** bazen tetiklenmiyor; koordinatla tıklamak güvenilir.
- Canlı `app-version.json` bir önceki deploy'da güncellenmemişti (SW güncelken JSON bayattı). **Her deploy'a app-version.json'ı da dâhil et.**

## 🟢 2026-08-01 (10. OTURUM — `muham` bilgisayarı) — GÜVENLİK ROTASYONU + WIDGET/MENÜ İŞLERİ (10 commit, 472→494)

**⭐ EN KRİTİK — YAYIN YOLU YANLIŞ BİLİNİYORDU (yukarıdaki 🚨 kutusuna bak)**
Canlı site GitHub Pages'ten geliyor; `firebase deploy --only hosting` sadece `.web.app`'i güncelliyordu. Bu oturumun ilk yarısı bu yüzden boşa gitti. Bundan sonra statik dosyalar **GitHub reposuna yüklenerek** yayınlanacak.

**⚠️ 10. OTURUMDA YAPILAN HATA — TEKRARLANMASIN**
`mmg-onedrive-sync-guard` kuralı (bu notun 1. maddesi) **atlandı**: OneDrive senkron değilken HTML'lere yazıldı. Sonuç: (a) yerelde olmayan 3 sözleşme sayfası "yok" sanılıp yeniden yazıldı ve 8. oturumun gerçek sürümlerinin üzerine geçti (sonradan silindi), (b) OneDrive senkron gelince `index.html` / `service-worker.js` / `app-version.json` düzenlemeleri **sessizce ezildi** ve baştan uygulanmak zorunda kalındı. **HTML'e dokunmadan önce mutlaka `SW_VERSION` ile GitHub'daki değeri karşılaştır.**

**GÜVENLİK — secret rotasyonu tamamlandı**
- `BLOGGER_CLIENT_SECRET` yenilendi (Secret Manager v3), `publishToBlogger` yeniden deploy edildi, eski secret Cloud Console'da devre dışı bırakılıp silindi.
- `RESEND_API_KEY` yenilendi (v3), `sendPasswordResetMail` yeniden deploy edildi; kullanılmayan 3 eski Resend key'i silindi.
- **`firebase-debug.log` tuzağı bulundu:** `firebase functions:secrets:set` komutunun API gövdesini **base64 olarak loglar**. Dosya silindi; bir daha commit/zip'e dahil edilmemeli.

**Blog — misafir modunda okunabilir**
- `firestore.rules` → `blogPosts` okuma kuralı `request.auth != null` şartını **yayınlanmış** yazılar için kaldırdı: `status=='published'` olanlar girişsiz de okunabiliyor. `pending` yazılar hâlâ yalnız yazan kişi + admin. (Deploy edildi.)

**Oturum "askıda kalma" bug'ı çözüldü (`index.html` + `Blog.html`)**
- Sekme uzun süre açık/uykuda kalınca Firebase ID token'ı sessizce bayatlıyor; `users/{uid}` okuması **hata vermeden** eski/boş veri döndürüyor → `isAdmin`, kod, kullanıcı adı haksız yere kayboluyor, Blogger butonu gidiyordu. Çıkış-giriş token'ı tazelediği için "düzeliyor" sanılıyordu.
- Düzeltme: her `onAuthStateChanged`'de `user.getIdToken(true)` ile token zorla tazelenir + doküman `getDocFromServer` ile **önbellek yerine sunucudan** okunur (sunucuya ulaşılamazsa `getDoc`'a düşer).
- Ayrıca çıkışta bayat `mmg_auth_state` temizleniyor → girişsizken rozet "giriş yapılmış" göstermiyor (bilinçli `guest` modu korunuyor).

**Hesap geçişi TEK YÖNLÜ (güvenlik açığı kapatıldı)**
- `functions/index.js → accountSwitchToken` çağıranın admin olmasını **kontrol etmiyordu**: bağlı bir alt hesap, `switchOwnerUid` üzerinden admin hesabına dahil geçiş token'ı alabiliyordu. Artık `caller.isAdmin !== true` → `permission-denied`. (Deploy edildi, canlıda doğrulandı.)
- Arayüz: admin olmayan hesapla girildiğinde "Hesaplarım" listesi **hiç gösterilmiyor**.

**Nav 3. kademe tıklamayla açılıyor (`index.html`)**
- "Krediler" / "Vade Hesapları" başlıkları `data-target` taşımadığı için tıklama hiçbir şey yapmıyordu. Kök neden sanılandan farklıydı: bu başlıklar da `.nav-subitem` sınıfı taşıyor ve **"alt öge seçildi → flyout'u kapat"** handler'ı onlara da çalışıp menüyü anında kapatıyordu. Handler artık `.nav-subwrap` başlıklarını atlıyor; `.open` sınıfı masaüstünde de geçerli, chevron 90° dönüyor, hover davranışı korundu.

**Döviz (KUR) paneli**
- Panel 230→280px, satır yükseklikleri azaltıldı.
- "+ Parite" → **"+ EKLE"**; kör `prompt()` yerine tıklanabilir liste (10 yaygın kod + özel kod kutusu). Liste panel dışına taşıp kırpılıyordu → panelin İÇİNE, başlık ile alt çubuk arasına alındı.
- **Ons Altın** eklendi (döviz API'sinde yok; Gram Altın gibi altın kaynağından çekilir), **Avustralya Doları** çıkarıldı.

**Widget'lar (KUR + Hesap Makinesi + Chat) — konum, kapsam, aç/kapat**
- Hesap makinesi ortak dosyaya çıkarıldı: **`mmg-calc-widget.js`** (eskiden her araç sayfasının içine ayrı ayrı gömülüydü).
- Konum: `position:fixed` → **`absolute`**. Kullanıcı isteği: "ekranın değil SAYFANIN sağ üstünde dursun, kaydırınca gitsin". (Önce kabuğa/`index.html`'e taşındı, sonra bu istek üzerine geri alındı — kabukta yüklenmezler.)
- **Hesaplamalar altındaki 9 sayfanın hepsinde** var artık (5'inde hiç yoktu).
- **`mmg-widget-menu.js` (yeni):** boş alana sağ tık → "Widget'lar" menüsü → **Hepsi / Kurlar / Hesap Makinesi / Chat** ayrı ayrı aç-kapat, tercih `localStorage`'da kalıcı.
  - ⚠️ Gizleme **CSS ile** yapılıyor; çünkü bazı sayfalarda widget ortak dosyadan değil sayfanın kendi HTML'inden geliyor ve o kopya localStorage'a bakmıyor.
  - ⚡ **Yeniden yükleme YOK** — ilk sürüm `location.reload()` kullanıyordu; ~3 sn sürüyor ve ilk-açılış mantığı yüzünden **giriş/ana ekrana düşürüyordu**. Artık widget'lar her zaman oluşturulur, tek bir `<style>` etiketiyle gizlenir → tıklama anında etki eder, menü açık kalır. iframe/üst pencere `storage` olayıyla senkronlanır.
- Metin/form/link/buton üzerinde sağ tık **tarayıcının kendi menüsünü** bozmaz (kopyala-yapıştır korunur).

**Chat — "+ Grup Oluştur" kaldırıldı**
- Liste başındaki satır silindi; panelin sağ alt köşesindeki ortak **"+" (FAB)** Grup sekmesindeyken "Yeni grup oluştur" işlevi görüyor. Boş liste metni de buna göre güncellendi.

### 💳 PREMIUM DURUMU — SATIN ALMA ZİNCİRİ HENÜZ YOK (10. oturumda tespit edildi)

**KARAR (kullanıcı, 10. oturum): Önce uygulama Play Store'da yayınlansın; premium işlerine ONDAN SONRA bakılacak. Şimdilik bu başlıkta iş yapma.**

Yayın sonrası ele alınmak üzere durum tespiti:

**✅ Hazır olanlar**
- `users/{uid}.isPremium` alanı ve buna bağlı reklam gizleme / premium özellik açma mantığı `index.html`'de çalışıyor.
- `firestore.rules` `isPremium`'un kullanıcı tarafından değiştirilmesini engelliyor (doğru kurgu).
- `premium.html` arayüzü, aylık/yıllık plan gösterimi ve 3 sözleşme sayfası canlıda.
- Play Console **Veri güvenliği** formu gönderildi (9. oturum), Google incelemesinde.

**❌ Eksikler — premium satışı açılmadan ÖNCE yapılması şart**
1. **Google Play satın alma doğrulaması YOK.** `functions/index.js` içinde `androidpublisher` / `purchaseToken` / abonelik doğrulama kodu **sıfır**. Yani kullanıcı Play'den satın alsa bile `isPremium`'u `true` yapacak hiçbir mekanizma yok. Şu an `isPremium` yalnızca referans programındaki "ücretsiz premium" faydasıyla elle set ediliyor (`index.html` ~5202).
2. **`premium.html` → "Premium'a geç" satın alma BAŞLATMIYOR** — yalnızca Play Store ürün sayfasını açıyor (`startSubscription()`). Gerçek akış Android uygulamasında in-app purchase ile tetiklenmeli.
3. **Abonelik yaşam döngüsü YOK:** yenileme, iptal, süre dolumu, iade → `isPremium` bunlara göre güncellenmiyor. **Play RTDN (Real-Time Developer Notifications)** webhook'u kurulmamış.
4. **Fiyatlar netleşmedi** (kullanıcı "belli olunca yazarım" dedi) ve Play Console'da abonelik ürünü/product ID tanımlı mı bilinmiyor.
5. **Sözleşme metinleri hukukçu onayından geçmedi.**

**Yayın sonrası yapılacak sıra (öneri):** Play Console'da abonelik ürünü tanımla → Android tarafında in-app purchase akışını bağla → `verifyPlayPurchase` Cloud Function'ı yaz (purchaseToken → androidpublisher API → `isPremium=true`) → RTDN webhook'u ile yenileme/iptal/iade senkronu → fiyatları `premium.html` + sözleşme sayfalarına işle → hukukçu onayı.

### ⏳ 10. OTURUM SONU — BEKLEYENLER
**Spec bekleyen (kullanıcı bilgi verecek):**
- **Premium** — ⛔ **BEKLETİLİYOR.** Kullanıcı kararı: önce uygulama Play Store'da yayınlansın, premium işleri ondan sonra. Detaylı durum tespiti için yukarıdaki **💳 PREMIUM DURUMU** bölümüne bak (satın alma doğrulaması, RTDN, fiyatlar, hukukçu onayı).
- **Portföy modülü** (hisse adı / lot / alış fiyatı) — 7. oturumdan beri açık; fiyat kaynağı (canlı borsa mı elle giriş mi), yeri ve kâr/zarar isteği belirsiz.
- **Her kayıtta admin'e bildirim** — Auth `onCreate` tetikleyicili yeni fonksiyon gerekiyor (şu an yalnız referans kodlu kayıtlarda bildirim var).

**Yerelde temizlenecek (SİLİNMEDİ):** 4 adet `*-DESKTOP-V12JA3F*` OneDrive çakışma kopyası, 4 zip arşivi.

**Kullanıcı tarafında kapanan:** OAuth + Resend secret rotasyonu ✅ · eski secret/key'lerin silinmesi ✅ · IBAN akışı testi ✅ · mobil menü/firma çubuğu testi ✅ · 3 sözleşme sayfası canlıda ✅

## 🟢 2026-08-01 (9. OTURUM — `CihanFinans` bilgisayarı) — PLAY CONSOLE VERİ GÜVENLİĞİ TAMAMLANDI VE GÖNDERİLDİ

Bu oturumda **kod/deploy değişikliği YAPILMADI** — sadece Play Console'da Chrome eklentisiyle manuel form doldurma işi. Bağlam 8. oturumun devir notundan alındı.

**1) Adım 4'teki 3 eksik alt form dolduruldu (Kişisel bilgiler 6/6, Finansal bilgiler 3/3 oldu)**
- **Kullanıcı kimlikleri** (Firebase uid, #kod, `userDirectory`): Toplandı=Evet, Paylaşıldı=Hayır, kısa süreli değil, **zorunlu** (uid olmadan hesap çalışmaz), amaç: Uygulama işlevselliği + Hesap yönetimi.
- **Diğer bilgiler** (TC Kimlik No + VKN): Toplandı=Evet, Paylaşıldı=Hayır, kısa süreli değil, **isteğe bağlı**, amaç: Uygulama işlevselliği.
- **Kullanıcı ödeme bilgileri** (kayıtlı IBAN/banka hesapları): Toplandı=Evet, Paylaşıldı=Hayır, kısa süreli değil, **isteğe bağlı**, amaç: Uygulama işlevselliği.
- Üçü de tek tek "Kaydet" ile kaydedildi, durumları "Başlamadı" → "Tamamlandı" oldu.

**2) AdSense/Analytics paylaşım çelişkisi ÇÖZÜLDÜ**
- **Uygulama etkinliği → Uygulama işlemleri**: "Paylaşıldı" işaretlendi (önceden işaretsizdi); paylaşım amacı olarak **Analiz** seçildi (Google Analytics'e gidiyor).
- **Cihaz veya diğer kimlikler**: "Paylaşıldı" işaretlendi; paylaşım amacı olarak **Reklam veya pazarlama** seçildi (AdSense reklam kimliği kullanıyor).
- Önizleme ekranında "Paylaşılan veriler" bölümü artık bu iki veri türünü doğru gösteriyor; `gizlilik-politikasi.html` ve `kvkk.html` (8. oturumda güncellenmişti) ile form artık tutarlı.

**3) Kalan beyanlar kontrol edildi — hepsi zaten doğru doluydu, değişiklik gerekmedi**
- **Reklam Kimliği (AD_ID):** "Evet" reklam kimliği kullanıyor, amaçlar (Uygulama işlevselliği, Analiz, Geliştirici iletişimleri, Reklam veya pazarlama, Hesap yönetimi) işaretli, Android 13 manifest AD_ID izni uyarı kutusu onaylı.
- **Gizlilik politikası URL'i:** `https://mmgcreativity.com/gizlilik-politikasi.html` — doğru.
- **Finans ile ilgili özellikler:** "Uygulamamda finans ile ilgili özellik sağlanmıyor" işaretli — doğru (uygulama kişisel gelir-gider takip aracı, banka/kredi/ödeme hizmeti sağlamıyor).
- **Oturum açma bilgileri, Reklam, Hedef kitle ve içerik, Sağlık uygulamaları, İçerik derecelendirmeleri, Resmi kurum uygulamaları:** hepsi "Tamamlandı" durumunda, 19 Tem 2026'dan beri değişmemiş; bu oturumda içerik değiştirilmedi.

**4) Değişiklik Google'a GÖNDERİLDİ**
- Veri güvenliği formu Önizleme adımından "Kaydet" ile kaydedildi → Yayın özeti sayfasında "Veri Güvenliği anketi dolduruldu" değişikliği belirdi → **"1 değişikliği incelemeye gönder" ile Google'a gönderildi**, onay diyaloğunda "Değişikliği incelemeye gönder" tıklandı.
- Yayın özeti artık "İncelenmekte olan değişiklikler" durumunda gösteriyor. Google incelemesi genelde 7 gün sürer (uzayabilir).

**⚠️ Render/tıklama notu (sıradaki oturum için):** Console sayfaları arada `Page.captureScreenshot` CDP timeout veriyor — 3-5 sn bekleyip tekrar screenshot almak çözüyor. Bazı "İleri"/"Kaydet" butonlarında koordinat tıklaması scroll ofseti yüzünden kaçırıyor; `find` tool ile elementin `ref`'ini bulup tıklamak daha güvenilir.

### ⏳ 9. OTURUM SONU — BEKLEYENLER

**Kullanıcı tarafında (bu oturumun kapsamı dışında, unutulmasın diye tekrar not edildi):**
- **GÜVENLİK:** Google OAuth client secret sıfırlama (`Blogger Publish` → Reset secret → `firebase functions:secrets:set BLOGGER_CLIENT_SECRET` → `firebase deploy --only functions:publishToBlogger`) + **Resend API anahtarı yenileme** — hâlâ yapılmadı.
- **YASAL:** `mesafeli-satis-sozlesmesi.html`, `iptal-iade.html`, `kvkk.html` metinlerinin bir hukukçuya okutulması — Play Store'da satış açılmadan önce.
- `firebase deploy --only firestore:rules` — bekleyen davet listesi + hayalet dizin kaydı temizliği için (6.-7. oturumdan kalan, henüz çalıştırılmadı).

**Play Console tarafında:**
- Google'ın Veri güvenliği incelemesi sonucu beklenmeli (7 gün ± ). Red gelirse en olası sebepler zaten `PLAY-DATA-SAFETY.md`'de sıralanmıştı (hesap silme URL'i zaten düzeltilmişti — 8. oturum).
- 14 test kullanıcısı ~3 Ağustos'ta 14 günü dolduracak → "Üretime başvur" butonu o zaman açılacak (7. oturumdan kalan bilgi).

## 🟢 2026-08-01 (8. OTURUM — `CihanFinans` bilgisayarı) — ORTAM DÜZELTMESİ

- **Cowork klasörü bağlanamıyordu.** Hata: `web\html` "korumalı konum (`web\html\Scheduled`) ile çakışıyor". Teşhis: `dir /a` ile bakıldı, **`Scheduled` klasörü fiziksel olarak YOK**; aktif zamanlanmış görev de yok → Cowork tarafında bayat kayıt. `0.mmgcreativity` ve `web` gibi üst klasörler de aynı sebeple reddediliyordu.
- **Denenip işe YARAMAYANLAR:** junction (`mklink /J C:\mmgweb …` ve Masaüstü altına junction) — Cowork gerçek yolu çözüp yine engelliyor; Claude uygulamasını kapat-aç — kayıt kalıcı.
- **ÇÖZÜM:** klasör `web\html` → `web\site` olarak yeniden adlandırıldı, bağlantı sorunsuz kuruldu. Junction'lar temizlendi.

### Aynı oturumda yapılan işler — SW `2026-08-01-tek-playstore-rozeti`

**Play Store rozeti tekilleştirildi (`index.html`)**
- Kullanıcı: "bu ikisi aynı yeri açıyor, soldaki kalsın". Ayrı **"Bizi Oylayın"** rozeti KALDIRILDI (7. oturumda eklenmişti; `showAllReviews=true` parametresi Play Store'da artık ayrı bir ekran açmıyor, aynı ürün sayfasına düşüyordu).
- Kalan tek rozet: Play ikonu + `İndirin ve Oylayın` / **Google Play** + sonda sarı **yıldız** SVG'si. i18n: `footer_download_now` tr `'İndirin ve Oylayın'`, en `'Download & Rate Us'`. `footer_rate_us*` anahtarları sözlükte DURUYOR (başka sayfada kullanılıyor olabilir diye silinmedi).

**3 sözleşme sayfası oluşturuldu (canlıdaki 404'ler için)**
- `mesafeli-satis-sozlesmesi.html`, `iptal-iade.html`, `kvkk.html` — `gizlilik-politikasi.html` ile birebir aynı koyu tema/CSS, `premium.html` footer'ındaki dosya adlarıyla birebir eşleşiyor.
- İçerik premium.html'den alınan GERÇEK verilerle yazıldı: 999₺/ay, 799₺/ay (yıllık 9.588₺), 4 premium özelliği, `mmgcreativity@gmail.com`.
- ⛔ **KULLANICI DOLDURMALI:** mesafeli satış ve KVKK sayfalarında satıcı/veri sorumlusu kimliği kırmızı-kesikli `[Ticari ünvan]`, `[Açık adres]`, `[Vergi dairesi/no]`, `[MERSİS no]`, `[Telefon]` kutuları olarak bırakıldı (uydurulmadı). Ödeme akışı açılmadan önce bunlar doldurulmalı ve metinler bir hukukçuya okutulmalı.
- İptal/iade sayfasındaki süreler (14 gün iyi niyet iadesi, yenileme sonrası 7 gün, 7 iş günü sonuçlandırma, 2–10 iş günü banka süresi) **öneri niteliğinde**; kullanıcı kendi politikasına göre değiştirebilir.
- 3 sayfaya da `<meta name="robots" content="noindex">` konuldu (taslak alanlar dolana kadar aramada çıkmasın).

**Yerel klasör temizliği (SİLİNMEDİ, taşındı)**
- `site\_ARSIV\` klasörü açıldı; şunlar oraya TAŞINDI (32 dosya): 14 adet `*-DESKTOP-V12JA3F*` OneDrive çakışma kopyası, 12 adet `.fuse_hidden*`, `._ck_1`, `err.txt`, 4 zip (`chat-guncelleme`, `degisiklikler-2026-07-28-11/12/13`).
- `.firebaserc`, `.firebase/`, `functions/` ve tüm canlı dosyalar DOKUNULMADI. `_ARSIV` GitHub'a yüklenmemeli.
- Hâlâ duran: `zibD1tAO` (94 KB, uzantısız — ne olduğu belirsiz, dokunulmadı).

### ⭐ ÖDEME MODELİ — SATIŞ SADECE GOOGLE PLAY — SW `2026-08-01-playstore-satis`

- **Kullanıcı bilgisi (kritik):** Web üzerinden satış OLMAYACAK. Premium yalnızca **Google Play Billing** ile satılacak. Kullanıcı **firma değil, vergiden muaf gerçek kişi** — ünvan/MERSİS/VKN yok.
- **Sitedeki eski ödeme sağlayıcısı referansları kaldırıldı:**
  - `index.html` hoş geldin ekranı "Abonelik ve Ödeme Güvencesi" kutusu → Google Play Billing.
  - `index.html` KVKK özet bloğunda ödeme işlemleri artık "Google Play Billing" olarak geçiyor.
  - `premium.html` `trust_note` (tr+en) → "Abonelik Google Play üzerinden satın alınır".
  - `premium.html` `startSubscription()` → eski ödeme sağlayıcısı/Cloudflare Worker TODO'su silindi; artık Play Store ürün sayfasını açıyor. **Android tarafında bu buton in-app satın alma akışını tetikleyecek — henüz bağlanmadı.**
  - `premium.html` footer link etiketi `legal1` → "Satış ve ödeme koşulları" (tr) / "Sales & payment terms" (en).
- **`mesafeli-satis-sozlesmesi.html` BAŞTAN YAZILDI** (dosya adı korundu, premium.html linki kırılmasın): artık "Satış ve Ödeme Koşulları". Ana mesaj: **bu sitede satış yapılmaz**, satıcı ve tahsilat Google; kart bilgisi hiçbir aşamada bize gelmez. Google Play Hizmet Şartları'na link verildi. Uygulamanın yatırım/vergi danışmanlığı OLMADIĞI da eklendi.
- **`iptal-iade.html` BAŞTAN YAZILDI:** Google Play iptal adımları (Play → Ödemeler ve abonelikler → Abonelikler), **ilk 48 saat Google'dan doğrudan iade / sonrasında geliştiriciye başvuru** ayrımı, GPA. ile başlayan sipariş no ile e-posta başvurusu, geliştirici olarak iade başlatacağımız 4 durum, Google tarafında 3–5 iş günü işlem süresi.
- **`kvkk.html` güncellendi:** veri sorumlusu artık `[Ad Soyad]` — MMG Creativity (vergiden muaf gerçek kişi) + `[İletişim adresi]`; aktarım maddesi → Google Play Billing; "fatura/mali kayıt 10 yıl" maddesi kaldırıldı (fatura Google'da) → "abonelik durumu + sipariş kimliği, abonelik bitiminden 1 yıl sonra silinir".
- ✅ **KİMLİK BİLGİLERİ DOLDURULDU** (SW `2026-08-01-sozlesme-kimlik-dolduruldu`): `mesafeli-satis-sozlesmesi.html` + `kvkk.html` → **Muhammed Mutlu Güler — MMG Creativity**, adres **Alaaddinbey Mah. 244. İsimsiz Sok. No: 6/1, Nilüfer / BURSA**. Placeholder kalmadı; 3 sayfadan `<meta name="robots" content="noindex">` kaldırıldı (artık aramada çıkabilirler). `.fill` CSS kuralı kullanılmıyor ama zararsız, duruyor.
- ⚠️ Bu adres canlı sitede **herkese açık** olacak (KVKK başvurusu için yazılı adres zorunlu). Ev adresiyse ve gizlemek istersen alternatif bir tebligat adresi ya da yalnız il/ilçe + e-posta yazılabilir — hukuki risk kullanıcının değerlendirmesinde.
- ⚠️ Metinler **hukukçuya okutulmadı**; Play Store'da satış açılmadan önce gözden geçirilmeli.

### PLAY STORE HAZIRLIĞI — SW `2026-08-01-hesap-silme-datasafety`

**İade koşulları GEVŞETİLDİ (kullanıcı: "Google müsaade ettiği kadar gevşet")**
- İlk sürümde web satışı varsayılarak yazılan taahhütler (14 gün iyi niyet iadesi, orantılı iade, 7 gün yenileme iadesi, "7 iş günü içinde sonuçlandırılır", "3–5 iş günü") **KALDIRILDI**. Bunları Google istemiyor; satıcı Google olduğu için tüketici mevzuatı yükü de büyük ölçüde onda.
- Yeni metin: Google'ın 48 saatlik penceresi anlatılıyor, **sonrası "geliştiricinin takdirinde"**, iade garantisi verilmiyor, iade YAPILMAYAN 4 durum sayılıyor, sonda "yasal haklarınız saklıdır". Daha fazla gevşetmek tüketici mevzuatı açısından riskli olur.

**`hesap-silme.html` OLUŞTURULDU — Play için ZORUNLU**
- Google, giriş gerektirmeyen **public bir "Account deletion URL"** istiyor. `Hesabim.html`'deki uygulama içi silme giriş istediği için yetmiyordu. Bu tek başına red sebebidir.
- Sayfa: uygulama içi silme adımları + e-posta ile talep, hangi verilerin silindiği/1 yıl daha tutulduğu, grup firması verisinin yöneticide kaldığı uyarısı, aboneliğin ayrıca iptal edilmesi gerektiği.
- **Play Console → Data safety → Account deletion URL alanına `https://mmgcreativity.com/hesap-silme.html` girilmeli.**

**`PLAY-DATA-SAFETY.md` OLUŞTURULDU** (sitede yayınlanmaz, form doldurma kılavuzu)
- Kod taramasıyla çıkarılan tam eşleştirme: hangi Data Safety kategorisinde ne beyan edilecek, kaynağı hangi koleksiyon/alan.
- Öne çıkanlar: **Personal info** (ad, e-posta, uid, telefon, adres, **TC Kimlik No + VKN**), **Financial info** (IBAN → "User payment info"; gelir-gider → "Other financial info"; abonelik → "Purchase history"), **Messages** (sohbet+forum), **Photos** (avatar/logo/kaşe base64), **App activity** (Analytics'e paylaşılıyor), **Device or other IDs** (FCM jetonu + AdSense reklam kimliği → paylaşılıyor).
- Toplanmayanlar netleştirildi: konum, sağlık, ses, rehber, dosya (Excel tarayıcıda parse ediliyor, dosya sunucuya gitmiyor).
- Red riski sıralaması: (1) account deletion URL, (2) AD_ID izni TWA manifest'inde bildirilmemiş olması, (3) form↔politika uyuşmazlığı, (4) IBAN'ın finansal veri olarak beyan edilmemesi, (5) TCKN'nin hassas veri muamelesi.

**Gizlilik metinleri Data Safety ile hizalandı**
- `gizlilik-politikasi.html` → "1. Topladığımız Bilgiler" listesi genişletildi: IBAN/banka hesabı, TC Kimlik No/VKN, logo-kaşe-avatar, uygulama içi mesajlar, FCM jetonu, Analytics + reklam kimliği, Play abonelik verisi + "reklam amacıyla kullanılmaz/satılmaz" taahhüdü.
- `kvkk.html` → aktarım listesine **Google Analytics** ve **Google AdSense** eklendi (premium'da reklam betiği hiç yüklenmiyor notuyla); "Kullanım ve reklam verileri" maddesi FCM jetonu + reklam kimliğini kapsayacak şekilde güncellendi; haklar bölümünden `hesap-silme.html`'e link verildi.
- ⚠️ Beyan ile metin arasındaki uyuşmazlık reddin 1 numaralı sebebi — ileride SDK/reklam ağı eklenirse ÜÇÜ birden güncellenmeli (`gizlilik-politikasi.html`, `kvkk.html`, Play formu).

**Deploy edilecek dosyalar:** `index.html`, `premium.html`, `service-worker.js`, `app-version.json`, `mesafeli-satis-sozlesmesi.html`, `iptal-iade.html`, `kvkk.html`, `gizlilik-politikasi.html`, `hesap-silme.html`, `DEVIR-NOTU.md`
**Yüklenmeyecek:** `PLAY-DATA-SAFETY.md` (iç belge), `_ARSIV/`

### ✅ DEPLOY EDİLDİ + PLAY CONSOLE'A GİRİLDİ (2026-08-01, Chrome eklentisiyle)

- 10 dosya GitHub'a yüklendi (2 commit; ikincisi: gizlilik politikası tarihi 1 Ağustos'a çekildi, premium footer'daki `&amp;` düzeltildi). Canlı doğrulandı: 5 sayfa da açılıyor.
- **Chrome eklentisi notu:** eklenti **cihangrupfinans@gmail.com** ile giriş yapılmalı (Cowork oturumuyla aynı hesap), yoksa tarayıcı bağlı görünmez. Play Console ise **mmgcreativity@gmail.com** hesabında → Chrome'da ikinci Google hesabı eklendi, Console `/u/1/` altında.
- **Play Console yolu (bulması zor):** İzleyin ve geliştirin → **Politika ve programlar → Uygulama içeriği**. `/app-content` doğrudan URL'i çalışmıyor, app-list'e atıyor.
- App ID: `4973910964601792158` · Dev ID: `5592612192845288272`
- Uygulama içeriğinde **10 beyan zaten tamamlanmış**, "Tamamlanması gerekenler" listesi boş.

**⭐ DÜZELTİLEN KRİTİK HATA — Veri güvenliği formu**
- **Hesap silme URL'si** ve **Veri silme URL'si** alanlarının İKİSİ de `gizlilik-politikasi.html`'i gösteriyordu. O sayfada silme adımları yok → Google'ın şartını karşılamıyor, tek başına red sebebi.
- İkisi de `https://mmgcreativity.com/hesap-silme.html` yapıldı ve **KAYDEDİLDİ**.
- ⏳ Değişiklik kaydedildi ama **Yayınlama özeti'nden Google'a GÖNDERİLMEDİ**. Adım 4'teki 3 alt form bitince gönderilmeli (gönderim sırası: alt formlar → Paylaşıldı düzeltmesi → Kaydet → Yayınlama özeti → incelemeye gönder).

**✅ VERİ TÜRLERİ (adım 3) TAMAMLANDI ve DÜZELTİLDİ**
- 🔧 **Render sorunu ÇÖZÜLDÜ:** `resize_window` ile pencere **1600×1000** yapılınca yatay kayma bitti, onay kutuları net okunuyor. **Console'da çalışmaya başlamadan önce İLK İŞ bu olmalı.** (Resize sonrası ilk `screenshot` bir kez CDP timeout verebilir; 5 sn bekleyip tekrar dene.)
- ℹ️ Kategori başlığındaki ifade **"N/M veri türü seçildi"** biçiminde (seçili/toplam). Kayma varken sadece "M veri türü seçildi" görünüp yanıltıyordu.
- **Düzeltilen iki eksik beyan:**
  - **Kişisel bilgiler 4/9 → 6/9:** eksik olan **Kullanıcı kimlikleri** (Firebase uid, #kod, `userDirectory`) ve **Diğer bilgiler** (TC Kimlik No + VKN) işaretlendi.
  - **Finansal bilgiler 2/4 → 3/4:** eksik olan **Kullanıcı ödeme bilgileri** (kullanıcının kaydettiği IBAN / banka hesapları) işaretlendi. Kredi puanı boş kaldı (doğru).
- **Doğru olduğu teyit edilenler (dokunulmadı):** Konum 0/2, Sağlık ve fitness 0/2, Ses dosyaları 0/3, Takvim 0/1, Kişiler 0/1, Web'e göz atma 0/1 — hepsi boş ✓. Mesajlar 2/3, Fotoğraflar ve videolar 1/2, Dosyalar ve dokümanlar 1/1, Uygulama etkinliği 2/5, Uygulama bilgileri ve performansı 2/3, **Cihaz veya diğer kimlikler 1/1** ✓.
- Değişiklikler **"Taslağı kaydet" ile KAYDEDİLDİ** ("Değişiklikleriniz kaydedildi" doğrulandı). Form henüz gönderilebilir durumda DEĞİL (aşağıya bak).

**⛔ SIRADAKİ OTURUMUN İLK İŞİ — adım 4'te 3 alt form "Başlamadı"**
Yeni işaretlenen 3 veri türü, **4. adım (Veri kullanımı ve işleme)** ekranında `Başlamadı` durumunda. Bunlar doldurulmadan form GÖNDERİLEMEZ:
1. Kişisel bilgiler → **Kullanıcı kimlikleri** → `Başlat`
2. Kişisel bilgiler → **Diğer bilgiler** → `Başlat`
3. Finansal bilgiler → **Kullanıcı ödeme bilgileri** → `Başlat`

Üçü için de doğru cevaplar: **"Toplandı" EVET · "Paylaşıldı" HAYIR** (bu veriler AdSense/Analytics'e gitmiyor, yalnız Firebase'de duruyor) · zorunlu/isteğe bağlı: uid zorunlu, TCKN/VKN ve IBAN isteğe bağlı · amaç: "Uygulama işlevselliği" (+ hesap yönetimi).

**⚠️ HÂLÂ ÇÖZÜLMEDİ — AdSense/Analytics paylaşım çelişkisi**
- Önizlemede **"Üçüncü taraflarla veri paylaşımı yok"** yazıyor. Ama **AdSense** (`ca-pub-7339763610555735`) ve **Google Analytics** (`G-WVWJ4VZE0C`, `G-X8HEZRNWWS`) reklam kimliği + etkileşim verisini üçüncü tarafa gönderiyor. Google APK'yı otomatik tarıyor → bu çelişki red sebebi.
- Düzeltme: 4. adımda **Uygulama etkinliği → Uygulama etkileşimleri** ve **Cihaz veya diğer kimlikler** için "Paylaşıldı" işaretlenmeli. `gizlilik-politikasi.html` ve `kvkk.html` bu paylaşımı zaten yazıyor (8. oturumda eklendi), yani metin tarafı hazır — eksik olan yalnız form.

**⏳ Play Console'da HENÜZ BAKILMAYAN beyanlar:** Gizlilik politikası URL'i, Reklam, Hedef kitle ve içerik, Finans ile ilgili özellikler, Reklam Kimliği (AD_ID izni), Oturum açma bilgileri.

### ⭐ MÜKERRER MÜŞTERİ KODU YARIŞI ÇÖZÜLDÜ — SW `2026-08-01-mukerrer-kod-yarisi-fix`

- **Şikâyet:** "Murat Doğan diye kullanıcı açtık, adamda **1027** görünüyor, panelde **1028**."
- **Kök neden (yarış durumu):** `createUserWithEmailAndPassword` çağrılır çağrılmaz `onAuthStateChanged` tetikleniyor. O anda kayıt akışı `users/{uid}` dokümanını HENÜZ yazmamış oluyor → oradaki backfill (`if(!data.customerNumber)`) dokümanı boş görüp **`getNextCustomerNumber()` ile İKİNCİ bir numara** üretiyor ve yazıyor. Kayıt akışı da kendi ürettiği numarayı `localStorage`'a + rozete yazıyor. Sonuç: sayaçtan **iki numara** yanıyor, `userDirectory`'de aynı uid için **iki kayıt** oluşuyor, kullanıcının ekranı ile panel farklı kod gösteriyor.
- **Aynı hata ikinci bir yerde daha vardı:** `mmgEnsureCustomerNumber()` (geç açılan sekme/backfill yolu) — orada da doküman yoksa numara üretiliyordu.
- **Düzeltme (`index.html`, 3 nokta):**
  1. `onAuthStateChanged` backfill'i artık `if(!data.customerNumber && snap.exists() && !window.mmgSignupInProgress)` — **doküman HİÇ YOKSA numara üretmez** (o bir yeni kayıttır, kodu kayıt akışı yazacak). Backfill yalnızca "doküman var ama alan yok" olan GERÇEK eski hesaplarda çalışır.
  2. `mmgEnsureCustomerNumber()` aynı korumayı aldı (`docExists` değişkeni eklendi); üretmediyse `mmgCustomerNoBackfillTried` geri açılıyor ki kayıt bitince tekrar denensin.
  3. `window.mmgSignupInProgress` bayrağı: `createUserWithEmailAndPassword`'dan hemen ÖNCE `true`, `users/{uid}` yazıldıktan sonra `false`. Kayıt yarıda kesilirse asılı kalmasın diye **15 sn'lik `setTimeout` güvenlik ağı** var.
- ⚠️ **Geriye dönük veri:** Murat Doğan'ın `users/{uid}.customerNumber` alanı **1028** (panelin gösterdiği doğru değer). Cihazındaki 1027 bayat `localStorage.mmg_customer_no` değeri — **çıkış yapıp tekrar girince 1028'e döner**. `userDirectory/1027` artık kaydı duruyor (kurallar delete'e izin vermiyor); kod çözümü "en yüksek sayısal kod"u seçtiği için zarar vermiyor. Sayaçtan 1 numara boşa yandı, kozmetik.
- 🔎 Aynı belirtiyi gösteren eski kayıtlar varsa (`userDirectory`'de aynı uid'ye ait iki doküman) hepsi bu yarıştan kaynaklanıyor; artık yenisi oluşmayacak.

**🧹 HAYALET DİZİN KAYITLARI TEMİZLENİYOR — SW `2026-08-01-hayalet-dizin-temizligi`**
- Kullanıcı: "hayalet kayıt istemiyorum". Yarış düzeltildi ama ESKİ artıklar (ör. `userDirectory/1027` → Murat'ın uid'i) duruyordu. Riski: KullanıcıYönetimi davet akışındaki **"🔍 Sorgula"** `userDirectory/{kod}` okuduğu için #1027 sorgulanınca Murat çıkıyor, yanlış kodla doğru kişiye davet gidebiliyordu.
- **`firestore.rules`** → `userDirectory/{code}` match'ine **`allow delete: if request.auth != null && resource.data.uid == request.auth.uid;`** eklendi. Silmede `request.resource` null olduğu için mevcut `write` kuralı delete'i engelliyordu; artık kullanıcı YALNIZCA kendi uid'ine ait dizin kaydını silebilir. ⏳ **KULLANICI ÇALIŞTIRMALI: `firebase deploy --only firestore:rules`** (bekleyen diğer rules değişikliğiyle aynı komutta gider).
- **`index.html`** → yeni `mmgCleanupGhostDirectoryEntries(uid, customerNumber)`; `syncUserDirectory`'nin sonunda çağrılıyor. `where('uid','==',uid)` ile kendi dizin kayıtlarını sorgular, **geçerli kod dışındaki** her kaydı siler. Oturum başına bir kez çalışır (`mmgGhostCleanupDone`), tamamen sessizdir, hata alırsa hiçbir akışı bozmaz.
- ⚠️ **Sıra önemli:** rules deploy edilmeden temizlik çalışmaz (delete izni yok, sessizce geçer). Rules canlıya alındıktan sonra her kullanıcı bir kez giriş yaptığında kendi artıkları otomatik silinir. Murat için: rules deploy → Murat giriş yapsın → `userDirectory/1027` silinir.
- ℹ️ Sayaçtaki 1027 boşluğu kapanmaz (sayaç yalnız ileri gider) — ama artık o kod hiçbir kayda çözülmez, gerçekten boşta kalır. **Boştaki kodu birine atamak için aşağıdaki "Kod değiştir" panelini kullan.**
- ✅ Kullanıcı `firebase deploy --only firestore:rules` çalıştırdı, "Deploy complete!" — hayalet temizliği artık aktif.

**🔧 KULLANICI YÖNETİM PANELİNE "KOD DEĞİŞTİR" EKLENDİ — SW `2026-08-01-kod-degistir-paneli`**
- Kullanıcı: boştaki kodu (ör. 1027) birine atamak için Firebase Console'a girmek zorunda kalmasın diye.
- **Yer:** KullanıcıYönetimi → "🛡️ Tüm Kullanıcılar" tablosunda bir satıra tıkla → açılan **detay modalının altında** "Müşteri kodunu değiştir" alanı (kutu + Kaydet). Yalnız site yöneticisi görür, çünkü o tablo zaten site-admin'e özel.
- **Akış (`kyWireCodeChange`, sıra önemli):** (1) yeni kod boşta mı — `userDirectory/{yeniKod}` başka uid'e aitse ve yüklü kullanıcı listesinde çakışma varsa DURUR; (2) onay sorar; (3) `users/{uid}.customerNumber` (Number olarak) yazar; (4) `userDirectory/{yeniKod}` yazar; (5) eski `userDirectory/{eskiKod}` kaydını — hâlâ o uid'e aitse — siler; (6) listeyi tazeler.
- 3. adım geçip 4. adım patlarsa kullanıcı kodsuz KALMAZ; dizin kaydı eksik kalır ve kullanıcı bir kez giriş yapınca `syncUserDirectory` kendisi yazar.
- **`firestore.rules` iki yerde genişletildi (dar kapsamlı):**
  - `match /users/{userId}` için **ayrı ve dar bir `allow update`**: site yöneticisi, `diff().affectedKeys().hasOnly(['customerNumber'])` şartıyla YALNIZCA bu alanı değiştirebilir. `isAdmin`, `isPremium`, e-posta vb. bu kuralla değiştirilemez. (Mevcut `users/{userId}/{document=**}` write kuralı aynen duruyor.)
  - `userDirectory/{code}` write + delete: site yöneticisi başkasının kaydını da yazabilir/silebilir.
- ⏳ **Bu rules değişikliği için `firebase deploy --only firestore:rules` TEKRAR çalıştırılmalı** (bir öncekinde bu iki kural henüz yoktu). Çalıştırılmazsa panel "Kaydedilemedi: permission-denied" der.
- ⚠️ Sayaç (`meta/counters.userCount`) BİLEREK ellenmiyor — geri çekmek mevcut kodlarla çakışma yaratır. Panel yalnızca mevcut/boştaki bir kodu atar.

### 🔍 8. OTURUM KAPANIŞ DENETİMİ (kullanıcı isteği: "eksik kalanları tara")

**Denetimde BULUNAN ve DÜZELTİLEN eksik — SW `2026-08-01-footer-yasal-linkler`**
- ⚠️ `kvkk.html` ve `hesap-silme.html` **yalnızca `premium.html` footer'ından** erişilebiliyordu. Premium sayfasına hiç gitmeyen kullanıcı ne KVKK metnini ne de hesap silme yolunu bulabiliyordu. Google Play, veri silme yolunun kullanıcıya açık olmasını bekler.
- Düzeltme: `index.html` → `.legal-links` footer'ına **KVKK Aydınlatma Metni** ve **Hesap ve Veri Silme** eklendi; i18n anahtarları `footer_kvkk` / `footer_delete_account` (tr+en) tanımlandı.
- `gizlilik-politikasi.html` üst barındaki "İletişim →" bağlantısı **"Hesap ve Veri Silme →"** ile değiştirildi (iletişim zaten sayfa sonunda var).

**Denetimde kontrol edilip TEMİZ çıkanlar**
- Canlı `*.html` dosyalarında eski ödeme sağlayıcısı adı **geçmiyor** (yalnız `_ARSIV` kopyasında kalmıştı).
- 5 yeni/güncellenmiş yasal sayfa canlıda açılıyor; `premium.html` footer'ındaki 3 link birebir dosya adlarıyla eşleşiyor, 404 yok.
- Sözleşme sayfalarında doldurulmamış `[...]` placeholder **kalmadı**; `noindex` etiketleri kaldırıldı.
- `_ARSIV/` ve `PLAY-DATA-SAFETY.md` GitHub'a **yüklenmedi** (doğru).
- `firestore.rules` kullanıcı tarafından deploy edildi ("Deploy complete!") → hayalet dizin temizliği aktif; 6. oturumdan kalan `{path=**}/firmas` davet kuralı da böylece canlıya gitti, **bekleyen davet listesi maddesi kapandı**.

**Denetimde görülen ama BİLEREK dokunulmayanlar**
- `footer_rate_us` / `footer_rate_us_small` i18n anahtarları artık `index.html`'de kullanılmıyor (rozet tekilleştirildi) ama sözlükte duruyor — başka sayfada kullanılıyor olabilir, silmek risk.
- Sözleşme sayfalarındaki `.fill` CSS kuralı artık kullanılmıyor (placeholder kalmadı) — zararsız.
- `zibD1tAO` (94 KB, uzantısız) yerel klasörde duruyor; ne olduğu belirsiz, `_ARSIV`'a bile taşınmadı.
- Yeni yasal sayfalar **yalnızca Türkçe**; sitenin TR/EN anahtarı bu sayfalarda yok. `gizlilik-politikasi.html` de öyle olduğu için tutarlı, ama Play'de İngilizce mağaza girişi açılırsa çeviri gerekir.

**⛔ 8. OTURUM SONU — BEKLEYENLER**

*Kullanıcıda:*
1. **`firebase deploy --only firestore:rules` TEKRAR** — kod değiştirme paneli için eklenen iki izin (users customerNumber update + userDirectory admin write/delete) henüz canlıda değil. Çalıştırılmazsa panel "permission-denied" verir.
2. **Murat Doğan bir kez giriş yapsın** → `userDirectory/1027` hayaleti otomatik silinir.
3. **Google OAuth client secret** sıfırlama + **Resend API anahtarı** yenileme (3 oturumdur açık, GÜVENLİK).
4. Sözleşme metinlerinin **hukukçuya okutulması** (satış açılmadan önce).
5. **TWA manifest'inde `com.google.android.gms.permission.AD_ID` izni** bildirilmiş mi kontrol — AdSense reklamı için gerekli, doğrulanamadı.

*Play Console'da (bir sonraki oturum):*
6. Veri güvenliği adım 4'teki **3 alt form** (Kullanıcı kimlikleri, Diğer bilgiler, Kullanıcı ödeme bilgileri) → Toplandı EVET / Paylaşıldı HAYIR.
7. **AdSense/Analytics paylaşım çelişkisi** → Uygulama etkinliği + Cihaz kimlikleri için "Paylaşıldı".
8. Formu **Yayınlama özeti'nden Google'a gönder**.
9. Bakılmamış beyanlar: Gizlilik politikası URL'i, Reklam, Hedef kitle, Reklam Kimliği, Finans özellikleri, Oturum açma bilgileri.
10. **~3 Ağustos'ta "Üretime başvur"** açılınca başvuru.

*Kodda (spec bekleyen, dokunulmadı):*
11. **Play Billing entegrasyonu YOK.** `premium.html` → `startSubscription()` şu an yalnızca Play Store ürün sayfasını açıyor. Android tarafında gerçek in-app satın alma akışı + abonelik durumunun Firestore'a yazılması yazılmadı. **Satış açılmadan önce yapılması gereken en büyük iş bu.**
12. Portföy modülü (spec yok), her kayıtta admin bildirimi (backend), mobil menü çakışması (gerçek cihaz gerekiyor) — 7. oturumdan devam.

**⏰ Üretime başvuru:** 12 test kullanıcısı kesintisiz 12 gündür kayıtlı, **14 gün şartı ~3 Ağustos'ta doluyor** → "Üretime başvur" butonu o zaman açılır.

- Bu bölümden önceki ortam düzeltmesinde kod/deploy tarafında değişiklik YAPILMAMIŞTI.

## 🟢 2026-08-01 (7. OTONOM OTURUM — `muham` bilgisayarı) — CANLIYA ALINANLAR

**⭐ EN KRİTİK — GÖNDEREN IBAN KÖK HATASI ÇÖZÜLDÜ (`_src` etiketi)**
- Şikâyet: "yine yanlış IBAN geldi" — YAŞAR CİHAN seçiliyken BURSA CİHAN'ın IBAN'ı geliyordu.
- Teşhis anı: aynı firma+banka için **gönderende IBAN vardı, alıcıda yoktu** → iki taraf farklı havuzdan besleniyor.
- Kök neden: `savedIbans` hem grup firmalarının banka hesaplarından hem de **cari (müşteri/tedarikçi) kayıtlarından** doluyor, ikisi de `firma: <ad>` alanıyla yazılıyor. Gönderen tarafı eşleştirmeyi **isimle** yapıyordu. Bir cari, grup firmasıyla AYNI ADI taşıyorsa o carinin IBAN'ı gönderende çıkıyordu — başka firmaya ait olsa bile.
- Çözüm: kayıtlar kaynağıyla etiketlendi (`_src:'firma'` / `_src:'cari'`); gönderen havuzu (`autoFillGonderenIban`, `mmgBankNamesFor`) yalnızca `_src==='firma'` kabul ediyor. Alıcı tarafı değişmedi.

**IBAN doğruluğu — diğer düzeltmeler**
- `autoFillGonderenIban`: seçilen firmanın kayıtlı IBAN'ı YOKSA fonksiyon erken çıkıp **önceki firmanın IBAN'ını kutuda bırakıyordu**. Artık temizleniyor. **Elle yazılan IBAN korunur** — yalnız `savedIbans`'ta geçen (otomatik dolmuş) değer silinir.
- `fillAliciFromParty`: alıcı tarafında birebir aynı hata (`ibans.length === 0` için hiç dal yoktu). Aynı korumayla düzeltildi.
- **IBAN artık ZORUNLU** (VeriGiriş → IBAN'larım): elle eklemede `TR + 24 rakam` doğrulaması; Excel'de IBAN'sız satır atlanıp raporlanıyor; etiket "(opsiyonel)" → "(zorunlu)". Sebep: IBAN'sız kayıtlar `savedIbans`'a hiç girmiyor ama banka listesini şişirip "banka seçili ama IBAN gelmiyor" sanrısı yaratıyordu.

**Talimat Hazırlama — arayüz sadeleştirme**
- **7 seçici/disket kaldırıldı:** gönderen IBAN "📋 Kayıtlı", "— Farklı IBAN seç —", "📋 Grup Firması", alıcı IBAN + cari seçicileri, muhatap/firma seçicileri, gönderen ve alıcı 💾 butonları. Hepsi kutuya tıklayınca zaten otomatik-tamamlamada geliyor; kaydetme VeriGiriş'ten yapılıyor.
- ⚠️ **Kaldırılan her elemanın JS referansı null-guard'landı** (`?.` / `if(!el) return`) — yoksa konsol hatası o bloğun DEVAMINI kırıyor. Yeni eleman kaldıracaksan aynısını yap.
- Boşalan sütunlar yüzünden FİRMA/IBAN/ALICI satırları `xcell-full`'e çevrildi.
- **Banka listesi o tarafın bankalarıyla sınırlı** (3 bankası varsa 18 değil 3). İki güvenlik ağı: hiç kaydı yoksa TAM liste; hâlihazırda seçili banka listede yoksa başa eklenir.
- **Grup dışı cari listesinde yazdıkça filtreleme**, Türkçe karakter duyarsız (`mmgSearchNorm`: "sirketi" → "ŞİRKETİ"). Grup içi mod eskisi gibi hepsini gösterir.
- "MÜŞTERİ/TEDARİKÇİ" tür etiketi kaldırıldı; kişi listesindeki TC, TC kutusuyla aynı fontta; **bankalar HER ZAMAN Türkçe alfabetik** (`localeCompare('tr')`).
- **PDF/Word'de IBAN tek satır:** PDF sütunu 64→74mm, punto 9.5→8.6 (yer BANKA 38→32, TUTAR 42→36'dan; toplam yine 182mm). Word sütun genişlikleri sabitlendi.

**⚡ PERFORMANS — grup firmaları ~5 sn → ~1 sn**
- `loadMyFirms` Firestore okumaları İÇ İÇE ve SIRAYLA await ediliyordu (N firma = N ağ turu). Admin/üyelik blokları paralel, her birinin firma okumaları `Promise.all`; `fetchFirmaGonderenBilgisi` çağrıları da paralel.
- İsimler hazır olur olmaz liste açılıyor; liste AÇIKKEN firmalar gelirse kendini tazeliyor (`onMyFirmsChanged`). Yüklenirken "Grup firması yok." yerine "Grup firmaları yükleniyor…".

**FİRMA KODU — her yerde ADIN BAŞINDA ve kod sırasında**
- VeriGiriş, KullanıcıYönetimi, index (aktif firma çubuğu + geçiş listesi), Hazır Metin. Sıralama: kod sayısalsa sayı (1000 < 1010), değilse metin; kodu olmayan en sona.
- **Firmalarım seçicisi özel dropdown'a çevrildi** — yerli `<option>` içinde iki renk kullanılamadığı için kodun sarı görünmesi başka türlü mümkün değil. `<select>` DOM'da GİZLİ duruyor ve tek doğruluk kaynağı o (seçimde `value` set edilip `change` tetikleniyor), böylece `selectFirma`/silme akışları aynen çalışıyor.

**VeriGiriş — arama ve onay**
- **6 listeye arama kutusu** (IBAN'larım, Müşteriler, Tedarikçiler, Muhataplar, Personeller, Çalıştığım Bankalar). Render fonksiyonlarına DOKUNULMADI; `MutationObserver` ile liste yeniden çizilince filtre otomatik uygulanıyor. "Çalıştığım Bankalar"da ad `<input value>` içinde olduğu için arama textContent + input değerlerine bakıyor.
- **IBAN içe aktarım onayı 3 seçenekli pencereye çevrildi** (`mmgAsk`). Eskiden tarayıcı `confirm()`'i vardı ve **"İptal" aslında KAYDEDİYORDU** (üstüne ekle) — işlemden çıkmanın yolu yoktu. Artık "Değiştir (N kaydı sil)" / "Koru, üstüne ekle" / **"Vazgeç"** (gerçekten hiçbir şey yapmaz). Esc ve dışarı tıklama = vazgeç.

**Hazır Metin Talimatları**
- **Gerçek firma adı ve VKN örnekleri kaldırıldı** (placeholder'larda kullanıcının kendi firması + VKN'si yazıyordu). Yalnız BİÇİM ipuçları kaldı (GG.AA.YYYY, TR__ …, 11 haneli TCKN).
- Grup firmaları artık HER şablonda: `<datalist>` liste boşken de oluşturuluyor — eskiden boşsa hiç yazılmıyordu, Firestore'dan geç gelen firmaları dolduracak eleman bulunamıyordu. Alan yine serbest metin.

**Blogger — sıfırdan kuruldu ve ÇALIŞIYOR**
- `publishToBlogger` yorumdan çıkarıldı, `us-central1`'e deploy edildi, 4 secret tanımlı, Blog.html'deki buton geri açıldı. Yazı Blogger'da yayınlandı ✓
- Kurulum: Blogger API v3 → OAuth "Web application" (redirect `https://developers.google.com/oauthplayground`) → consent External + `../auth/blogger` + **Publish** (test modunda refresh token 7 günde ölür) → Playground'da Access type **Offline**.
- Tekrarlanırsa iki tuzak: `invalid_client` = Client ID kutusuna JSON'un tamamı yapıştırılmış (sadece değer girilmeli); `Invalid blog id` = secret'a URL'nin tamamı kaydedilmiş (sadece `blogID=` sonrası sayı). **Secret değişince fonksiyon yeniden deploy edilmezse eski değer kullanılmaya devam eder.**

**Diğer**
- Kalem (düzenle) `position:fixed` → `absolute` (kullanıcı: "böyle hareketli değil"); çerçeve `.home-scroll` — `.tools-section`'ın `overflow:hidden`'ı kırpmasın diye bilerek onun ÜSTÜNDE.
- Döviz panelinde "Gram Altın" iki satıra kırılıp `/TRY`'yi uzağa itiyordu → `nowrap` + negatif margin.
- Tüm Kullanıcılar kartına "↻ Yenile".
- **Play Store rozeti `href="#"` idi (ölü link)** → gerçek linke bağlandı (`com.mmgcreativity.dijitalfinans`, `.well-known/assetlinks.json`'dan) + ayrı **"Bizi Oylayın"** butonu.
- **Bayat kapsam temizliği:** hiç firma üyeliği yokken `localStorage.mmg_active_data_scope` bir firma id'sinde kalıyordu; VeriGiriş/Talimat erişilemeyen havuza bakıp "veri gelmiyor" görünüyordu → kişisel kapsama düşürülüyor.
- **Repo temizliği:** `index-DESKTOP-V12JA3F.html` **canlıda 200 dönüyordu** (uygulamanın eski kopyası herkese açıktı) ve `err.txt` silindi.

### ⏳ 7. OTURUM SONU — BENDE/BEKLEMEDE KALANLAR

**Doğrulanamadı (gerçek cihaz/hesap gerekiyor) — DEĞİŞTİRMEDİM:**
- **Mobilde ana başlık/alt başlık çakışması.** `@media (max-width:860px)` altında `.nav-drawer{position:static !important}` ve `.nav-subdrawer` inline açılma kuralları ZATEN var; `wireDrawerToggle` aynı anda tek çekmece açık bırakıyor. Kalan şüphe: `.nav-subwrap.open` sınıfını ekleyen JS YOK — mobilde 3. seviye yalnız `:focus-within` ile açılıyor, dokunmatikte kararsız olabilir. Gerçek cihazda hangi menüde ne göründüğü görülmeden değiştirmek riskli.
- **Mobilde firma çubuğuna firmalar gelmiyor.** Tarayıcıda canlı bakıldı (#1004 Cihan Grup FİNANS): `mmgActiveFirmaBar.hidden = true`, üyelik listesi BOŞ — o hesap gerçekten hiçbir firmaya üye/admin değil, mobil-özel hata değil. **Firması OLAN bir hesapla tekrar bakılmalı.**

**Yapılmadı — spec yok:**
- **PORTFÖY EKLEME (hisse adı / lot / alış fiyatı).** Sitede portföy/hisse ile ilgili HİÇBİR kod yok; tamamen yeni modül. Fiyat kaynağı (canlı borsa verisi mi, elle giriş mi), yeri (yeni sayfa mı, Bütçeleme altında mı), kâr/zarar isteniyor mu belirsiz. Canlı finans uygulamasına tahminle modül eklenmedi.
- **Her kayıtta admin'e bildirim.** `notifyAdminsOnReferralSignup` YALNIZCA referans kodlu kayıtlarda tetikleniyor (`referralSignups/{id}`). Her kayıt için Auth `onCreate` tetikleyicili yeni fonksiyon gerekiyor — backend işi ve **deploy'u yalnız kullanıcının bilgisayarından** yapılabilir, yazılsa bile test edilemez.

**Yerel klasörde temizlenecek (SİLMEDİM — geri alınamaz):**
`*-DESKTOP-V12JA3F*` OneDrive çakışma kopyaları (~10), `*.zip` arşivleri (6), `zibD1tAO`, 12 adet `.fuse_hidden*`. `Gunluk_Panorama.html` canlıda ama menüde bağlı değil (bilinçli).

## 🟢 2026-07-31 (6. OTONOM OTURUM — yeni bilgisayar) — CANLIYA ALINANLAR
**SW `2026-07-31-ozet-sirala-switch`:**
- **Bekleyen davet KÖK NEDEN:** `firestore.rules`'ta `collectionGroup('firmas')` için kök wildcard kural YOKTU (doğrudan yol kuralı CG sorgusunu kapsamaz; members/openers ile aynı tuzak). `{path=**}/firmas` read kuralı eklendi. ⏳ **Kullanıcı: `firebase deploy --only firestore:rules`** (rules GitHub'a yüklemekle canlıya GİTMEZ).
- **Hesap geçişinde logo/avatar değişmiyordu:** `signInWithCustomToken` akışında login-form kodu çalışmadığından eski hesabın `mmg_avatar`/`mmg_profile` önbelleği kalıyordu. İki yönlü düzeltme (`index.html`): (a) `onAuthStateChanged` artık avatar+profili HER auth değişiminde buluttan tazeler (`data.avatarBase64 || user.photoURL`); (b) hesap geçişi tıklamasında reload öncesi kişisel önbellek anahtarları temizlenir (avatar, profil, firma, `mmg_active_data_scope`, `mmg_last_open_page`).
- **Kullanıcı Özeti kartları İstatistikler'den Kullanıcı Yönetim Paneli'ne TAŞINDI** (kullanıcı isteği): `KullaniciYonetimi.html` "Tüm Kullanıcılar" kartının üstünde 4 kart (Toplam/Standart/Premium/Referansla Katılan, `kySummaryGrid`); karta tıkla → tablo o gruba filtrelenir (tekrar tıkla = kaldır, aktif kart brass çerçeve). `Istatistikler.html`'den kartlar + kullanıcı detay tablosu KALDIRILDI (JS'ler element-yoksa-atla guard'lı; `allUsers` yüklemesi referans/kullanım bölümleri için DURUYOR; kullanıcı detay MODALI da duruyor ama artık açan satır yok).
- **Tüm Kullanıcılar tablosuna başlık tıklamalı SIRALAMA:** #Kod/Kullanıcı/E-posta/Durum/Kayıt başlıkları tıklanır (`.ky-sort-th`), ikinci tıklama yönü çevirir, aktif kolonda ▲/▼ göstergesi. Varsayılan: kod artan.

**SW `2026-07-31-cari-sablon-tipsiz`:**
- **Cari (Müşteri/Tedarikçi) Excel şablonu:** "Tip" sütunu KALDIRILDI (kullanıcı: "saçma olmuş"); başlık artık `Firma Kodu | Ünvan | TC/Vergi No | Banka | IBAN | Döviz`. Kayıt türünü, yüklemenin yapıldığı **AKTİF SEKME** belirler (Müşteriler sekmesinden → customers, Tedarikçiler → suppliers). Eski dosyalarda Tip doluysa o değer ÖNCELİKLİ (geriye dönük uyum). Önizleme tablosundan Tip kolonu kaldırıldı. (`VeriGirisPaneli.html` downloadTemplateBtn + import + renderBulkPreview.)

**SW `2026-07-31-personel-tc-excel`:**
- **Personeller sekmesine toplu Excel** (Muhataplar deseniyle): `personnelBulkUploadCard` + Şablonu İndir / Excel Yükle. Şablon: `Firma Kodu | Ünvan / Ad Soyad | TC Kimlik No` (`personeller-sablon.xlsx`); Firma Kodu ZORUNLU, eşleşmeyen satır atlanır+raporlanır; kayıtlar `personnel` koleksiyonuna `appliesToFirmaIds=[kod→id]` ile yazılır.
- **"Görev / Not" alanı → "TC Kimlik No"** (kullanıcı: "bize TC lazım"): form alanı (input `pr_notes` id'si aynı kaldı, maxlength=11 numeric) artık `tc` alanına yazılır; listede `p.tc || p.notes` gösterilir (eski görev kayıtları kaybolmaz).
- **Sekme ikonu sadeleşti:** `🧑‍💼` (Windows'ta kişi+çanta olarak İKİ ikon görünüyordu) → `🧑` (tr+en+HTML).

**SW `2026-07-31-talimat-personel` + `2026-07-31-personel-grup`:**
- **Talimat'ta personel kullanımı CANLI** (`Talimat_Hazirlama.html`): `loadCariDb` artık `personnel` koleksiyonunu da okur (`mmgPersonnelDb`, appliesToFirmaIds filtresiyle); tüm çoklu-kişi alanlarının ("Teslim Alacak Kişi", "Yetkili Kişi") "📋 Kayıtlı" listesinde personeller `🧑 Ad (TC)` olarak önce gelir, seçilince **TC alanı otomatik dolar** (`mmgPersonSavedOptionsHtml`/`mmgRefreshPersonSavedSelects` global). localStorage kayıtlı kişiler de listede durur.
- **GRUBA AİT PERSONEL** (kullanıcı: "bu personeller gruba ait napıcaz"): Personel Excel'inde Firma Kodu sütununa **"GRUP"** (veya GROUP/TÜM/HEPSİ/ALL/*) yazılırsa personel **tüm grup firmalarına** atanır; **virgüllü çoklu kod** (1000,1001) da desteklenir. Kod ham okunur (normalize virgülü sildiği için `mmgReadRowFirmaCode` kullanılmıyor).
- **Yeniden yükleme mükerrer üretmez:** personel import artık AD (tr-lowercase) eşleşmesiyle mevcut kaydın ÜSTÜNE yazar (TC + firma ataması güncellenir). Kullanıcının 1000 koduyla yüklediği 12 kişi, GRUP ile tekrar yüklenince çiftlenmeden tüm firmalara atanır.

**SW `2026-07-31-onizleme-modal` → `2026-07-31-doviz-iban-oto` (son 4 tur):**
- **Personel şablonuna NOTLAR bloğu** (Excel içinde): kod zorunlu, GRUP, virgüllü çoklu kod, aynı adla üzerine yazma — 4 madde halinde.
- **Toplu yükleme ÖNİZLEME MODALI** (kullanıcı: "12 satır bulundu diyor, önizleme penceresi açılsın"): `.bulk-preview-wrap{display:none}` kuralı duruyor ama önizleme artık `mmgBulkModalShow/Hide` ile ortada büyük MODAL pencerede açılıyor (backdrop'lu). 5 akışın hepsi: cari, IBAN'larım, Çalıştığım Bankalar, Muhataplar, Personeller.
- **TCKN autofill düzeltmesi** (kullanıcı: "TC gelmiyor"): kişi satırında TC kutusu OLMAYAN talimat türlerinde (Çek Karnesi Teslim, Senet Teslim — TC ayrı `glTckn` alanı) personel seçilince artık `glTckn` da otomatik dolar.
- **Döviz Alım/Satım** (`Talimat_Hazirlama.html`): alan sırası → Banka, Firma, **Para Birimi (firmanın altında)**, Tutar, Kur, **IBAN'lar EN ALTTA** (etiketler: Alım'da Gönderen=TL/Alıcı=Döviz; Satım'da tersi). Firma+Banka seçilince `applyFirmaMatch` firmanın kayıtlı hesaplarından (`f.ibans[{banka,iban,currency}]`) **TL ve döviz IBAN'larını otomatik doldurur** (önce seçili banka eşleşmesi, yoksa para birimi eşleşen herhangi biri); banka/para birimi değişince yeniden hesaplanır.

**SW `2026-07-31-kayitli-iban-fallback`:**
- **"Kayıtlılar gelmiyor (IBAN)"** (`refreshIbanSelectForFirma`): seçili BANKA filtresi sıfır sonuç verirse liste artık boş bırakılmıyor → firmanın TÜM kayıtlı IBAN'ları gösteriliyor (senaryo: firmada yalnız VAKIFBANK IBAN var, kullanıcı VAKIF KATILIM seçmiş → liste bomboş kalıyordu). Liste yine boşsa (firmaya atanmış hiç IBAN yok) dropdown'da yol gösteren disabled satır: "Bu firmaya atanmış kayıtlı IBAN yok (VeriGiriş → IBAN'larım'dan Firma Kodu ile yükleyin)". Sıkı af-filtre (8. tur) DEĞİŞMEDİ — asıl veri düzeltmesi hâlâ kullanıcının IBAN'ları yeni şablonla yüklemesi.

**SW `2026-07-31-iban-degistir-modu`:**
- **IBAN yükleme DEĞİŞTİR modu** (kullanıcı YC IBAN.xlsx yükledi ama listede eski havuzdan kalma düzinelerce Akbank IBAN'ı da geldi — "getirdiği IBAN'lara bak hâlâ"): `banksBulkConfirm` artık dosyada kodu geçen firmaların MEVCUT kayıtlı IBAN'ı varsa soruyor: "önce SİLİNSİN ve yalnızca bu dosyadakiler kalsın mı? Tamam=Değiştir (önerilen) / İptal=Üzerine ekle". Değiştir seçilirse o firmalara atanmış eski banks kayıtları silinip yalnızca Excel'dekiler yazılır → Excel = firmanın tek doğru IBAN listesi. Kullanıcının yapması gereken: YC IBAN.xlsx'i BİR KEZ DAHA yükleyip "Tamam (Değiştir)" demek.
- Not: Kullanıcının dosyası cari şablonu başlığındaydı (`Firma Kodu|Ünvan|TC/Vergi No|Banka|IBAN|Döviz`) ama IBAN'larım importu kolon ADINA baktığı için sorunsuz çalışır (Ünvan/TC yok sayılır).

**SW `2026-07-31-bulk-kart-ilk-acilis` — ASIL KÖK NEDEN BULUNDU:**
- **"IBAN'lar gelmiyor / tekrar tekrar kaydediyor" gizemi çözüldü:** Sayfa İLK AÇILIŞTA IBAN'larım sekmesi aktif olsa da sağdaki "Toplu Excel ile Yükle" kartı **CARİ (Müşteri/Tedarikçi) kartıydı** — kart görünürlüğü yalnız sekme TIKLANINCA senkronlanıyordu, açılışta hiç çalışmıyordu (`bulkUploadCard` HTML'de default görünür). Kullanıcı YC IBAN.xlsx'i farkında olmadan MÜŞTERİLER'e yüklüyordu → "23 satır, 1 kayıda gruplandı, 1 kayıt kaydedildi" = tek müşteri (kendi firması!) 23 IBAN'la; banks BOŞ kaldı. Düzeltme: `mmgSyncBulkCardToTab(tab)` fonksiyonu + SAYFA AÇILIŞINDA da çağrı.
- ⚠️ **Temizlik (kullanıcı yapmalı):** (1) Müşteriler sekmesinde yanlışlıkla oluşan "YAŞAR CİHAN HAZIR BETON SAN. VE TİC. A.Ş." müşteri kayıtlarını (muhtemelen birden fazla) sil. (2) Ctrl+Shift+R sonrası IBAN'larım sekmesindeyken kartın başlığında ŞABLONUN IBAN şablonu olduğundan emin olup YC IBAN.xlsx'i yükle (önizleme başlıkları Firma Kodu|Banka|IBAN|Döviz olmalı, "1 kayıda gruplandı" DEĞİL 23 kayıt) → listede 23 IBAN rozetleriyle görünür. ✅ Kullanıcı doğru karttan yükledi ("23 satır, 23 kayıda gruplandı") — 23 IBAN CANLI (Döviz Alımı'nda Akbank TL IBAN'ı otomatik geldi).

**SW `2026-07-31-banka-secimi-ezilmez`:**
- **"Başka banka seçiyorum, zorla AKBANK geliyor"** (Döviz Alımı + Çek Karnesi Teslim, tüm generic türler): `applyFirmaMatch` her firma input/change'inde `setBankSelectValue(bankaEl, f.banka)` ile bankayı firmanın İLK IBAN'ının bankasına (AKBANK) geri çeviriyordu → kullanıcının banka seçimi anında eziliyordu. Düzeltme: banka yalnızca **BOŞKEN** otomatik dolar (`!bankaEl.value` şartı); kullanıcı seçimi korunur, döviz IBAN otomatiği seçili bankaya göre hesaplanır.
- Chrome üzerinden canlı Firestore teşhisi yapıldı (Talimat sayfası `window.mmgCloud` ile): Chrome profili mmgcreativity@gmail.com hesabında ve kişisel kapsamda (adminFirmaIds boş) — kullanıcının uygulaması ayrı pencerede firma kapsamında çalışıyor. `mmg_active_data_scope` hesap geçişi temizliğiyle silinebiliyor; sorun olursa kullanıcı sol-alt kapsam çubuğundan firmayı yeniden seçmeli.

**SW `2026-07-31-doviz-ondeger-eur` + `2026-07-31-firma-datalist-ac`:**
- **Döviz Alım/Satım Para Birimi öndeğeri EUR** (options sırası EUR,USD,GBP + pick fallback EUR).
- **Generic talimatlarda firma DEĞİŞTİRİLEMİYORDU** ("sadece Aderans geliyor"): glFirma datalist'i dolu değere göre filtrelendiğinden tıklayınca tek öneri kalıyordu → focus'ta değer geçici boşaltılır (TÜM grup firmaları listelenir), seçim yapılmadan çıkılırsa blur'da eski değer geri gelir (`dataset.prevFirma`).
- ℹ️ Döviz IBAN otomatiği ÇALIŞIYOR (Vakıf Katılım TL+EUR doğru geldi). "ADERANS'ta IBAN gelmiyor" = VERİ: ADERANS'ın (kod 1001) IBAN'ları henüz yüklenmedi — kullanıcı diğer firmaların IBAN'larını da (kod 1001-1005) aynı Excel'e ekleyip yüklemeli (Değiştir modu firma-bazlı silip yazar).

**SW `2026-07-31-kullanici-detay-modal`:**
- **KY panel "Tüm Kullanıcılar" satırına tıklayınca kullanıcı DETAY modalı** (`kyOpenUserDetail`): kod, ad, e-posta, telefon, durum, site-admin, referans kodu, premium faydası, yönettiği firma sayısı, kayıt tarihi, UID + **"Ham alanlar"** (users dokümanının tamamı, 200+ karakterlik base64 alanlar kısaltılır). E-postası olmayan kayıtlarda (örn. #1018 FİNANS) turuncu açıklama: alan dokümanda yok — telefonla/eski akışla açılmış ya da yarım kayıt; ham alanlardan gerçek durum görülür. Satırlar cursor:pointer + tbody'de tek event delegation.

**SW `2026-07-31-glfirma-koyu-liste` → `2026-07-31-hub-havuz-iban` (son 2 tur, Talimat):**
- **glFirma beyaz datalist → sitenin koyu temalı özel listesi** (mmg-ac deseni, gönderen firma alanıyla birebir): odak/tıkta TÜM grup firmaları, seçilince applyFirmaMatch; datalist kaldırıldı.
- **EN KRİTİK — grup firmasının IBAN'ları gelmiyordu (ADERANS):** `fetchFirmaGonderenBilgisi` bankaları hep `firmaAccounts/{firmaId}/banks`'tan okuyordu; grup üyelerinde veri HUB havuzunda (`dataGroupId`) durur → hub dışındaki HER firmada boş dönüyordu. Düzeltme: `poolId = fData.dataGroupId || firmaId` ile havuzdan oku, af.includes(firmaId) filtresi aynı. (Chrome+mmgCloud canlı teşhisiyle doğrulandı: ADERANS'ın havuzda 18 atanmış IBAN'ı vardı.)
- **Firma değişince eski firmanın IBAN'ı asılı kalmıyor:** döviz otomatiğinde eşleşme yoksa alan '' yapılır ("Aderans seçtim, Yaşar Cihan verisi geliyor" şikâyetinin ikinci yarısı).
- **TÜM generic talimatlarda alan sırası: ÖNCE FİRMA SONRA BANKA** (13 tür, iki varyant regex ile toplu değiştirildi).

**SW `2026-07-31-tm-muhatap-oneri` → `2026-07-31-kayitli-select-kalkti` (Talimat):**
- **Teminat Mektubu MUHATAP alanı VeriGiriş "Muhataplar"a BAĞLANDI** (kullanıcı: "muhatap yükledim gelmiyor" — alan düz metindi, hiçbir kaynağa bağlı değildi): `glMuhatap` mmg-ac koyu listeyle `savedCari(type=counterparties)`'den beslenir, seçilince **Adres (`glMuhatapAdres`) otomatik dolar**, VKN listede rozet. `loadCariDb` cari kayıtlarına `notes` alanı da eklendi.
- **"Teslim Alacak Kişi" Ad Soyad kutusuna TIKLAYINCA isim listesi** (personeller 🧑+TC + elle kayıtlı kişiler) açılır, yazdıkça elenir; seçilince TC (satır kutusu ya da ayrı glTckn) otomatik dolar.
- **"📋 Kayıtlı" seçicisi kişi satırlarından KALDIRILDI** (kullanıcı isteği): tek desen — kutuya tıkla=hepsi, yaz=eleme. 💾 kişi kaydet duruyor. ⚠️ Yapı notu: person-row input'u artık `.mmg-ac-wrap` içinde; `mmgRefreshPersonSavedSelects` no-op'a yakın (select kalmadı) ama loadCariDb çağrısı zararsız.
- Dikkat (bugfix süreci): glFirma/glMuhatap wiring'inde blok kapanışı kayması yaşandı — `pbEl/bkEl2` change listener'ları `applyFirmaMatch` scope'unda (if(glFirmaInput) içinde) olmalı; düzeltildi, `node --check` + canlı doğrulandı.
- **SW `2026-07-31-kisi-liste-hiza`:** kişi öneri listesi TAM SATIR genişliğinde açılır (`.mmg-person-row{position:relative}` + `.mmg-ac-wrap{position:static}` + liste left/right:0): ad "Ad Soyad" sütununun, TC (meta, flex:0 0 198px) "TC Kimlik No" sütununun altına hizalı.

**SW `2026-07-31-muhatap-vkn-duzenle` (VeriGiriş):**
- **Muhatap Excel şablonu YENİLENDİ** (kullanıcı: "alakasız"): `Firma Kodu | Muhatap | Muhatap VKN | Adres`; Firma Kodu'nda **GRUP** ve virgüllü çoklu kod desteklenir (personel/cari ile aynı kurallar), NOTLAR bloğu eklendi. VKN → mevcut `idNumber` alanına, Adres → `notes`'a yazılır (liste ve Talimat zaten bunları okuyor, kırılma yok). Aynı adla yeniden yükleme üzerine yazar (çiftlemez).
- **SATIR İÇİ DÜZENLEME (✎) — "veriler sonradan değiştirilebilsin":** ortak `mmgInlineEditRow` helper'ı; Muhataplar (ad+VKN+adres), Personeller (ad+TC), Müşteri/Tedarikçi (ünvan+TC/Vergi No) satırlarında ✎ ile yerinde mini-form açılır, Kaydet → merge update. IBAN satırları hariç (sil/yeniden yükle).
- Manuel muhatap formuna **"Muhatap VKN"** alanı (`cp_vkn` → idNumber) eklendi; "Not/Adres" etiketi "Adres" oldu.

**SW `2026-07-31-legacy-gonderen-dislama`:**
- **"Düzelmedi — hâlâ 15 Akbank IBAN'ı"nın GERÇEK kaynağı:** hub havuzu TEMİZ (canlı teşhis: 41 kayıt = 23 YC + 18 ADERANS, sıfır artık). Listedeki 13 fazladan Akbank IBAN'ı **kişisel kapsamdaki eski `kayitliMuhataplar.ibans`** girişleri: hesap geçişi temizliği `mmg_active_data_scope`'u silince uygulama KİŞİSEL kapsama düşüyor → `onlyDb` kapanıyor → legacy liste gönderene sızıyordu. Düzeltme: GÖNDEREN listesi + `autoFillGonderenIban`, **grup firması adını taşıyan non-_db (legacy) girişleri HER kapsamda dışlar** (kişisel kullanıcılar etkilenmez; firma adları myFirms'te değil). Kalıcı öneri: kullanıcı sol-alt kapsam çubuğundan firmayı yeniden seçmeli; istenirse kişisel legacy ibans dizisi ayrıca temizlenebilir (veri silme — kullanıcı onayı gerekir).

> ✅ **Sürümleme çözüldü:** "Güncelleme var, yenile" banner'ı (index.html #mmgUpdateBanner) NE app-version.json NE de SW_VERSION'a bakar — index.html'e HEAD atıp ETag/Last-Modified karşılaştırır (tamamen otomatik). `SW_VERSION` sadece cache-bust; `app-version.json` artık okunmuyor ama ikisi senkron tutuluyor. Her deploy'da ikisini de bump'la.

> ⚠️ **OneDrive senkron tuzağı:** OneDrive çalışmıyorken dosyalar "cloud-only" görünür; bash "Invalid argument" verir, düzenleme kaybolabilir veya ESKİ sürüm yüklenir. Deploy öncesi işaret (marker) kontrolü şart. (Kayıtlı skill: `mmg-onedrive-sync-guard`.) Bu klasörde `DEVIR-NOTU-DESKTOP-V12JA3F.md` gibi "DESKTOP-xxxx" çakışma kopyaları OneDrive'ın ürettiği artıklardır — silinebilir.

## 🟢 2026-07-31 (5. OTONOM OTURUM) — CANLIYA ALINANLAR
**On ikinci tur (bekleyen 5 iş, hepsi) — SW `2026-07-31-bekleyen-5is`:**
- **(A) Masaüstünde "← Ana Sayfa" butonları kaldırıldı:** `i18n-core.js`'e (57 sayfada yüklü) iframe algısı eklendi — `window.self!==window.top` ise `.back-link` ve `a[href="index.html"][target=_top]` gizlenir. Sayfa bağımsız/mobil açılınca buton KALIR.
- **(B) Sekme şeridi anasayfada hero'nun ALTINDA:** `mmgShowPanel` → `mmgPlaceTabBar(target)`; home'da tabBar hero'nun hemen sonrasına taşınır, araç açıkken main'in en üstüne döner.
- **(C) Kalem (masaüstü düzenle) sağ ÜST KÖŞEDE sabit:** `.desktop-toolbar` top:64px→**16px** (position:fixed zaten vardı).
- **(D) Döviz paneli:** Gram Altın'a yedek kaynak zinciri (truncgil v4 → genelpara; CORS'ta biri düşerse diğeri) + **"+ Parite" butonu** (3 harfli kod sorulur, `mmg_doviz_extra_pairs` localStorage'da kalıcı, satırda ✕ ile kaldırma).
- **(E) VeriGiriş'e "🧑‍💼 Personeller" sekmesi:** Muhataplar deseniyle birebir — `{scope}/{id}/personnel` koleksiyonu (ad + görev/not), elle ekle/sil/yenile, firma seçimi (boşsa aktif firmaya atanır), kurallar wildcard'la zaten kapsıyor. Bulk/şablon YOK (istenirse eklenir).
- Ders (kullanıcı uyardı): "bekleyen yok" derken YALNIZCA kullanıcı-tarafı işleri kastetmiştim; bendeki 5 iş duruyordu. Kapanışta HER ZAMAN iki liste ver: (1) yayınlananlar, (2) bende/beklemede olanlar.

**On birinci tur — SW `2026-07-31-iban-sablon-kod`:**
- **IBAN Excel şablonundan "Firma" (ad) sütunu KALDIRILDI** (kullanıcı isteği): başlık artık `Firma Kodu | Banka | IBAN | Döviz | Açıklama`; örnek satırlarda kod (1000/1001). Eşleştirme zaten yalnız kodla; eski şablonla yüklenen dosyalar da çalışır (Firma sütunu yok sayılır).
- ✅ **IAM signBlob ÇÖZÜLDÜ (kullanıcı Console'dan verdi, ekran teyitli):** compute servis hesabına "Service Account Token Creator" rolü eklendi ("Policy updated"). Birkaç dk aktifleşme sonrası hesap geçişi (INTERNAL) düzelmiş olmalı. Bekleyen kullanıcı işi KALMADI.

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
- **Çalışma klasörü (yerel):** `…\OneDrive\0.mmgcreativity\web\site` — `muham` makinesinde `C:\Users\muham\…`, `CihanFinans` makinesinde `C:\Users\CihanFinans\…` (OneDrive senkron; bazı dosyalar "cloud-only" olabilir — düzenlemeden önce indirilir). **2026-08-01'e kadar bu klasörün adı `html` idi** (yukarıdaki klasör-adı notuna bak).
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

---

# 12. OTURUM — 2 Ağustos 2026

## Yeni modül
- **`Kredi_Kartlari.html`** (Nakit Yönetimi altında). Üç ayrı store:
  `krediKartlari` (banka, ad, son4, limit, **kesimGun**, **odemeGun**, para, firmaId),
  `krediKartiHarcamalari` (kartId, tarih, tutar, **taksit**, kategori, açıklama),
  `krediKartiOdemeleri` (yalnız "bu dönem ödendi" işareti).
  **Ödeme planı TÜRETİLİR, elle girilmez** (`planUret()`): her harcama taksitlerine
  bölünür; harcama günü ≤ kesim günü ise o ayın, değilse ertesi ayın ekstresine girer;
  i. taksit → ilk dönem + i ay. Kuruş farkı son taksite bindirilir.
  Son ödeme = dönem ayının kesim günü (kısa ayda kırpılır) + `odemeGun`.
  Ödenmemiş TL dönemler `kk_<kartId>_<donem>` id'siyle nakit akışa yazılır.
- Giderler'deki `kredi-karti` kategorisi **silinmedi, `gizli:true` yapıldı** — eski
  kayıtların etiketi ve modülün yazdığı satırların kategorisi bozulmasın diye.

## KRİTİK DÜZELTME — firma kapsamı (veri sızıntısı)
`mmg_odemeler_list` / `mmg_gelirler_list` **tek global localStorage anahtarındaydı**;
nakit akış önbelleği kapsam bazlıydı ama listenin kendisi değildi → A firmasında girilen
kayıt B firmasında da görünüyordu.
- `mmg-odemeler-sync.js` → `mmgScopedListAPI(base)`: anahtar `base__<col>:<id>`.
  Eski global anahtar yalnız kişisel/misafir kapsama BİR KEZ taşınır.
- `MMGStore.akisAnahtar(base)` eklendi; Çek/Senet ve Kredi Kartları bunu kullanır.
- Gelirler'de bulut kayıtları yerel listeyle **birleştiriliyordu** (kayıtlar birikiyordu)
  → artık **yerine yazılıyor**.
- Gelir/Gider ekranlarına **"Grup Göster"** onay kutusu ve her satıra 🏢 firma rozeti.
  Grup modunda başka firmanın kaydı 🔒 ile kilitli.

## IBAN (VeriGirisPaneli)
- **Satır bozuktu, üç ayrı hata:** ızgara 5 sütun / satırda 6 öge (✕ alt satıra taşıyordu),
  IBAN'a 46px düşüyordu (kırpılıyordu), `.bank-chip button` kuralı kapsam rozetini de
  20×20 daireye zorluyordu (yazı para birimiyle çakışıyordu).
  Çözüm: `--iban-grid` CSS değişkeni — başlık/filtre/satır **aynı sabit sütunları** kullanır.
- Sütun başlıkları + **sütun bazlı filtre** (Firma ve Banka açılır liste, tam eşleşme).
- **Sahiplik ≠ Görünürlük** artık uçtan uca ayrı:
  `sahipFirmaId` = 1. sütun (kimin parası), `appliesToFirmaIds` = kim görebilir (boş = tüm grup).
  Toplu yükleme **koşulsuz `appliesToFirmaIds=[fid]` yazıyordu** — her IBAN tek firmaya
  kilitleniyordu; düzeltildi. Excel şablonuna **"Görünürlük"** sütunu eklendi
  (boş/`TÜM GRUP` · `SAHİBİ` · `1000, 1002`). Formda "Görünürlük" seçimi, listede rozet
  **çift yönlü** (kısıtla ↔ tüm gruba aç).

## Menü / arayüz
- Sohbet sekmeleri: **Kişiler · Sohbetler · Gruplar · İstekler**. Kişiler yalnız kişi
  listesi (son mesaj yok, alfabetik); tıklayınca `pairChatId` ile sohbet açılır.
- Stok Takip → **Stok Yönetimi**, Cari Yönetimi altından İşletme Yönetimi'ne çıktı.
- Risk Yönetimi Raporlar'da en üste; Yatırım Portföyü Nakit Yönetimi'nde en alta.
- Çek/Senet başlıkları → **Çek / Senet / DBS**. Giderler'de "Fatura" → **"Cari Ödeme"**
  (id `fatura` korundu).
- Hero şeridinde Forum → İşletme Yönetimi; kelime öbekleri **bölünmez boşlukla** birleşti.
- Play rozeti yıldızları 14px → **28px**.
- **Yeni Fatura ekranı kaldırıldı**; ekleme formu Satış ve Alış listelerinin üstünde,
  vade *çalışma şekli (Fatura+/Ay Sonu+) + gün* ile hesaplanıp nakit akışa gidiyor.
- Cari Hesap Özeti: sütun sıralama (2. tıkta ters) + sütun arama (sayıda `<` üst sınır).
- Talimat Hazırlama: sol panel **430px** (IBAN genişliği), önizleme büyüdü, yatay kaydırma
  kapandı; Hazır Metin'den gelince "← Hazır Metin Talimatları" butonu; Grup dışı seçilince
  **Açıklama satırı** (önizleme + PDF).
- `mmgEnsureFrame`: sekmenin iframe'i başka sayfaya kaydıysa hedefe döndürülür
  (Hazır Metin'e tekrar tıklayınca son ekran geliyordu).
- Kalem (düzenle) menüsü ilk seçimde **kapanmıyor** artık; eklenen kısayol listeden düşer.
- Tahsilat Makbuzu: Ödeyen alanına Veri Girişi cari listesi **datalist** olarak öneri.

## BEKLEYEN — KULLANICI TARAFINDA
1. **`firebase deploy --only firestore:rules`** — `companies` alt koleksiyon yazma kuralı,
   misafir blog okuma ve bekleyen firma kuralı bu olmadan devrede DEĞİL.
2. **Play Store mağaza kaydı** — metinler `web/PLAY-STORE-ACIKLAMA.md` dosyasında hazır;
   Play Console'a kopyalanacak + yeni ekran görüntüleri.
3. `html/_SILINECEK/` klasörü (700 KB, eski zip/yedekler) silinebilir.
