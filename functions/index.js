/**
 * MMG Creativity — Blogger entegrasyonu (Cloud Functions v2)
 *
 * publishToBlogger: Sitede yayınlanmış bir blog yazısını Blogger blogunda yayınlar.
 *   - Sadece admin (users/{uid}.isAdmin == true) çağırabilir.
 *   - Yazı Firestore'da status:'published' olmalı.
 *   - Blogger'a gönderilince, yazıya bloggerPostId / bloggerUrl yazılır (tekrar gönderim engellenir).
 *
 * Gerekli secret'lar (firebase functions:secrets:set ... ile tanımlanır):
 *   BLOGGER_CLIENT_ID       — Google OAuth istemci kimliği
 *   BLOGGER_CLIENT_SECRET   — Google OAuth istemci sırrı
 *   BLOGGER_REFRESH_TOKEN   — blog sahibinin bir kerelik verdiği refresh token
 *   BLOGGER_BLOG_ID         — Blogger blogunun numeric blogId'si
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

// Blogger entegrasyonu (2026-07-31'de yeniden AÇILDI — kullanıcı isteği).
// ⚠️ ÖNEMLİ: Bu 4 secret Secret Manager'da TANIMLI OLMADAN `firebase deploy --only functions`
// çalıştırılırsa deploy değer sormaya başlar (bu yüzden bir süre kapatılmıştı). Deploy'dan
// ÖNCE dördünü de tanımlayın:
//   firebase functions:secrets:set BLOGGER_CLIENT_ID
//   firebase functions:secrets:set BLOGGER_CLIENT_SECRET
//   firebase functions:secrets:set BLOGGER_REFRESH_TOKEN
//   firebase functions:secrets:set BLOGGER_BLOG_ID
const BLOGGER_CLIENT_ID = defineSecret("BLOGGER_CLIENT_ID");
const BLOGGER_CLIENT_SECRET = defineSecret("BLOGGER_CLIENT_SECRET");
const BLOGGER_REFRESH_TOKEN = defineSecret("BLOGGER_REFRESH_TOKEN");
const BLOGGER_BLOG_ID = defineSecret("BLOGGER_BLOG_ID");

// Sitedeki renderBlogBody ile aynı basit markdown → HTML dönüşümü,
// böylece Blogger'daki yazı da düzgün biçimlenir.
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function mdToHtml(text) {
  return String(text || "")
    .split(/\n\s*\n/)
    .map((block) => {
      block = block.trim();
      if (!block) return "";
      if (block.startsWith("## ")) {
        return "<h2>" + escapeHtml(block.slice(3).trim()) + "</h2>";
      }
      const withBold = escapeHtml(block).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      return "<p>" + withBold.replace(/\n/g, "<br>") + "</p>";
    })
    .join("");
}

async function getAccessToken(clientId, clientSecret, refreshToken) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new HttpsError(
      "internal",
      "Google token alınamadı: " + (data.error_description || data.error || res.status)
    );
  }
  return data.access_token;
}

// ---- Blogger yayınlama (AKTİF) ----
exports.publishToBlogger = onCall(
  {
    region: "us-central1",
    secrets: [BLOGGER_CLIENT_ID, BLOGGER_CLIENT_SECRET, BLOGGER_REFRESH_TOKEN, BLOGGER_BLOG_ID],
  },
  async (request) => {
    const uid = request.auth && request.auth.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Giriş yapmanız gerekiyor.");
    }

    // Yalnızca admin yayınlayabilsin
    const userSnap = await admin.firestore().doc("users/" + uid).get();
    if (!userSnap.exists || userSnap.data().isAdmin !== true) {
      throw new HttpsError("permission-denied", "Bu işlemi yalnızca yönetici yapabilir.");
    }

    const postId = request.data && request.data.postId;
    if (!postId) {
      throw new HttpsError("invalid-argument", "postId gerekli.");
    }

    const postRef = admin.firestore().doc("blogPosts/" + postId);
    const postSnap = await postRef.get();
    if (!postSnap.exists) {
      throw new HttpsError("not-found", "Yazı bulunamadı.");
    }
    const post = postSnap.data();
    if (post.status !== "published") {
      throw new HttpsError("failed-precondition", "Sadece yayınlanmış yazılar Blogger'a gönderilebilir.");
    }
    if (post.bloggerPostId) {
      // Zaten gönderilmiş — tekrar oluşturmayı engelle
      return { alreadyPublished: true, id: post.bloggerPostId, url: post.bloggerUrl || null };
    }

    const accessToken = await getAccessToken(
      BLOGGER_CLIENT_ID.value(),
      BLOGGER_CLIENT_SECRET.value(),
      BLOGGER_REFRESH_TOKEN.value()
    );

    const blogId = BLOGGER_BLOG_ID.value();
    const res = await fetch(
      "https://www.googleapis.com/blogger/v3/blogs/" + encodeURIComponent(blogId) + "/posts/",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "blogger#post",
          title: post.title || "Başlıksız",
          content: mdToHtml(post.content),
        }),
      }
    );
    const bp = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new HttpsError(
        "internal",
        "Blogger'a gönderilemedi: " + ((bp.error && bp.error.message) || res.status)
      );
    }

    await postRef.update({
      bloggerPostId: bp.id || null,
      bloggerUrl: bp.url || null,
      bloggerPublishedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { ok: true, id: bp.id || null, url: bp.url || null };
  }
);
// ---- Blogger bloğu sonu ----

/* =====================================================================
 * FİRMA GÜVENLİĞİ — Ayrıcalıklı firma işlemleri (üye/yönetici ekle-çıkar,
 * davet, koltuk/kota). Bu işlemler ESKİDEN doğrudan istemciden Firestore'a
 * yazılıyordu ve kurallar "giriş yapan herkese" açıktı; bu yüzden bir
 * kullanıcı başka bir firmanın verisine erişebiliyordu. Artık bu işlemler
 * yalnızca burada, sunucuda yapılır ve admin yetkisi GÜVENİLİR kaynaktan
 * (firmaAccounts/{fid}/admins/{uid} veya createdBy) doğrulanır. (Kullanıcının
 * kendi yazabildiği users/{uid}.adminFirmaIds ASLA yetki kanıtı sayılmaz.)
 *
 * Dağıtım sırası (ÖNEMLİ):
 *   1) Bu fonksiyonları deploy et (mevcut davranışı bozmaz, çağrılana kadar pasif).
 *   2) İstemciyi (KullaniciYonetimi/Hesabim/chat-widget) bu fonksiyonları
 *      çağıracak şekilde güncelle ve test et.
 *   3) EN SON firestore.rules'ta firmaAccounts alt yazmalarını istemciye kapat.
 * ===================================================================== */
const db = () => admin.firestore();
const FieldValue = admin.firestore.FieldValue;

async function requireAuth(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Giriş yapmanız gerekiyor.");
  return uid;
}

// Çağıranın gerçekten bu firmanın yöneticisi olduğunu GÜVENİLİR kaynaktan doğrular.
async function assertFirmaAdmin(fid, uid) {
  if (!fid) throw new HttpsError("invalid-argument", "firmaId gerekli.");
  const fSnap = await db().doc("firmaAccounts/" + fid).get();
  if (!fSnap.exists) throw new HttpsError("not-found", "Firma bulunamadı.");
  if (fSnap.data().createdBy === uid) return fSnap;
  const adminSnap = await db().doc("firmaAccounts/" + fid + "/admins/" + uid).get();
  if (adminSnap.exists) return fSnap;
  throw new HttpsError("permission-denied", "Bu işlemi yalnızca firma yöneticisi yapabilir.");
}

// Bir kullanıcı kodunu (customerNumber) gerçek uid'e çözer.
async function resolveCodeToUid(code) {
  if (!code || !/^[0-9]+$/.test(String(code))) {
    throw new HttpsError("invalid-argument", "Geçerli bir kullanıcı kodu girin.");
  }
  const dirSnap = await db().doc("userDirectory/" + code).get();
  if (!dirSnap.exists || !dirSnap.data().uid) {
    throw new HttpsError("not-found", "Bu koda ait kullanıcı bulunamadı.");
  }
  return dirSnap.data().uid;
}

// Koltuk (seat) kotası kontrolü: firmaAccounts/{fid}.maxSeats tanımlıysa,
// mevcut üye + bekleyen davet sayısı bu sınırı aşamaz.
async function assertSeatAvailable(fid, firmaData) {
  const maxSeats = firmaData && typeof firmaData.maxSeats === "number" ? firmaData.maxSeats : null;
  if (maxSeats === null) return; // kota tanımlı değilse sınırsız (mevcut davranış)
  const membersSnap = await db().collection("firmaAccounts/" + fid + "/members").get();
  if (membersSnap.size >= maxSeats) {
    throw new HttpsError(
      "resource-exhausted",
      "Koltuk (kota) sınırına ulaşıldı (" + maxSeats + "). Yeni kişi eklemek için önce kota sayısını artırın."
    );
  }
}

const CALL_OPTS = { region: "us-central1" };

// Yönetici, kota sınırını belirler/günceller.
exports.firmaSetSeats = onCall(CALL_OPTS, async (request) => {
  const uid = await requireAuth(request);
  const { firmaId, maxSeats } = request.data || {};
  await assertFirmaAdmin(firmaId, uid);
  const val = (maxSeats === null || maxSeats === undefined) ? null : parseInt(maxSeats, 10);
  if (val !== null && (isNaN(val) || val < 1)) {
    throw new HttpsError("invalid-argument", "Kota en az 1 olmalı (veya sınırsız için boş).");
  }
  await db().doc("firmaAccounts/" + firmaId).set({ maxSeats: val }, { merge: true });
  return { ok: true, maxSeats: val };
});

// Yönetici, bir kullanıcı koduna ÜYE daveti oluşturur.
exports.firmaCreateMemberInvite = onCall(CALL_OPTS, async (request) => {
  const uid = await requireAuth(request);
  const { firmaId, memberCode, permissions } = request.data || {};
  const fSnap = await assertFirmaAdmin(firmaId, uid);
  await resolveCodeToUid(memberCode); // kodun gerçek olduğunu doğrula
  await assertSeatAvailable(firmaId, fSnap.data());
  await db().doc("firmaInvites/" + memberCode + "/firmas/" + firmaId).set({
    firmaId: firmaId,
    firmaName: fSnap.data().name || "",
    permissions: permissions || {},
    createdAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

// Yönetici, bir kullanıcı koduna YÖNETİCİ daveti oluşturur.
exports.firmaCreateAdminInvite = onCall(CALL_OPTS, async (request) => {
  const uid = await requireAuth(request);
  const { firmaId, memberCode } = request.data || {};
  const fSnap = await assertFirmaAdmin(firmaId, uid);
  await resolveCodeToUid(memberCode);
  await db().doc("firmaAdminInvites/" + memberCode).set({
    firmaId: firmaId,
    firmaName: fSnap.data().name || "",
    createdAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

// Davet edilen kişi, kendi daveti kabul eder (üye veya yönetici olur).
exports.firmaAcceptInvite = onCall(CALL_OPTS, async (request) => {
  const uid = await requireAuth(request);
  const { firmaId, kind } = request.data || {};
  if (!firmaId) throw new HttpsError("invalid-argument", "firmaId gerekli.");
  // Çağıranın kendi kodunu (customerNumber) güvenilir biçimde bul.
  const meSnap = await db().doc("users/" + uid).get();
  const myCode = meSnap.exists ? meSnap.data().customerNumber : null;
  if (!myCode) throw new HttpsError("failed-precondition", "Kullanıcı kodunuz bulunamadı.");
  const fSnap = await db().doc("firmaAccounts/" + firmaId).get();
  if (!fSnap.exists) throw new HttpsError("not-found", "Firma bulunamadı.");

  if (kind === "admin") {
    const invRef = db().doc("firmaAdminInvites/" + myCode);
    const invSnap = await invRef.get();
    if (!invSnap.exists || invSnap.data().firmaId !== firmaId) {
      throw new HttpsError("permission-denied", "Size ait bir yönetici daveti bulunamadı.");
    }
    await db().doc("firmaAccounts/" + firmaId + "/admins/" + uid).set({
      email: meSnap.data().email || "", addedAt: FieldValue.serverTimestamp(),
    });
    await db().doc("users/" + uid).set({ adminFirmaIds: FieldValue.arrayUnion(firmaId) }, { merge: true });
    await invRef.delete();
    return { ok: true, kind: "admin" };
  }

  // Üye daveti
  const invRef = db().doc("firmaInvites/" + myCode + "/firmas/" + firmaId);
  const invSnap = await invRef.get();
  if (!invSnap.exists) {
    throw new HttpsError("permission-denied", "Size ait bir üye daveti bulunamadı.");
  }
  await assertSeatAvailable(firmaId, fSnap.data());
  await db().doc("firmaAccounts/" + firmaId + "/members/" + uid).set({
    uid: uid,
    email: meSnap.data().email || "",
    username: meSnap.data().username || "",
    permissions: invSnap.data().permissions || {},
    joinedAt: FieldValue.serverTimestamp(),
  });
  await invRef.delete();
  return { ok: true, kind: "member" };
});

// Yönetici, bir üyeyi firmadan çıkarır.
exports.firmaRemoveMember = onCall(CALL_OPTS, async (request) => {
  const uid = await requireAuth(request);
  const { firmaId, memberUid } = request.data || {};
  await assertFirmaAdmin(firmaId, uid);
  if (!memberUid) throw new HttpsError("invalid-argument", "memberUid gerekli.");
  await db().doc("firmaAccounts/" + firmaId + "/members/" + memberUid).delete();
  await db().doc("users/" + memberUid).set(
    { adminFirmaIds: FieldValue.arrayRemove(firmaId) }, { merge: true }
  ).catch(() => {});
  return { ok: true };
});

// ============ Şifre Sıfırlama (kendi alan adından, markalı Türkçe e-posta) ============
// Firebase'in varsayılan reset maili spam'e düşüyor + İngilizce/kimliksiz görünüyor. Bunun yerine:
// Admin SDK ile bir şifre sıfırlama bağlantısı üretilir ve Resend üzerinden DOĞRULANMIŞ bir alan
// adından (SPF/DKIM/DMARC) Türkçe, markalı bir e-posta gönderilir. Böylece spam'e düşmez.
//
// Gerekli secret (bir kez):  firebase functions:secrets:set RESEND_API_KEY
// Gerekli DNS: Resend'in gönderen alan adı için verdiği SPF + DKIM kayıtları (DMARC önerilir).
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const MMG_LOGO_B64 = "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";
const RESET_FROM = "MMG Creativity <noreply@mmgcreativity.com>"; // Resend'de DOĞRULANMIŞ alan adı
const RESET_CONTINUE_URL = "https://mmgcreativity-31263.web.app/index.html"; // sıfırlama sonrası dönülecek adres

function resetEmailHtml(link) {
  // Sitenin (Dijital Finans Asistanı) gerçek paletiyle uyumlu, tablo tabanlı markalı şablon.
  // Renkler index.html ile aynı: zemin #0D1420, kart #141C2B, çizgi #2A3448, brass #C6A15B,
  // mercan #FF6B4A, metin #EAEDF3 / #B9C2D4, sönük #8D96AC. Logo GÖMÜLÜ (cid:mmglogo) → Outlook engellemez.
  var bgGrad = "radial-gradient(circle at 50% -10%, rgba(255,107,74,0.18), rgba(13,20,32,0) 55%), radial-gradient(circle at 100% 100%, rgba(62,143,224,0.16), rgba(13,20,32,0) 50%), linear-gradient(180deg, #16233C 0%, #101A2C 45%, #0D1420 100%)";
  return '<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head>' +
    '<body style="margin:0;padding:0;background:#101A2C;">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Şifrenizi güvenle sıfırlamak için tek dokunuş — MMG Creativity.</div>' +
    // Dış zemin: sitenin hero\'sundaki gibi renkli degrade parıltı (düz siyah değil). Outlook düz renge düşer.
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#101A2C;background-image:' + bgGrad + ';padding:38px 12px;">' +
      '<tr><td align="center">' +
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">' +
          // Üst marka bandı — sitedeki hero ile aynı kimlik
          '<tr><td align="center" style="padding:6px 0 26px;">' +
            '<img src="cid:mmglogo" width="64" height="64" alt="MMG Creativity" style="display:block;border-radius:16px;margin:0 auto 12px;border:1px solid #33405C;box-shadow:0 8px 22px rgba(0,0,0,0.45);">' +
            '<div style="font-family:\'Segoe UI\',Arial,sans-serif;font-size:24px;font-weight:700;letter-spacing:.2px;color:#D8B673;">MMG Creativity</div>' +
            '<div style="font-family:Arial,sans-serif;font-size:12.5px;color:#9AA4BC;margin-top:3px;letter-spacing:.5px;">Dijital Finans Asistanı</div>' +
          '</td></tr>' +
          // Kart — hafif degradeli yüzey + parlak üst kenar
          '<tr><td style="background:#182338;background-image:linear-gradient(180deg,#1B2740 0%,#151F33 100%);border:1px solid #2E3B55;border-top:2px solid #FF6B4A;border-radius:16px;padding:34px 36px 30px;box-shadow:0 18px 44px rgba(0,0,0,0.45);">' +
            '<h1 style="font-family:\'Segoe UI\',Arial,sans-serif;font-size:22px;line-height:1.3;margin:0 0 14px;color:#F1F4FA;">Şifrenizi sıfırlayın</h1>' +
            '<p style="font-family:Arial,sans-serif;font-size:14.5px;line-height:1.75;color:#C2CBDD;margin:0 0 28px;">Hesabınız için bir şifre sıfırlama talebi aldık. Yeni şifrenizi belirlemek için aşağıdaki butona tıklayın. Bağlantı kısa süre geçerlidir. Bu talebi <b style="color:#F1F4FA;">siz yapmadıysanız</b> bu e-postayı güvenle yok sayabilirsiniz.</p>' +
            // 3D degradeli buton: gradient + gölge + üst iç parlaklık (Outlook düz mercana düşer)
            '<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 26px;"><tr>' +
              '<td align="center" bgcolor="#FF6B4A" style="border-radius:14px;background-image:linear-gradient(180deg,#FF8163 0%,#FF5A36 100%);box-shadow:0 10px 22px rgba(255,90,54,0.42), inset 0 1px 0 rgba(255,255,255,0.35);">' +
                '<a href="' + link + '" style="display:inline-block;padding:16px 48px;font-family:\'Segoe UI\',Arial,sans-serif;font-size:16.5px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:14px;text-shadow:0 1px 1px rgba(0,0,0,0.25);">Şifremi Sıfırla &rarr;</a>' +
              '</td>' +
            '</tr></table>' +
            '<div style="border-top:1px solid #2E3B55;margin:6px 0 16px;"></div>' +
            '<p style="font-family:Arial,sans-serif;font-size:12px;line-height:1.65;color:#8D96AC;margin:0;">Buton çalışmazsa bu bağlantıyı kopyalayıp tarayıcınıza yapıştırın:<br>' +
              '<a href="' + link + '" style="color:#5AA2E8;word-break:break-all;">' + link + '</a></p>' +
          '</td></tr>' +
          // Alt bilgi
          '<tr><td align="center" style="padding:24px 10px 4px;">' +
            '<p style="font-family:Arial,sans-serif;font-size:11.5px;line-height:1.6;color:#7A85A0;margin:0;">Bu e-posta şifre sıfırlama talebiniz üzerine gönderildi.<br>© 2026 <a href="https://mmgcreativity.com" style="color:#9AA4BC;text-decoration:none;">MMG Creativity</a> · Tüm hakları saklıdır.</p>' +
          '</td></tr>' +
        '</table>' +
      '</td></tr>' +
    '</table></body></html>';
}

exports.sendPasswordResetMail = onCall(
  { region: "us-central1", secrets: [RESEND_API_KEY] },
  async (request) => {
    const email = request.data && String(request.data.email || "").trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new HttpsError("invalid-argument", "Geçerli bir e-posta adresi girin.");
    }
    // Sıfırlama bağlantısını üret. Kullanıcı yoksa, hesabın var olup olmadığını sızdırmamak için
    // yine de başarılı gibi dönüyoruz (güvenlik: e-posta numaralandırma saldırısını engelle).
    let link;
    try {
      link = await admin.auth().generatePasswordResetLink(email, { url: RESET_CONTINUE_URL });
      // Firebase varsayılan olarak lang=en ekleyebiliyor → sıfırlama sayfası İngilizce açılıyor.
      // Türkçe açılması için lang parametresini tr yap (yoksa ekle).
      try {
        link = /[?&]lang=/.test(link)
          ? link.replace(/([?&]lang=)[^&]*/i, "$1tr")
          : link + (link.indexOf("?") >= 0 ? "&" : "?") + "lang=tr";
      } catch (e2) { /* link biçimi beklenmedikse dokunma */ }
    } catch (e) {
      if (e && (e.code === "auth/user-not-found" || e.code === "auth/email-not-found")) {
        return { ok: true };
      }
      console.error("generatePasswordResetLink hata:", e);
      throw new HttpsError("internal", "Sıfırlama bağlantısı üretilemedi.");
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + RESEND_API_KEY.value(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESET_FROM,
        to: [email],
        subject: "MMG Creativity — Şifre Sıfırlama",
        html: resetEmailHtml(link),
        // Logo GÖMÜLÜ ek (inline). content_id ile HTML'deki <img src="cid:mmglogo"> eşleşir;
        // böylece Outlook "uzak görsel engellendi" demeden logoyu gösterir.
        attachments: [{
          filename: "mmg-logo.png",
          content: MMG_LOGO_B64,
          content_id: "mmglogo",
          content_type: "image/png",
          disposition: "inline",
        }],
      }),
    });
    if (!res.ok) {
      const info = await res.text().catch(() => "");
      console.error("Resend gönderim hatası:", res.status, info);
      throw new HttpsError("internal", "E-posta gönderilemedi.");
    }
    return { ok: true };
  }
);

// ============ #16 Mobil Push (FCM) — uygulama kapalıyken telefona/masaüstüne bildirim ============
// `notifications` koleksiyonuna yeni belge yazıldığında (window.mmgNotify), alıcının kayıtlı FCM
// token'larına DATA-ONLY push gönderir. Böylece uygulama KAPALIYKEN de bildirim düşer. Uygulama-içi
// çan/badge zaten Firestore onSnapshot ile çalışıyor; bu yalnızca ek "kapalıyken push" katmanıdır.
//
// Gereksinim: Blaze planı (functions). Token'lar users/{uid}/fcmTokens/{token} altında; istemci
// (index.html mmgRegisterPushToken) yazar. Bu fonksiyon Admin SDK ile okur (kurallardan bağımsız).
// Data-only gönderilir; bildirimi service worker (firebase-messaging-service-worker.js) gösterir.
exports.pushOnNotification = onDocumentCreated(
  { region: "us-central1", document: "notifications/{notifId}" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const n = snap.data() || {};
    const toUid = n.toUid;
    if (!toUid) return;

    const tokensSnap = await db().collection("users/" + toUid + "/fcmTokens").get();
    if (tokensSnap.empty) return;
    const tokens = tokensSnap.docs.map((d) => (d.data() && d.data().token) || d.id).filter(Boolean);
    if (!tokens.length) return;

    const message = {
      tokens: tokens,
      data: {
        title: String(n.title || "MMG Creativity"),
        body: String(n.body || ""),
        type: String(n.type || ""),
        notifId: String(event.params.notifId || ""),
      },
    };

    let resp;
    try {
      resp = await admin.messaging().sendEachForMulticast(message);
    } catch (e) {
      console.error("pushOnNotification gönderim hatası:", e);
      return;
    }

    // Geçersiz / süresi dolmuş token'ları temizle.
    const cleanups = [];
    resp.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error && r.error.code;
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token" ||
        code === "messaging/invalid-argument"
      ) {
        cleanups.push(tokensSnap.docs[i].ref.delete().catch(() => {}));
      }
    });
    await Promise.all(cleanups);
  }
);

// ============ Referans kullanıldığında ADMIN'lere bildirim ============
// referralSignups/{id} oluşturulduğunda (biri referans koduyla kayıt olduğunda), tüm admin
// (users.isAdmin == true) hesaplarına bir 'notifications' kaydı yazar. Bu kayıt hem uygulama-içi
// çan/toast'ta görünür hem de yukarıdaki pushOnNotification ile FCM push olarak telefona/masaüstüne
// gider. Kod SAHİBİNE bildirim zaten istemci tarafında (index.html kayıt akışı) yazılıyor; bu
// fonksiyon EK olarak ADMIN'i bilgilendirir. Admin uid'sini istemci bulamadığı için burada (Admin
// SDK, kurallardan bağımsız) yapılır.
exports.notifyAdminsOnReferralSignup = onDocumentCreated(
  { region: "us-central1", document: "referralSignups/{signupId}" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const s = snap.data() || {};
    const adminsSnap = await db().collection("users").where("isAdmin", "==", true).get();
    if (adminsSnap.empty) return;
    const name = s.newUserName || s.newUserEmail || "Bir kullanıcı";
    const code = s.code || "";
    const writes = [];
    adminsSnap.forEach((d) => {
      writes.push(db().collection("notifications").add({
        toUid: d.id,
        fromUid: s.newUserUid || null,
        type: "referral",
        title: "🎁 Referans kodu kullanıldı",
        body: name + " — \"" + code + "\" referans koduyla kayıt oldu.",
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      }));
    });
    await Promise.all(writes);
  }
);

/* =====================================================================
 * ÇOKLU HESAP DEĞİŞTİRME (admin hesabından, sahip olunan diğer hesaplara
 * şifresiz geçiş — özel token ile).
 *
 * Model:
 *   - Grup sahibi = isAdmin === true olan hesap (adminUid).
 *   - Bağlı hesaplar: users/{adminUid}.linkedAccounts = [{ uid, email }]
 *   - Her bağlı hesabın dokümanında: users/{targetUid}.switchOwnerUid = adminUid
 *   - Grup = [adminUid, ...linkedAccounts.uid]. Grup üyeleri birbirine geçebilir.
 *
 * accountLinkConfirm({ targetIdToken }):
 *   - Çağıran admin olmalı. targetIdToken, hedef hesabın (ikincil app ile bir
 *     kez şifreyle girilerek alınan) kimlik token'ı. Şifre HİÇBİR YERDE saklanmaz.
 *   - Token doğrulanır → hedef uid/email admin'e bağlanır.
 *
 * accountSwitchToken({ targetUid }):
 *   - Çağıran, hedefle aynı gruptaysa hedef için özel token döner.
 * ===================================================================== */

exports.accountLinkConfirm = onCall(CALL_OPTS, async (request) => {
  const uid = await requireAuth(request);
  const callerSnap = await db().doc("users/" + uid).get();
  if (!callerSnap.exists || callerSnap.data().isAdmin !== true) {
    throw new HttpsError("permission-denied", "Hesap bağlama yalnızca admin hesabıyla yapılabilir.");
  }
  const { targetIdToken } = request.data || {};
  if (!targetIdToken) throw new HttpsError("invalid-argument", "Hedef hesap kimlik token'ı gerekli.");

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(String(targetIdToken));
  } catch (e) {
    throw new HttpsError("unauthenticated", "Hedef hesap doğrulanamadı. E-posta/şifreyi kontrol edin.");
  }
  const targetUid = decoded.uid;
  const targetEmail = decoded.email || "";
  if (targetUid === uid) {
    throw new HttpsError("invalid-argument", "Zaten bu hesaptasınız; kendinizi bağlayamazsınız.");
  }

  // Hedef hesabın dokümanına grup sahibini yaz (admin SDK kuralları aşar).
  await db().doc("users/" + targetUid).set({ switchOwnerUid: uid }, { merge: true });
  // Admin'in bağlı hesaplar listesine ekle (varsa güncelle).
  const adminData = callerSnap.data();
  const list = Array.isArray(adminData.linkedAccounts) ? adminData.linkedAccounts.slice() : [];
  const existing = list.findIndex((x) => x && x.uid === targetUid);
  if (existing >= 0) list[existing] = { uid: targetUid, email: targetEmail };
  else list.push({ uid: targetUid, email: targetEmail });
  await db().doc("users/" + uid).set({ linkedAccounts: list }, { merge: true });

  return { ok: true, uid: targetUid, email: targetEmail };
});

exports.accountSwitchToken = onCall(CALL_OPTS, async (request) => {
  const uid = await requireAuth(request);
  const { targetUid } = request.data || {};
  if (!targetUid) throw new HttpsError("invalid-argument", "Hedef hesap gerekli.");

  const callerSnap = await db().doc("users/" + uid).get();
  const caller = callerSnap.exists ? callerSnap.data() : {};
  const adminUid = caller.isAdmin === true ? uid : caller.switchOwnerUid;
  if (!adminUid) {
    throw new HttpsError("permission-denied", "Bu hesap bir geçiş grubuna ait değil.");
  }

  const adminSnap = await db().doc("users/" + adminUid).get();
  if (!adminSnap.exists || adminSnap.data().isAdmin !== true) {
    throw new HttpsError("permission-denied", "Geçiş grubu sahibi bulunamadı.");
  }
  const linked = Array.isArray(adminSnap.data().linkedAccounts) ? adminSnap.data().linkedAccounts : [];
  const group = [adminUid].concat(linked.map((x) => x && x.uid).filter(Boolean));
  if (group.indexOf(targetUid) === -1) {
    throw new HttpsError("permission-denied", "Bu hesaba geçme yetkiniz yok.");
  }

  const token = await admin.auth().createCustomToken(targetUid);
  return { token: token };
});

exports.accountUnlink = onCall(CALL_OPTS, async (request) => {
  const uid = await requireAuth(request);
  const callerSnap = await db().doc("users/" + uid).get();
  if (!callerSnap.exists || callerSnap.data().isAdmin !== true) {
    throw new HttpsError("permission-denied", "Bu işlem yalnızca admin hesabıyla yapılabilir.");
  }
  const { targetUid } = request.data || {};
  if (!targetUid) throw new HttpsError("invalid-argument", "Hedef hesap gerekli.");
  const list = (Array.isArray(callerSnap.data().linkedAccounts) ? callerSnap.data().linkedAccounts : [])
    .filter((x) => x && x.uid !== targetUid);
  await db().doc("users/" + uid).set({ linkedAccounts: list }, { merge: true });
  await db().doc("users/" + targetUid).set({ switchOwnerUid: FieldValue.delete() }, { merge: true });
  return { ok: true };
});
