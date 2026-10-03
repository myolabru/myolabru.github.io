// MyoLab Payment Worker — deploy to Cloudflare Workers
// Environment variables to set in Cloudflare dashboard:
//   YOOKASSA_SHOP_ID = your shop ID
//   YOOKASSA_SECRET_KEY = your secret key

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { plan } = await request.json();

      // Only the «Лицо» plan is on sale for now (100 ₽/month).
      // The «Лицо, шея и верхние конечности» plan (1000 ₽/month) is "Скоро" and not payable yet.
      if (plan !== 'face') {
        return new Response(JSON.stringify({ error: 'Этот тариф пока недоступен' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
      const amount = '100.00';
      const description = 'MyoLab — тариф «Лицо», подписка на 1 месяц';

      // Create payment via YooKassa API
      const idempotenceKey = crypto.randomUUID();

      const response = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(env.YOOKASSA_SHOP_ID + ':' + env.YOOKASSA_SECRET_KEY),
          'Idempotence-Key': idempotenceKey,
        },
        body: JSON.stringify({
          amount: {
            value: amount,
            currency: 'RUB',
          },
          confirmation: {
            type: 'redirect',
            return_url: 'https://myolab.ru/payment-success.html',
          },
          capture: true,
          description: description,
          metadata: {
            plan: plan,
          },
        }),
      });

      const data = await response.json();

      if (data.confirmation && data.confirmation.confirmation_url) {
        return new Response(JSON.stringify({ url: data.confirmation.confirmation_url }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } else {
        return new Response(JSON.stringify({ error: 'Payment creation failed', details: data }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
