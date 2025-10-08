const { Xendit } = require('xendit-node');

// 🔑 Ganti dengan Secret Key kamu
const xenditClient = new Xendit({ secretKey: 'xnd_production_LCg9PyquzyMtfKCpyIsd9cTqVAhQ7rOOaZpZVA0DudrcNd2NArofMHt3aBFsRg1' });


const paymentRequest = xenditClient.PaymentRequest;

async function createQrisPayment() {
  try {
    const data = {
      amount: 15000,
      currency: 'IDR',
      referenceId: 'INVBOT-1241231',
      metadata: {
        sku: 'GSUITE01',
      },
      paymentMethod: {
        type: 'QR_CODE',
        reusability: 'ONE_TIME_USE',
        qrCode: {
          channelCode: 'QRIS',
        },
      },
    };

    const response = await paymentRequest.createPaymentRequest({ data });

    console.log('✅ Payment Request Created!');
    console.log('QRIS String:', response.data.paymentMethod.qrCode.qrString);
    console.log('QRIS URL:', response.data.paymentMethod.qrCode.qrUrl);
  } catch (err) {
    console.error('❌ Gagal membuat payment request:', err.response?.data || err.message);
  }
}

createQrisPayment();