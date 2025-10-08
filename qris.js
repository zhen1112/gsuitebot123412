// server.js
const axios = require('axios');
const API_KEY = 'xnd_production_LCg9PyquzyMtfKCpyIsd9cTqVAhQ7rOOaZpZVA0DudrcNd2NArofMHt3aBFsRg1';

async function createQRIS(externalId, amount) {
  const url = 'https://api.xendit.co/qr_codes';
  const body = {
    external_id: externalId,
    type: 'DYNAMIC',
    amount: amount,
    callback_url: 'https://prabowo.store',
    redirect_url: 'https://prabowo.store'
  };

  try {
    const resp = await axios.post(url, body, {
      auth: { username: API_KEY, password: '' },
      headers: { 'Content-Type': 'application/json' }
    });
    return {
      qr_string: resp.data.qr_string,
      id: resp.data.id,
    };

  } catch (error) {
    console.error('❌ Error createQRIS:', error.response?.data || error.message);
    throw error;
  }
}

async function checkQrisStatus(qrId) {
  try {
    const response = await axios.get(`https://api.xendit.co/qr_codes/${qrId}`, {
      auth: {
        username: API_KEY,
        password: '',
      },
    });

    const data = response.data;

    if (data.status === 'ACTIVE') {
      console.log('⏳ Menunggu pembayaran...');
      
    } else if (data.status === 'INACTIVE') {
      console.log('✅ Sudah dibayar atau kadaluarsa.');
    }
    return data.status
  } catch (err) {
    console.error('❌ Gagal cek status QRIS:', err.response?.data || err.message);
  }
}
module.exports = { createQRIS, checkQrisStatus };
