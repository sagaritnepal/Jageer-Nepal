// Fonepay Dynamic QR API client (server-side only - never call this from the
// app directly, since signing requires FONEPAY_SECRET_KEY).
//
// Defaults to Fonepay's public UAT sandbox (merchant code "fonepay123") so the
// payment flow is testable end-to-end before a real merchant account exists.
// Once you have a real Fonepay merchant account, set these Supabase secrets
// to switch to production:
//   supabase secrets set FONEPAY_ENV=production
//   supabase secrets set FONEPAY_MERCHANT_CODE=<your merchant code>
//   supabase secrets set FONEPAY_SECRET_KEY=<your secret key>
//   supabase secrets set FONEPAY_USERNAME=<your username>
//   supabase secrets set FONEPAY_PASSWORD=<your password>

const isProduction = Deno.env.get('FONEPAY_ENV') === 'production';

const config = {
  baseUrl: isProduction
    ? 'https://merchantapi.fonepay.com/api'
    : 'https://uat-new-merchant-api.fonepay.com/api',
  merchantCode: Deno.env.get('FONEPAY_MERCHANT_CODE') ?? 'fonepay123',
  secretKey: Deno.env.get('FONEPAY_SECRET_KEY') ?? 'fonepay',
  username: Deno.env.get('FONEPAY_USERNAME') ?? 'bijayk',
  password: Deno.env.get('FONEPAY_PASSWORD') ?? 'password',
};

async function hmacSha512Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generatePrn(serviceRequestId: string): string {
  const compact = serviceRequestId.replace(/-/g, '').slice(0, 12);
  const suffix = Date.now().toString(36);
  return `J${compact}${suffix}`.slice(0, 25);
}

export interface CreateQrResult {
  success: boolean;
  qrMessage?: string;
  errorMessage?: string;
}

export async function createDynamicQr(
  amount: number,
  prn: string,
  remarks1: string,
  remarks2: string
): Promise<CreateQrResult> {
  const amountStr = amount.toString();
  const dataValidation = await hmacSha512Hex(
    config.secretKey,
    `${amountStr},${prn},${config.merchantCode},${remarks1},${remarks2}`
  );

  const res = await fetch(
    `${config.baseUrl}/merchant/merchantDetailsForThirdParty/thirdPartyDynamicQrDownload`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amountStr,
        remarks1,
        remarks2,
        prn,
        merchantCode: config.merchantCode,
        dataValidation,
        username: config.username,
        password: config.password,
      }),
    }
  );

  const body = await res.json();
  if (!res.ok || !body.success) {
    return { success: false, errorMessage: body.message ?? `Fonepay error (HTTP ${res.status})` };
  }
  return { success: true, qrMessage: body.qrMessage };
}

export interface QrStatusResult {
  paymentStatus: 'success' | 'pending' | 'failed';
}

export async function checkQrStatus(prn: string): Promise<QrStatusResult> {
  const dataValidation = await hmacSha512Hex(config.secretKey, `${prn},${config.merchantCode}`);

  const res = await fetch(
    `${config.baseUrl}/merchant/merchantDetailsForThirdParty/thirdPartyDynamicQrGetStatus`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prn,
        merchantCode: config.merchantCode,
        dataValidation,
        username: config.username,
        password: config.password,
      }),
    }
  );

  const body = await res.json();
  const status = (body.paymentStatus ?? '').toLowerCase();
  return { paymentStatus: status === 'success' ? 'success' : status === 'pending' ? 'pending' : 'failed' };
}
