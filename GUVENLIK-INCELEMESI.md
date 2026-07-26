# MMG Creativity — Güvenlik İncelemesi (Firestore Kuralları)

Tarih: 2026-07-26 · Kapsam: `firestore.rules` + istemci veri erişim desenleri

Bu inceleme, sitenin Firestore güvenlik kurallarındaki riskleri önem sırasına göre listeler. Firebase Web API anahtarının herkese açık olması **normaldir** (Firebase'de güvenlik anahtarla değil, kurallarla sağlanır) — asıl güvenlik katmanı `firestore.rules` dosyasıdır. Aşağıdaki bulgular bu dosyaya odaklanır.

## Özet

En kritik risk, birden fazla koleksiyonun **giriş yapmış HERKESE** okuma/yazma açması: `allow read, write: if request.auth != null`. Bu, kimliği doğrulanmış bir kullanıcının **başka bir firmanın/kullanıcının verisini okuyup değiştirebilmesi** anlamına gelir (çok-kiracılı izolasyon yok). Bu kurallar tek başına daraltılamaz çünkü uygulama, çapraz-firma üye yönetimini bilerek istemci tarafında ve açık kurallarla yapıyor (kod içinde de not düşülmüş). Doğru çözüm, ayrıcalıklı yazmaları Cloud Functions'a taşıyıp kuralları üye/sahip bazlı daraltmaktır.

## Bulgular

### 1) YÜKSEK — `firmaAccounts/{firmaId}` ve tüm alt koleksiyonları herkese açık
```
match /firmaAccounts/{firmaId} {
  allow read, write: if request.auth != null;
  match /{document=**} { allow read, write: if request.auth != null; }
}
```
Herhangi bir giriş yapmış kullanıcı, **herhangi bir firmanın** hesabını, üye listesini (`members/{uid}`) ve alt verilerini okuyabilir/değiştirebilir/silebilir. Bir firmanın çalışanı (hatta herhangi bir üye) başka bir firmanın verisine erişebilir. `KullaniciYonetimi.html` içindeki yorumda bu durum bilinçli bir taviz olarak belirtilmiş (çapraz-firma üye ekleme collectionGroup ile yapıldığı için).

Önerilen hedef: Firma dokümanını yalnızca firmanın kendisi (kendi auth hesabı) ve üyeleri okuyabilsin; üye ekleme/çıkarma gibi ayrıcalıklı yazmalar bir Cloud Function üzerinden yapılsın; `members` alt koleksiyonuna doğrudan istemci yazması kaldırılsın veya yalnızca firma sahibine/adminine izin verilsin.

### 2) YÜKSEK — `companies/{companyId}` (+ alt koleksiyonlar) herkese açık
```
match /companies/{companyId} {
  allow read, write: if request.auth != null;
  match /{document=**} { allow read, write: if request.auth != null; }
}
```
Aynı çok-kiracılı izolasyon eksikliği. Bir kullanıcı başka bir şirketin verisini okuyup yazabilir. (Not: `companies` eski/legacy sistem gibi görünüyor; hâlâ kullanılıyorsa daraltılmalı, kullanılmıyorsa tamamen kapatılmalı — `allow read, write: if false;`.)

### 3) YÜKSEK — `groups/{groupId}` ve `invites/{email}` herkese açık
```
match /groups/{groupId} { allow read, write: if request.auth != null; }
match /invites/{email}  { allow read, write: if request.auth != null; }
```
Herhangi bir kullanıcı grupları ve davetleri okuyabilir/değiştirebilir/silebilir. Davet kayıtları e-posta adresi içerdiğinden, bu aynı zamanda bir **kişisel veri (e-posta) sızıntısı** riskidir.

### 4) ORTA — `firmaInvites` ve `firmaAdminInvites` herkese açık
```
match /firmaInvites/{code} { allow read, write: if request.auth != null;
  match /firmas/{firmaId} { allow read, write: if request.auth != null; } }
match /firmaAdminInvites/{email} { allow read, write: if request.auth != null; }
```
Davet kayıtları (kod/e-posta) herkes tarafından okunup değiştirilebilir. En azından okuma, davet edilen kişi veya firma sahibiyle sınırlandırılmalı.

### 5) ORTA — `referrals/{code}` (+ alt) ve `referralCodes` okuma herkese açık
```
match /referrals/{code} { allow read, write: if request.auth != null;
  match /users/{uid} { allow read, write: if request.auth != null; } }
```
Herhangi bir kullanıcı referans kayıtlarını okuyup yazabilir. Komisyon/kazanç verisi içeriyorsa, sadece kod sahibine ve ilgili kullanıcıya sınırlanmalı.

### 6) DÜŞÜK — Kimlik/lookup koleksiyonları geniş okuma
`userDirectory`, `usernames`, `chatCodes` giriş yapmış herkese okuma açıyor. Bu, kullanıcı adı/kod aramaları için tasarlanmış ve genelde kabul edilebilir; ancak buralarda **yalnızca herkese açık olması sakıncasız alanlar** (görünen ad, kod) tutulduğundan emin olunmalı — hassas alan (e-posta, telefon) tutulmamalı.

### 7) BİLGİ — Doğru tasarlanmış kurallar (referans için iyi örnekler)
`users/{userId}` (yalnız sahip/admin), `profiles/{uid}` (giriş yapan okur, sadece sahip yazar), `blogPosts`, `forumPosts`, `chats`/`messages` (katılımcı bazlı), `chatGroups` (üye bazlı) kuralları **doğru** şekilde sahip/üye/katılımcı bazlı yazılmış. Yukarıdaki geniş koleksiyonlar da bu desene taşınmalı.

## Neden şimdi kör daraltamıyoruz?

`KullaniciYonetimi.html` çapraz-firma üye ekleme/çıkarmayı istemci tarafında `collectionGroup('members')` sorgusu + doğrudan yazma ile yapıyor ve kod yorumunda bu yazmanın "tüm giriş yapmış kullanıcılara açık olması" gerektiği belirtilmiş. Kuralları bu akışı desteklemeden daraltırsak firma davet/üye yönetimi bozulur. Bu yüzden güvenli düzeltme iki adımlıdır:

1. **Ayrıcalıklı yazmaları Cloud Function'a taşı** (üye ekle/çıkar, davet oluştur/kabul, grup bağla). Fonksiyon, çağıran kullanıcının gerçekten firma sahibi/admini olduğunu doğrular.
2. **Kuralları daralt**: `firmaAccounts`, `companies`, `groups`, `invites`, `referrals` için okuma = üye/sahip; doğrudan istemci yazması = kapalı (yalnız fonksiyon/admin).

## Önerilen ara adım (düşük riskli, hemen uygulanabilir)

Eğer `companies` koleksiyonu artık kullanılmıyorsa (kod "eski/legacy" diyor), tamamen kapatmak anında bir saldırı yüzeyini kaldırır:
```
match /companies/{companyId} {
  allow read, write: if false;
  match /{document=**} { allow read, write: if false; }
}
```
(Önce uygulamada `companies` koleksiyonuna hâlâ yazan/okuyan bir yer kalmadığını doğrula.)

## Sonraki adım

Bu düzeltmeler deploy + test gerektirir ve firma özelliklerini etkileyebilir; bu yüzden kuralları senin onayın olmadan değiştirmedim. İstersen (1) `companies`'in kullanılıp kullanılmadığını tespit edip güvenle kapatmakla başlayalım, (2) ardından firma üye yönetimi için Cloud Function tasarlayıp kuralları adım adım daraltalım.
