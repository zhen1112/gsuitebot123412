const axios = require('axios');
const BASE_API = 'https://api.premiumisme.my.id';

module.exports = {
  insertUser: async (chatId, username, domain, password, saldo) => {
    const res = await axios.post(`${BASE_API}/user`, { chatId, username, domain, password, saldo });
    return res.data;
  },
  updateUserDomain: async (chatId, domain) => {
    const res = await axios.put(`${BASE_API}/user/${chatId}/domain`, { domain });
    return res.data;
  },
  updateUserPassword: async (chatId, password) => {
    const res = await axios.put(`${BASE_API}/user/${chatId}/password`, { password });
    return res.data;
  },
  getUserDomain: async (chatId) => {
    const res = await axios.get(`${BASE_API}/user/${chatId}/domain`);
    return res.data.domain;
  },
  getUserPassword: async (chatId) => {
    const res = await axios.get(`${BASE_API}/user/${chatId}/password`);
    return res.data.password;
  },
  deleteUser: async (chatId) => {
    const res = await axios.delete(`${BASE_API}/user/${chatId}`);
    return res.data;
  },
  insertOrder: async (order) => {
    const res = await axios.post(`${BASE_API}/order`, order);
    return res.data;
  },
  getOrdersByUser: async (chatId) => {
    const res = await axios.get(`${BASE_API}/orders/${chatId}`);
    return res.data;
  },
  updateOrderStatus: async (orderId, status) => {
    const res = await axios.put(`${BASE_API}/order/${orderId}/status`, { status });
    return res.data;
  },
  getOrderById: async (orderId) => {
    const res = await axios.get(`${BASE_API}/order/${orderId}`);
    return res.data;
  },
  getQrIdByOrderId: async (orderId) => {
    console.log(orderId)
    const res = await axios.get(`${BASE_API}/order/${orderId}/qr`);
    return res.data.qr_id;
  },
  insertGsuiteUser: async (chatId, invoice, email, password, expiredDate) => {
    const res = await axios.post(`${BASE_API}/gsuite_user`, { chatId,  invoice, email, password, expiredDate });
    return res.data;
  },
  getTotalTransaksiByChatId: async (chatId) => {
  const res = await axios.post(`${BASE_API}/total_transaksi`, { chatId });
  return res.data;
  },
  getTotalTransaksiSemuaUser: async () => {
  const res = await axios.get(`${BASE_API}/total_transaksi`);
  return res.data;
  },
  getTotalUsers :async () => {
  const res = await axios.get(`${BASE_API}/total_users`);
  return res.data.total_user;  // langsung angka total user
  },
  getExpiredGsuiteUsers: async () => {
    const res = await axios.get(`${BASE_API}/gsuite_user/expired`);
    return res.data; // array user yang expired dan deleted=false
  },

  // Update kolom deleted user GSuite
  editGsuiteUserDeleted: async (email, deleted) => {
    const res = await axios.post(`${BASE_API}/gsuite_user/edit`, { email, deleted });
    return res.data;
  },
    getUserSaldo: async (chatId) => {
    const res = await axios.get(`${BASE_API}/user/${chatId}/saldo`);
    return res.data;
  },
  reduceUserSaldo: async (chatId, amount) => {
    const res = await axios.post(`${BASE_API}/user/reduce-saldo`, {
      chat_id: chatId,
      amount,
    });
    return res.data;
  },
  getAllChatIds: async () => {
    const res = await axios.get(`${BASE_API}/broadcast/chat-ids`);
    return res.data.chatIds;
  }

};
