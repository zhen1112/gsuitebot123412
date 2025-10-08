const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "gsuite_bot",
});

// 🟢 Insert Order
async function insertOrder(order) {
  const [result] = await db.execute(
    `INSERT INTO orders 
     (chat_id, username, jumlah_produk, durasi_produk, tipe_produk, harga_satuan, total_harga, metode_pembayaran, status, invoice, qr_id, tanggal_order, expired) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      order.chat_id,
      order.username,
      order.jumlah_produk,
      order.durasi_produk,
      order.tipe_produk,
      order.harga_satuan,
      order.total_harga,
      order.metode_pembayaran,
      order.status,
      order.invoice,
      order.qr_id,
      order.tanggal_order,
      order.expired,
    ]
  );
  return result.insertId;
}

// 🟢 Ambil semua order user
async function getOrdersByUser(chatId) {
  const [rows] = await db.execute("SELECT * FROM orders WHERE chat_id = ? ORDER BY id DESC", [chatId]);
  return rows;
}

// 🟢 Insert user jika belum ada
async function insertUserIfNotExists(chatId, username, domain, password) {
  try {
    const [rows] = await db.query("SELECT chat_id FROM users WHERE chat_id = ?", [chatId]);
    if (rows.length === 0) {
      await db.query("INSERT INTO users (chat_id, username, domain, password) VALUES (?, ?, ?, ?)", [chatId, username, domain, password]);
      console.log(`✅ User baru disimpan: (@${username})`);
    } else {
      console.log(`ℹ️ User sudah terdaftar: (@${username})`);
    }
  } catch (err) {
    console.error("❌ Gagal insert user:", err.message);
  }
}
async function updateUserDomain(chatId, domain) {
  try {
    const [result] = await db.execute(
      "UPDATE users SET domain = ? WHERE chat_id = ?",
      [domain, chatId]
    );
    return result.affectedRows > 0;
  } catch (err) {
    console.error("❌ Gagal update domain user:", err.message);
    return false;
  }
}

// 🟢 Ambil domain user
async function getUserDomain(chatId) {
  try {
    const [rows] = await db.execute(
      "SELECT domain FROM users WHERE chat_id = ?",
      [chatId]
    );
    if (rows.length === 0) return null;
    return rows[0].domain;
  } catch (err) {
    console.error("❌ Gagal ambil domain user:", err.message);
    return null;
  }
}
// 🟢 Update status order
async function updateOrderStatus(orderId, status) {
  await db.execute("UPDATE orders SET status = ? WHERE id = ?", [status, orderId]);
}

// 🟢 Ambil QR ID dari order tertentu
async function getQrIdByOrderId(orderId) {
  try {
    const [rows] = await db.execute("SELECT qr_id FROM orders WHERE id = ?", [orderId]);
    if (rows.length === 0) {
      console.log(`⚠️ Order dengan ID ${orderId} tidak ditemukan.`);
      return null;
    }
    return rows[0].qr_id;
  } catch (err) {
    console.error("❌ Gagal mengambil QR ID:", err.message);
    return null;
  }
}
async function getOrderById(orderId) {
  const [rows] = await db.execute("SELECT * FROM orders WHERE id = ?", [orderId]);
  return rows[0];
}

async function insertGsuiteUser(chatId, orderId, invoice, email, password, expiredDate = null) {
  try {
    await db.execute(
      `INSERT INTO gsuite_users 
       (chat_id, order_id, invoice, email, password, created_date, expired_date)
       VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
      [chatId, orderId, invoice, email, password, expiredDate]
    );
  } catch (err) {
    console.error("❌ Gagal insert ke gsuite_users:", err.message);
  }
}
async function updateUserPassword(chatId, password) {
  try {
    const [result] = await db.execute(
      "UPDATE users SET password = ? WHERE chat_id = ?",
      [password, chatId]
    );
    return result.affectedRows > 0;
  } catch (err) {
    console.error("❌ Gagal update password user:", err.message);
    return false;
  }
}

// 🟢 Ambil password user
async function getUserPassword(chatId) {
  try {
    const [rows] = await db.execute(
      "SELECT password FROM users WHERE chat_id = ?",
      [chatId]
    );
    if (rows.length === 0) return null;
    return rows[0].password;
  } catch (err) {
    console.error("❌ Gagal ambil password user:", err.message);
    return null;
  }
}
module.exports = {
  insertOrder,
  getOrdersByUser,
  updateOrderStatus,
  insertUserIfNotExists,
  getQrIdByOrderId,
  getOrderById,
  insertGsuiteUser,
  getUserDomain,
  updateUserDomain,
  getUserPassword,
  updateUserPassword
};
