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
