// === createUser.js ===
const { google } = require("googleapis");
const key = require("./service-account.json");
const { insertGsuiteUser } = require("./apicurl");

// Super admin di domain utama (HARUS punya akses ke semua domain)
const ADMIN_EMAIL = "adminsuper@nernir.com";

// Fungsi utama untuk membuat user
async function createUser(username, domain, chatId, invoice, password, expiredDate) {
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/admin.directory.user"],
    subject: ADMIN_EMAIL,
  });

  const service = google.admin({ version: "directory_v1", auth });
  const email = `${username}@${domain}`;
  const givenName = username;
  const familyName = domain.split(".")[0];

  try {
    console.log(`🚀 [CREATE] Membuat user: ${email}`);
    const res = await service.users.insert({
      requestBody: {
        name: { givenName, familyName },
        password,
        primaryEmail: email,
      },
    });

    await insertGsuiteUser(chatId, invoice, email, password, expiredDate);

    return { email, password };
  } catch (err) {
    console.error(`❌ Gagal membuat user: ${email}`);
    console.error("📄 Detail error:", JSON.stringify(err.errors || err, null, 2));
    console.error("📜 Message:", err.message);
    return null;
  }
}

module.exports = { createUser };
