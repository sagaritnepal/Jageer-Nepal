// Polled by the client while a Fonepay QR is on screen. Confirms payment
// with Fonepay server-side and, on success, marks the service request paid
// itself - no reseller action needed for online payments.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { checkQrStatus } from '../_shared/fonepay.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { service_request_id } = await req.json();
    if (!service_request_id) {
      return new Response(JSON.stringify({ error: 'service_request_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: request, error: fetchError } = await callerClient
      .from('service_requests')
      .select('id, payment_status, fonepay_prn')
      .eq('id', service_request_id)
      .single();

    if (fetchError || !request) {
      return new Response(JSON.stringify({ error: 'Request not found or not accessible' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (request.payment_status === 'paid') {
      return new Response(JSON.stringify({ paymentStatus: 'success' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!request.fonepay_prn) {
      return new Response(JSON.stringify({ error: 'No QR has been generated for this job yet' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await checkQrStatus(request.fonepay_prn);

    if (result.paymentStatus === 'success') {
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      await adminClient
        .from('service_requests')
        .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', service_request_id);
    }

    return new Response(JSON.stringify({ paymentStatus: result.paymentStatus }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
