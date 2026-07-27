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
const RESET_FROM = "MMG Creativity <noreply@mmgcreativity.com>"; // Resend'de DOĞRULANMIŞ alan adı
const RESET_CONTINUE_URL = "https://mmgcreativity-31263.web.app/index.html"; // sıfırlama sonrası dönülecek adres

function resetEmailHtml(link) {
  return '<!DOCTYPE html><html lang="tr"><body style="margin:0;background:#0D1420;font-family:Arial,Helvetica,sans-serif;color:#EAEDF3;">' +
    '<div style="max-width:520px;margin:0 auto;padding:32px 24px;">' +
      '<div style="text-align:center;margin-bottom:24px;"><span style="font-size:22px;font-weight:700;color:#C6A15B;">MMG Creativity</span></div>' +
      '<div style="background:#141C2B;border:1px solid #2A3448;border-radius:14px;padding:28px 26px;">' +
        '<h1 style="font-size:19px;margin:0 0 14px;color:#EAEDF3;">Şifrenizi sıfırlayın</h1>' +
        '<p style="font-size:14px;line-height:1.6;color:#D3D8E2;margin:0 0 20px;">Hesabınız için bir şifre sıfırlama talebi aldık. Yeni şifrenizi belirlemek için aşağıdaki butona tıklayın. Bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>' +
        '<div style="text-align:center;margin:24px 0;"><a href="' + link + '" style="display:inline-block;background:#D6407A;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 28px;border-radius:10px;">Şifremi Sıfırla</a></div>' +
        '<p style="font-size:12px;line-height:1.6;color:#8D96AC;margin:16px 0 0;">Buton çalışmazsa bu bağlantıyı tarayıcınıza yapıştırın:<br><a href="' + link + '" style="color:#3E8FE0;word-break:break-all;">' + link + '</a></p>' +
      '</div>' +
      '<p style="text-align:center;font-size:11px;color:#8D96AC;margin-top:20px;">© 2026 MMG Creativity · Bu e-posta şifre sıfırlama talebiniz üzerine gönderildi.</p>' +
    '</div></body></html>';
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
