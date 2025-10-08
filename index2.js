const TelegramBot = require('node-telegram-bot-api');
const moment = require('moment-timezone');
const { deleteExpiredGsuite } = require('./deleteExpiredUsers');


const telegramToken = '8430362255:AAE3RAQ9zpGLVBqhw-gqDVYdbwB0_KIdPEM';
const {
  insertOrder,
  getOrdersByUser,
  insertUser,
  getQrIdByOrderId,
  updateOrderStatus,
  getOrderById,
  getUserDomain,
  updateUserDomain,
  getUserPassword,
  updateUserPassword,
  getTotalTransaksiByChatId,
  getTotalTransaksiSemuaUser,
  getTotalUsers,
} = require('./apicurl.js');
const { createQRIS, checkQrisStatus } = require('./qris.js');
const fs = require('fs');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { createUser } = require('./gsuite.js');
const { text } = require('stream/consumers');

const bot = new TelegramBot(telegramToken, { polling: true });
const userOrders = {};

// Panggil saat bot start
deleteExpiredGsuite();

// Set interval tiap 10 menit (600.000 ms)
setInterval(() => {
  deleteExpiredGsuite();
}, 10 * 60 * 1000);

// ==================== Utility ====================
const awaitingPasswordInput = new Map();

function escapeMarkdown(text) {
  if (!text) return '';              // ini sudah ada, tapi masih bisa error kalau misal text = 0 atau objek
  if (typeof text !== 'string') {
    text = String(text);
  }
  return text
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/~/g, '\\~')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}

function formatDateLong(date) {
  const options = {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta",
    hour12: false,
  };
  let str = date.toLocaleString("id-ID", options)
    .replace(",", "")
    .replace(/\./g, ":")
    .replace(/(\d{4})\s/, "$1 – ");
  return str;
}
function generateInvoiceNumber() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const datePart = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}`;
  const randomPart = Array.from({ length: 5 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join('');
  return `PREMISUITE-${datePart}-${randomPart}`;
}


function formatDateWithDay(date) {
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const months = [
    'Januari','Februari','Maret','April','Mei','Juni',
    'Juli','Agustus','September','Oktober','November','Desember'
  ];

  const m = moment(date).tz('Asia/Jakarta');

  const dayName = days[m.day()];
  const day = m.date().toString().padStart(2, '0');
  const month = months[m.month()];
  const year = m.year();

  const hours = m.hour().toString().padStart(2, '0');
  const minutes = m.minute().toString().padStart(2, '0');
  const seconds = m.second().toString().padStart(2, '0');

  return `${dayName}, ${day} ${month} ${year} – ${hours}:${minutes}:${seconds}`;
}

const availableDomains = ['cegil.id', 'cogil.id', 'yqhoo.id', 'gmqil.id'];

// ⏬ Fungsi bantu buat caption dinamis
function getDomainCaption(selectedDomain) {
  return `
🌐 *Update Domain*

*Domain GSuite saat ini:* ${selectedDomain || 'Belum dipilih'}

Pilih domain yang tersedia di bawah ini:

${availableDomains.map(d => `${d === selectedDomain ? '✅' : '◽️'} ${d}`).join('\n')}

  `.trim();
}

// ⏬ Fungsi bantu buat tombol inline
function getDomainKeyboard(selectedDomain) {
  const domainButtons = availableDomains.map(domain => [{
    text: `${domain === selectedDomain ? '✅' : '◽️'} ${domain}`,
    callback_data: `select_domain:${domain}`
  }]);

  domainButtons.push([
    { text: '↩️ Kembali ke Pengaturan', callback_data: 'settings' }
  ]);

  return { inline_keyboard: domainButtons };
}

function formatShortDate(date) {
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} - ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// ==================== Main Menu ====================
async function sendMainMenu(chatId, username) {
  const saldo = 0;
  const now = new Date();
  const formattedDate = formatDateWithDay(now);
  const { total_transaksi: totalTransaksiUser } = await getTotalTransaksiByChatId(chatId);
  const { total_transaksi: totalTransaksiGlobal } = await getTotalTransaksiSemuaUser();
  const totalUser = await getTotalUsers()

  const caption = `
Halo ${username} 👋🏼
*${formattedDate}*

*User Info*
└ *ID:* \`${chatId}\`
└ *Username:* @${escapeMarkdown(username)}
└ *Transaksi:* Rp. ${totalTransaksiUser}
└ *Saldo Pengguna*: Rp${saldo.toLocaleString()}

*BOT Stats: *
└ *Total Transaksi:* ${totalTransaksiGlobal}
└ *Total User:* ${totalUser}

*Harga Paket:*
└ *1 Hari:* Rp100
└ *3 Hari:* Rp300
└ *7 Hari:* Rp500
`;

  bot.sendPhoto(chatId, './baner.png', {
    caption,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🛒 Order', callback_data: 'order' },
          { text: '📜 History', callback_data: 'history_0' },
        ],
        [
          { text: 'ℹ️ Info', callback_data: 'info' },
          { text: '⚙️ Settings', callback_data: 'settings' },
        ],
      ],
    },
  });
    bot.sendMessage(chatId, "⬇️ Tekan tombol di bawah untuk kirim /start lagi", {
    reply_markup: {
      keyboard: [[{ text: "/start" }]],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  });
}
async function cancelMenu(chatId, username) {
    const saldo = 0;
  const now = new Date();
  const formattedDate = formatDateWithDay(now);
  const { total_transaksi: totalTransaksiUser } = await getTotalTransaksiByChatId(chatId);
  const { total_transaksi: totalTransaksiGlobal } = await getTotalTransaksiSemuaUser();
  const totalUser = await getTotalUsers()

  const caption = `
Halo ${username} 👋🏼
*${formattedDate}*

*User Info*
└ *ID:* \`${chatId}\`
└ *Username:* @${escapeMarkdown(username)}
└ *Transaksi:* Rp. ${totalTransaksiUser}
└ *Saldo Pengguna*: Rp${saldo.toLocaleString()}

*BOT Stats: *
└ *Total Transaksi:* ${totalTransaksiGlobal}
└ *Total User:* ${totalUser}

*Harga Paket:*
└ *1 Hari:* Rp100
└ *3 Hari:* Rp300
└ *7 Hari:* Rp500
`;
  bot.sendPhoto(chatId, './baner.png', {
    caption,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🛒 Order', callback_data: 'order' },
          { text: '📜 History', callback_data: 'history_0' },
        ],
        [
          { text: 'ℹ️ Info', callback_data: 'info' },
          { text: '⚙️ Settings', callback_data: 'settings' },
        ],
      ],
    },
  });

}
//==================== Kembali ==================================
async function kembali(chatId, messageId, username) {
    const saldo = 0;
  const now = new Date();
  const formattedDate = formatDateWithDay(now);
  const { total_transaksi: totalTransaksiUser } = await getTotalTransaksiByChatId(chatId);
  const { total_transaksi: totalTransaksiGlobal } = await getTotalTransaksiSemuaUser();
  const totalUser = await getTotalUsers()

  const caption = `
Halo ${username} 👋🏼
*${formattedDate}*

*User Info*
└ *ID:* \`${chatId}\`
└ *Username:* @${escapeMarkdown(username)}
└ *Transaksi:* Rp. ${totalTransaksiUser}
└ *Saldo Pengguna*: Rp${saldo.toLocaleString()}

*BOT Stats: *
└ *Total Transaksi:* ${totalTransaksiGlobal}
└ *Total User:* ${totalUser}

*Harga Paket:*
└ *1 Hari:* Rp100
└ *3 Hari:* Rp300
└ *7 Hari:* Rp500
`;

  await bot.editMessageCaption(caption, {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🛒 Order', callback_data: 'order' },
          { text: '📜 History', callback_data: 'history_0' },
        ],
        [
          { text: 'ℹ️ Info', callback_data: 'info' },
          { text: '⚙️ Settings', callback_data: 'settings' },
        ],
      ],
    },
  });
}

// ==================== Order Text & Keyboard ====================
function buildOrderText(order) {
  const selectedJumlah = order.jumlah.replace('✅ ', '');
  const selectedDurasi = order.durasi.replace('✅ ', '');
  const selectedTipe = order.tipe.replace('✅ ', '');

  // escapeMarkdown hanya di sini
  const mark = (value, selected) => (value === selected ? `✅ *${escapeMarkdown(value)}*` : `◽️ ${escapeMarkdown(value)}`);

  const jumlahOptions = ['2 PCS', '50 PCS', '100 PCS'];
  const durasiOptions = ['1 Hari', '3 Hari', '7 Hari'];
  const tipeOptions = ['Urut', 'Random'];

  return `
*🗂️ Pesanan GSuite Kamu*

*📦 Jumlah Produk*
${jumlahOptions.map(j => mark(j, selectedJumlah)).join('\n')}

*🕐 Durasi Produk*
${durasiOptions.map(d => mark(d, selectedDurasi)).join('\n')}

*⚙️ Tipe Produk*
${tipeOptions.map(t => mark(t, selectedTipe)).join('\n')}

────────────────
🧾 *Informasi Order*
• *Jumlah:* ${selectedJumlah}
• *Durasi:* ${selectedDurasi}
• *Tipe:* ${selectedTipe}
• *Harga Satuan:* Rp${order.harga.toLocaleString()}
• *Total:* Rp${order.total.toLocaleString()}
`;
}


function buildOrderKeyboard(order) {
  const mark = (v, s) => (v === s.replace('✅ ', '') ? `✅ ${v}` : `◽️ ${v}`);
  const jumlah = order.jumlah.replace('✅ ', '');
  const durasi = order.durasi.replace('✅ ', '');
  const tipe = order.tipe.replace('✅ ', '');

  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: mark('2 PCS', jumlah), callback_data: 'jumlah_2 PCS' },
          { text: mark('50 PCS', jumlah), callback_data: 'jumlah_50 PCS' },
          { text: mark('100 PCS', jumlah), callback_data: 'jumlah_100 PCS' },
        ],
        [
          { text: mark('1 Hari', durasi), callback_data: 'durasi_1 Hari' },
          { text: mark('3 Hari', durasi), callback_data: 'durasi_3 Hari' },
          { text: mark('7 Hari', durasi), callback_data: 'durasi_7 Hari' },
        ],
        [
          { text: mark('Urut', tipe), callback_data: 'tipe_Urut' },
          { text: mark('Random', tipe), callback_data: 'tipe_Random' },
        ],
        [
          { text: '🛒 Konfirmasi Order', callback_data: 'beli_produk' },
          { text: '↩️ Kembali', callback_data: 'kembali' },
        ],
      ],
    },
  };
}



// ==================== Bot Handlers ====================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || 'unknown';
  const domain = 'cegil.com'
  const password = 'Masuk123'
  await insertUser(chatId, username, domain, password);
  sendMainMenu(chatId, username);
});
bot.onText(/\/settings/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || 'unknown';

  const domain = await getUserDomain(chatId);
  const password = await getUserPassword(chatId);

  const caption = `
⚙️ *Pengaturan GSuite*
└ *Domain:* ${domain}
└ *Password:* ${password}

Silakan pilih pengaturan yang ingin diubah:
  `;

  const keyboard = {
    inline_keyboard: [
      [{ text: '🔄 Update Domain', callback_data: 'update_domain' }],
      [{ text: '🔑 Update Password', callback_data: 'update_password' }],
      [{ text: '↩️ Kembali', callback_data: 'kembali' }]
    ]
  };

  try {
    await bot.sendPhoto(chatId, './baner.png', {
      caption,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  } catch (error) {
    console.error('❌ Gagal mengirim foto dan caption:', error.message);
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (awaitingPasswordInput.has(chatId)) {
    // Validasi password
    const isValid = /^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]{8,16}$/.test(text);

    if (!isValid) {
      await bot.sendMessage(chatId, `❌ Password tidak valid.

*Ketentuan:*
• Panjang 8–16 karakter
• Hanya huruf, angka, dan simbol umum`, { parse_mode: 'Markdown' });
      return;
    }

    // Simpan password
    await updateUserPassword(chatId, text);
    awaitingPasswordInput.delete(chatId);

    await bot.sendMessage(chatId, `✅ Password berhasil diperbarui menjadi: \`${text}\``, {
      parse_mode: 'Markdown'
    });
  }
});

bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;
  const chatId = msg.chat.id;
  const username = msg.from.username || 'unknown';
  const msgId = callbackQuery.message.message_id;
   const usernamed = callbackQuery.from.username || "unknown"; 
  // ==================== CEK PEMBAYARAN ====================
 if (data.startsWith("cek_pembayaran_")) {
  const orderId = data.split("_")[2];
  const qrId = await getQrIdByOrderId(orderId);
  const order = await getOrderById(orderId);

  if (!order) return bot.sendMessage(chatId, "❌ Order tidak ditemukan di database.");

  // Fungsi format tanggal ke string dengan WIB (UTC+7)
  const formatDateLong = (date) => {
    const wibOffset = 7 * 60 * 60 * 1000; // +7 jam dalam ms
    const wibDate = new Date(date.getTime() + wibOffset);
    const pad = (n) => n.toString().padStart(2, "0");
    return `${wibDate.getFullYear()}-${pad(wibDate.getMonth() + 1)}-${pad(wibDate.getDate())} ${pad(
      wibDate.getHours()
    )}:${pad(wibDate.getMinutes())}:${pad(wibDate.getSeconds())}`;
  };

  // Dapatkan expired date dari created_at + durasi
  const expiredDate = new Date(order.created_at);
  const jumlahHari = parseInt(order.durasi_produk.split(" ")[0]);
  expiredDate.setDate(expiredDate.getDate() + jumlahHari);

  const newExpired = formatDateLong(expiredDate); // Expired date formatted WIB
  const orderDateFormatted = formatDateLong(new Date(order.tanggal_order)); // Order date formatted WIB

  const domainFromDb = await getUserDomain(chatId);
  const domain = domainFromDb || "Belum disetel";

  // 🔒 Anti duplikasi
  if (order.status === "Pembayaran Diterima" || order.status === "Selesai") {
    return bot.answerCallbackQuery({
      callback_query_id: callbackQuery.id,
      text: "✅ Order ini sudah dibayar dan sedang/sudah diproses.",
      show_alert: true,
    });
  }

  const isPaid = await checkQrisStatus(qrId);

  if (["INACTIVE", "ACTIVE", "SUCCESS", "PAID"].includes(isPaid)) {
    await updateOrderStatus(orderId, "Pembayaran Diterima");

    const jumlahProduk = parseInt(order.jumlah_produk);
    const invoice = order.invoice;
    const tipe = order.tipe_produk.toLowerCase();
    const password = await getUserPassword(chatId);

    const usernames = Array.from({ length: jumlahProduk }, (_, i) => {
      if (tipe === "urut") return `usr${invoice.slice(-4)}${i + 1}`;
      else return `usr${Math.random().toString(36).substring(2, 7)}`;
    });

    // Kirim newExpired ke createUser sebagai tanggal expired
    const results = await Promise.allSettled(
      usernames.map((u) => createUser(u, domain, chatId, invoice, password, newExpired))
    );

    const credentials = results.map((r, i) =>
      r.status === "fulfilled" && r.value
        ? `${r.value.email.toLowerCase()}`
        : `❌ Gagal buat user: ${`${usernames[i]}@${domain}`.toLowerCase()}`
    );

    const fileName = `${invoice}.txt`;
    fs.writeFileSync(fileName, credentials.join("\n"));

    const firstSuccess = results.find((r) => r.status === "fulfilled" && r.value);
    const firstEmail = firstSuccess?.value?.email || "N/A";
    const firstPassword = firstSuccess?.value?.password || "N/A";
    const firstId = firstEmail.split("@")[0].replace(/\d+$/, "").toLowerCase();

    // ✅ Kirim pesan sukses utama
    const successMessage = `
✅ *PEMBAYARAN BERHASIL!*
─────────────────────
Terima kasih 🎉 Pesanan kamu telah diproses dan akun GSuite berhasil dibuat.

🧾 *INFORMASI ORDER*
├ 🧩 Nomor Invoice : ${invoice}
├ 📅 Tanggal Order : ${orderDateFormatted}
└ 💳 Metode Bayar  : ${escapeMarkdown(order.metode_pembayaran)}

📦 *RINCIAN PESANAN*
├ 🏷️ Produk        : ${escapeMarkdown(order.tipe_produk)}
├ ⏳ Durasi        : ${escapeMarkdown(order.durasi_produk)}
├ 📦 Jumlah        : ${escapeMarkdown(order.jumlah_produk)} 
├ 💸 Harga Satuan  : Rp${order.harga_satuan.toLocaleString()}
└ 💰 Total Bayar   : Rp${order.total_harga.toLocaleString()}

📂 File daftar akun GSuite akan dikirim di bawah ini ⬇️
`;

    await bot.editMessageCaption(successMessage, {
      chat_id: chatId,
      message_id: msgId,
      parse_mode: "Markdown",
    });

    // ✅ Kirim file akun
    const docCaption = `
🔰 *Google GSuite*

📦 *Transaksi*
• *Invoice*: \`${invoice}\`
• *Tanggal*: ${orderDateFormatted}

🧩 *Produk*
• *Nama*: Google GSuite
• *Durasi*: ${escapeMarkdown(order.durasi_produk)}
• *Tipe*: ${escapeMarkdown(order.tipe_produk)}
• *Jumlah*: ${escapeMarkdown(order.jumlah_produk)}

🔐 *Akun*
• *ID*: \`${escapeMarkdown(firstId)}\`
• *Password*: \`${escapeMarkdown(firstPassword)}\`
• *Expired*: ${newExpired} WIB
`;

    await bot.sendDocument(chatId, fileName, {
      caption: docCaption,
      parse_mode: "Markdown",
    });

    fs.unlinkSync(fileName);
    await updateOrderStatus(orderId, "Selesai");

    return bot.answerCallbackQuery({ callback_query_id: callbackQuery.id });
  } else {
    return bot.answerCallbackQuery({
      callback_query_id: callbackQuery.id,
      text: "⚠️ Pembayaran belum diterima, coba lagi nanti.",
      show_alert: true,
    });
  }
}




  // ==================== ORDER ====================
  if (data === 'order') {
    userOrders[chatId] = {
      jumlah: '✅ 50PCS',
      durasi: '✅ 7 Hari',
      tipe: '✅ Urut',
      harga: 500,
      total: 25000,
    };
    return bot.editMessageCaption(buildOrderText(userOrders[chatId]), {
      chat_id: chatId,
      message_id: msgId,
      ...buildOrderKeyboard(userOrders[chatId]),
      parse_mode: 'Markdown',
    });
  }

  // ==================== JUMLAH / DURASI / TIPE ====================
  if (/^(jumlah|durasi|tipe)_/.test(data)) {
    const [key, value] = data.split('_');
    const order = userOrders[chatId];
    if (order) {
      order[key] = `✅ ${value}`;
      const durasiHarga = { '1 Hari': 100, '3 Hari': 300, '7 Hari': 500 };
      order.harga = durasiHarga[order.durasi.replace('✅ ', '')] || 500;
      const jumlahNum = parseInt(order.jumlah.replace('✅ ', '').replace('PCS', ''));
      order.total = jumlahNum * order.harga;

      bot.editMessageCaption(buildOrderText(order), {
        chat_id: chatId,
        message_id: msgId,
        ...buildOrderKeyboard(order),
        parse_mode: 'Markdown',
      });
    }
    return bot.answerCallbackQuery({ callback_query_id: callbackQuery.id });
  }

  // ==================== BAYAR QRIS ====================
  if (data === 'bayar_qris') {
  const order = userOrders[chatId];
  if (!order) return;

  const now = new Date();
  const expiredTime = new Date(now.getTime() + 5 * 60000); 
  const invoiceNumber = generateInvoiceNumber();
  const usernamed = callbackQuery.from.username || "unknown"; 

  try {
    const qrisResult = await createQRIS(invoiceNumber, parseInt(order.total));

    const orderData = {
      chat_id: chatId,
      username: usernamed,
      jumlah_produk: order.jumlah.replace('✅ ', ''),
      durasi_produk: order.durasi.replace('✅ ', ''),
      tipe_produk: order.tipe.replace('✅ ', ''),
      harga_satuan: order.harga,
      total_harga: order.total,
      metode_pembayaran: 'QRIS',
      status: 'Menunggu Pembayaran',
      qr_id: qrisResult.id,
      invoice: invoiceNumber,
      tanggal_order: now,
      expired: expiredTime,
    };
    const orderId = await insertOrder(orderData);

    const qrBuffer = await QRCode.toBuffer(qrisResult.qr_string, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: 300,
    });

    const caption = `
💠 *Payment via QRIS*

🧾 *Detail Pembayaran*
• Invoice: \`${invoiceNumber}\`
• *Nominal:* Rp${order.total.toLocaleString()}
• *Tanggal:* ${formatShortDate(now)}
• *Expired:* ${formatShortDate(expiredTime)}

📦 *Informasi Order*
• *Produk:* Google GSuite
• *Durasi:* ${escapeMarkdown(order.durasi.replace('✅ ', ''))}
• *Jumlah:* ${escapeMarkdown(order.jumlah.replace('✅ ', ''))}
• *Harga Satuan:* Rp${order.harga.toLocaleString()}
• *Total:* Rp${order.total.toLocaleString()}

Setelah melakukan pembayaran, silakan tekan tombol ✅ *Verifikasi Pembayaran*.
`;

    await bot.sendPhoto(chatId, qrBuffer, {
      caption,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Verifikasi Pembayaran', callback_data: `cek_pembayaran_${invoiceNumber}` }],
          [{ text: '❌ Cancel', callback_data: 'cancel' }],
        ],
      },
    });
  } catch (err) {
    console.error('❌ Gagal membuat QRIS:', err);
    await bot.sendMessage(chatId, '❌ Terjadi kesalahan saat membuat invoice atau QRIS.');
  }

  return bot.answerCallbackQuery({ callback_query_id: callbackQuery.id });
}


  // ==================== HISTORY ====================
  if (data.startsWith('history')) {
  const parts = data.split('_');
  const page = parseInt(parts[1]) || 0;
  const limit = 3;
  const orders = await getOrdersByUser(chatId);

  let caption;
  const nav = [];

  if (!orders || orders.length === 0) {
    caption = '📭 Kamu belum pernah melakukan transaksi.';
    nav.push([{ text: '↩️ Kembali', callback_data: 'kembali' }]);
  } else {
    const sorted = orders.sort((a, b) => new Date(b.tanggal_order) - new Date(a.tanggal_order));
    const start = page * limit;
    const end = start + limit;
    const pageData = sorted.slice(start, end);

    caption = '📜 *Riwayat Transaksi Kamu:*\n\n';
    pageData.forEach((o, i) => {
      caption += `#${start + i + 1} — *${o.invoice || 'N/A'}*\n`;
      caption += `💰 Rp${o.total_harga.toLocaleString()} | ${escapeMarkdown(o.metode_pembayaran)}\n`;
      caption += `🕒 ${escapeMarkdown(formatDateWithDay(new Date(o.tanggal_order)))}\n`;
      caption += `📦 ${escapeMarkdown(o.status)}\n\n`;
    });

    if (page > 0) nav.push({ text: '⬅️ Sebelumnya', callback_data: `history_${page - 1}` });
    if (end < sorted.length) nav.push({ text: '➡️ Berikutnya', callback_data: `history_${page + 1}` });
    nav.push({ text: '↩️ Kembali', callback_data: 'kembali' });
  }

  const keyboard = [];
  if (nav.length > 0) keyboard.push(nav);

  // Gunakan editMessageCaption agar tidak spam photo baru
  await bot.editMessageCaption(caption.trim(), {
    chat_id: chatId,
    message_id: msg.message_id,
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard },
  });

  return bot.answerCallbackQuery({ callback_query_id: callbackQuery.id });
}
  if (data === 'update_domain') {
    const selectedDomain = await getUserDomain(chatId);
    try {
      await bot.editMessageCaption(getDomainCaption(selectedDomain), {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown',
        reply_markup: getDomainKeyboard(selectedDomain)
      });
      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (err) {
      console.error('❌ Gagal edit caption:', err.message);
    }
  }
  if(data === 'cancel'){
    try{
      await bot.deleteMessage(chatId, msgId);
      cancelMenu(chatId, usernamed)
    } catch (err){
      console.log(err)
    }
  }
  if (data.startsWith('select_domain:')) {
    const selectedDomain = data.split(':')[1];

    // Simpan ke database
    await updateUserDomain(chatId, selectedDomain);

    try {
      await bot.editMessageCaption(getDomainCaption(selectedDomain), {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown',
        reply_markup: getDomainKeyboard(selectedDomain)
      });

      await bot.answerCallbackQuery(callbackQuery.id, {
        text: `✅ Domain diperbarui ke ${selectedDomain}`,
        show_alert: false
      });
    } catch (err) {
      console.error('❌ Gagal update domain:', err.message);
    }
  }
  if (data === 'update_password') {
    const currentPassword = await getUserPassword(chatId) || 'Belum disetel';

    const caption = `
🔐 *Update Password*

*Password GSuite:* ${currentPassword}

*Ketentuan:*
• Panjang 8–16 karakter
• Hanya boleh berisi huruf, angka, dan simbol umum

Ketik dan kirim password baru Anda sekarang.
    `.trim();

    try {
      awaitingPasswordInput.set(chatId, true); // Set user dalam mode input password

      await bot.editMessageCaption(caption, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '↩️ Kembali ke Pengaturan', callback_data: 'settings' }]
          ]
        }
      });

      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (err) {
      console.error('❌ Gagal tampilkan menu password:', err.message);
    }
  }
 if (data === 'settings') {
  const domain = await getUserDomain(chatId)
  const password = await getUserPassword(chatId)
    const caption = `
⚙️ *Pengaturan GSuite*
└ *Domain:* ${domain}
└ *Password:* ${password}

Silakan pilih pengaturan yang ingin diubah:
    `;

    const keyboard = {
      inline_keyboard: [
        [{ text: '🔄 Update Domain', callback_data: 'update_domain' }],
        [{ text: '🔑 Update Password', callback_data: 'update_password' }],
        [{ text: '↩️ Kembali', callback_data: 'kembali' }]
      ]
    };

    try {
      await bot.editMessageCaption(caption, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'Markdown', // atau 'HTML' jika kamu ingin format HTML
        reply_markup: keyboard
      });

      await bot.answerCallbackQuery(callbackQuery.id);
    } catch (error) {
      console.error('❌ Gagal edit caption:', error.message);
    }
  }

  // ==================== INFO ====================
if (data === 'info') {
  const info = `
💠 *Apa itu Google GSuite?*
GSuite adalah layanan Google yang berfungsi seperti akun biasa namun bersifat sementara (harian).

📦 *Kegunaan GSuite*
• Temporary Account Google (Harian)
• Tanpa Verifikasi OTP
• Untuk Daftar Aplikasi
• Support Semua Aplikasi Google
• Support Payment
• Support Playstore

⚡️ *Layanan aktif 24/7*
Bot Created By : @zhenkun1
`;

  await bot.editMessageCaption(info, {
    chat_id: chatId,
    message_id: msgId,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Channel 📢', url: 'https://t.me/premiumisme' },
          { text: 'Grup 💬', url: 'https://t.me/premiumisme_grup' }
        ],
        [
          { text: 'Profile 👤', callback_data: 'profil' }
        ],
        [
          { text: '↩️ Kembali', callback_data: 'kembali' }
        ]
      ]
    }
  });

  return bot.answerCallbackQuery({ callback_query_id: callbackQuery.id });
}

  //===================== profile ============================
if (data === 'profil') {
  const now = new Date();
  const formattedDate = formatDateWithDay(now);
  const safeUsername = escapeMarkdown(usernamed);
  const { total_transaksi: totalTransaksiUser } = await getTotalTransaksiByChatId(chatId);
  const message = `👤 *User Profile*
  
└ *ID:* ${chatId}
└ *Username:* @${safeUsername || 'Tidak tersedia'}
└ *Saldo Pengguna:* Rp. 0
└ *Total Transaksi:* Rp. ${totalTransaksiUser}

*${formattedDate}*
`;

  await bot.editMessageCaption(message, {
    chat_id: chatId,
    message_id: msgId,
    parse_mode: 'Markdown',
    reply_markup: {
    inline_keyboard: [
      [
        { text: '↩️ Kembali', callback_data: 'kembali' }
      ]
    ]
  }
  });

  await bot.answerCallbackQuery({ callback_query_id: callbackQuery.id });
}

  // ==================== KEMBALI KE MENU ====================
  if (data === 'kembali') {
    await kembali(chatId, msgId, usernamed);
    return bot.answerCallbackQuery({ callback_query_id: callbackQuery.id });
  }

  // ==================== BELI PRODUK ====================
  if (data === 'beli_produk') {
  const order = userOrders[chatId];
  const domainFromDb = await getUserDomain(parseInt(chatId));
  const domain = domainFromDb || 'Belum disetel';
  const pw = await getUserPassword(chatId)
  const summary = `
🧾 *Informasi Order*
• *Produk:* Google GSuite
• *Durasi:* ${escapeMarkdown(order.durasi.replace('✅ ', ''))}
• *Jumlah:* ${escapeMarkdown(order.jumlah.replace('✅ ', ''))}
• *Tipe:* ${escapeMarkdown(order.tipe.replace('✅ ', ''))}
• *Total:* Rp${order.total.toLocaleString()}

⚙️ *Pengaturan*
• *Domain:* ${domain}
• *Password:* ${escapeMarkdown(pw || 'Masuk123')}
• */setting* untuk update pengaturan

💳 *Pilih Pembayaran*
`;

  // Cek apakah message sebelumnya adalah photo
  if (msg.photo) {
    // Edit caption photo yang sudah ada
    await bot.editMessageCaption(summary, {
      chat_id: chatId,
      message_id: msg.message_id,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💳 Pakai QRIS', callback_data: 'bayar_qris' },
            { text: '💰 Pakai Saldo', callback_data: 'bayar_saldo' },
          ],
          [{ text: '❌ Cancel', callback_data: 'kembali' }],
        ],
      },
    });
  } else {
    // Kirim baru jika bukan photo
    await bot.sendPhoto(chatId, './baner.png', {
      caption: summary,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '💳 Bayar via QRIS', callback_data: 'bayar_qris' },
            { text: '💰 Bayar via Saldo', callback_data: 'bayar_saldo' },
          ],
          [{ text: '↩️ Kembali', callback_data: 'kembali' }],
        ],
      },
    });
  }

  return bot.answerCallbackQuery({ callback_query_id: callbackQuery.id });
}



  return bot.answerCallbackQuery({ callback_query_id: callbackQuery.id });
});

// ==================== Other callbacks (jumlah/durasi/tipe, bayar, history, info, kembali) ====================
// Sama seperti sebelumnya, cukup pastikan:
// - Tidak edit text message yang sebelumnya adalah photo/document
// - Gunakan sendMessage / sendPhoto baru jika perlu info tambahan
