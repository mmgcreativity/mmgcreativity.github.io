# Premium Ödeme Sistemi — Kurulum Talimatları

Bu klasördeki `functions/` içeriği ve `Premium.html` / `premium-basarili.html` /
`premium-basarisiz.html` dosyaları, mmgcreativity için premium üyelik ödemesini
gerçekleştirir. Aşağıdaki adımları sırasıyla uygulayın.

## 0) Ön koşullar

- Node.js kurulu bir bilgisayar (https://nodejs.org — LTS sürüm yeterli).
- Firebase CLI: bilgisayarınızda bir terminal açıp şunu çalıştırın:
  ```
  npm install -g firebase-tools
  firebase login
  ```
- Firebase projenizin **Blaze (kullandıkça öde)** planına yükseltilmiş olması gerekiyor
  (Cloud Functions'ın dışarıya — iyzico/PayTR sunucularına — istek atabilmesi için
  şart; Spark/ücretsiz planda bu mümkün değil).
  Firebase Console → sol altta "Spark" yazan yerden "Upgrade" ile yapılır.

## 1) Ödeme sağlayıcısı hesabınızı hazırlayın

**iyzico** kullanacaksanız:
- https://www.iyzico.com üzerinden üye iş yeri başvurusu yapın.
- Onaylanınca "API Key" ve "Secret Key" bilgilerinizi alın (Sandbox/test anahtarları
  başvuru onayı beklemeden hemen verilir, gerçek/canlı anahtarlar onay sonrası gelir).

**PayTR** kullanacaksanız:
- https://www.paytr.com üzerinden mağaza başvurusu yapın.
- Onaylanınca Mağaza Paneli → Bilgilerim sayfasından `merchant_id`, `merchant_key`,
  `merchant_salt` bilgilerini alın.
- Mağaza Paneli'nde "Bildirim URL" alanına, deploy sonrası alacağınız
  `.../paytrNotify` adresini gireceksiniz (aşağıda 4. adımda).

## 2) Bu klasörü Firebase projenize bağlayın

Bilgisayarınızda bu proje klasörünün (index.html, functions/ vb. hepsinin bulunduğu
klasör) içine terminalle girin, sonra:

```
firebase init functions
```

Sorulara şu şekilde cevap verin:
- "What language..." → **JavaScript**
- "Use ESLint?" → Hayır (No) diyebilirsiniz, zorunlu değil
- Zaten bir `functions/` klasörünüz var, üzerine yazmak isteyip istemediğinizi
  sorarsa **mevcut dosyaları SİLMEYİN** — sadece eksik konfigürasyon dosyalarını
  (`firebase.json`, `.firebaserc`) oluşturmasına izin verin.

Sonra:
```
cd functions
npm install
cd ..
```

## 3) Gizli anahtarları (API key/secret) tanımlayın

Bu bilgileri **asla** kod içine yazmayın — Firebase'in "secrets" (sır) özelliğiyle
güvenli şekilde saklayın. Terminalde şunları çalıştırın (sadece kullandığınız
sağlayıcının satırlarını):

**iyzico kullanıyorsanız:**
```
firebase functions:secrets:set IYZICO_API_KEY
firebase functions:secrets:set IYZICO_SECRET_KEY
```
(Her komuttan sonra terminale değeri yapıştırıp Enter'a basacaksınız.)

**PayTR kullanıyorsanız:**
```
firebase functions:secrets:set PAYTR_MERCHANT_ID
firebase functions:secrets:set PAYTR_MERCHANT_KEY
firebase functions:secrets:set PAYTR_MERCHANT_SALT
```

Ardından `functions/index.js` dosyasının en üstüne, kullandığınız sağlayıcıya göre
şu satırı ekleyin (secret'ları fonksiyona bağlamak için — `onCall` ve `onRequest`
tanımlarının hemen üstüne):

```js
const { defineSecret } = require('firebase-functions/params');
const IYZICO_API_KEY = defineSecret('IYZICO_API_KEY');       // iyzico kullanıyorsanız
const IYZICO_SECRET_KEY = defineSecret('IYZICO_SECRET_KEY'); // iyzico kullanıyorsanız
// PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT için de aynı şekilde
```

ve her `onCall(...)` / `onRequest(...)` çağrısına `{ secrets: [IYZICO_API_KEY, IYZICO_SECRET_KEY] }`
gibi bir seçenek ekleyin. (İsterseniz bu adımı bana söyleyin, dosyayı sizin için
güncelleyeyim — hangi sağlayıcıyı seçtiğinizi bilince tam halini yazarım.)

Ayrıca `PAYMENT_PROVIDER`, `SITE_URL` gibi gizli olmayan ayarları `.env` dosyasıyla
verebilirsiniz — `functions/` klasörü içine `.env` adında bir dosya oluşturup:
```
PAYMENT_PROVIDER=iyzico
SITE_URL=https://sizin-gercek-site-adresiniz.com
```
şeklinde yazmanız yeterli.

## 4) Deploy edin

```
firebase deploy --only functions
```

İşlem bitince terminalde her fonksiyon için bir URL göreceksiniz, örneğin:
```
✔  functions[iyzicoCallback(europe-west1)] https://europe-west1-mmgcreativity-31263.cloudfunctions.net/iyzicoCallback
```

- Bu adresi `functions/index.js` içindeki `FUNCTIONS_BASE_URL` değişkenine yazın
  (sondaki `/iyzicoCallback` kısmı olmadan, sadece temel adres).
- **PayTR kullanıyorsanız:** `.../paytrNotify` adresini PayTR Mağaza Paneli'ndeki
  "Bildirim URL" alanına girin.
- Değişiklik yaptıysanız `firebase deploy --only functions` komutunu tekrar çalıştırın.

## 5) Test edin

- Sandbox/test modundayken (kod içinde `testMode: true` / sandbox URL'leri) gerçek
  kart bilgisi girmeden test kartlarıyla deneme yapabilirsiniz — her iki sağlayıcının
  da dokümantasyonunda "test kartları" listesi bulunur.
- Test başarılıysa, `functions/index.js` içindeki:
  - iyzico: `uri: 'https://sandbox-api.iyzipay.com'` satırını `https://api.iyzipay.com` yapın.
  - PayTR: `testMode: true` satırını `testMode: false` yapın.
  - Tekrar `firebase deploy --only functions` çalıştırın — artık gerçek para çekilir.

## 6) Siteye "Premium'a Geç" linkini ekleyin

`Premium.html` dosyası hazır — bunu diğer sayfalarla birlikte sunucunuza yükleyin.
İsterseniz size ana menüye veya hesap açılır menüsüne bir "Premium'a Geç" butonu da
ekleyeyim; hazır olduğunuzda söyleyin.

---

**Özet olarak bana ihtiyacınız olursa söyleyebileceğiniz şeyler:**
- "İyzico/PayTR anahtarlarımı aldım, secrets tanımlama kodunu tam olarak yaz" →
  `functions/index.js`'i sizin seçtiğiniz sağlayıcıya göre `defineSecret` ile
  güncellerim.
- "Deploy ettim, işte fonksiyon URL'lerim" → `FUNCTIONS_BASE_URL` ve `SITE_URL`
  değerlerini sizin gerçek adreslerinizle güncellerim.
- "Premium'a Geç linkini menüye ekle" → index.html'e bağlarım.
