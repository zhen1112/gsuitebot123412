const axios = require('axios');
const BASE_API = 'https://api.premiumisme.my.id';

async function getUserDomain() {
try {
  const res = await axios.get('https://api.premiumisme.my.id/user/7057207213/domain');
  console.log(res.data);
} catch (err) {
  if (err.response) {
    // ❌ Ada response dari server, misal 404, 500, dll
    console.error('🟥 Error Response:', err.response.data);
    console.error('Status:', err.response.status);
  } else if (err.request) {
    // ❌ Request dikirim tapi tidak ada response
    console.error('🟨 No Response received:', err.request);
  } else {
    // ❌ Error lain, misal config salah
    console.error('🟦 Axios Error:', err.message);
  }
}

}
getUserDomain();