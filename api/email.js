// api/email.js — Travel Studio · Memoria de Viaje
// Requires env var: RESEND_API_KEY (get it free at resend.com)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    name = '', email = '', tripName = '', dest = '',
    departDate = '', returnDate = '', travelers = '', lang = 'es'
  } = req.body || {};

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    console.log('[email] RESEND_API_KEY not configured. Would send to:', email);
    return res.status(200).json({ ok: true, note: 'no_key' });
  }

  const firstName = name ? name.split(' ')[0] : { es: 'viajero', en: 'traveller', fr: 'voyageur' }[lang] || 'viajero';
  const greet = { es: 'Hola', en: 'Hi', fr: 'Bonjour' }[lang] || 'Hola';
  const subject = `✈ ${tripName || dest} — ${{ es: 'tu itinerario está aquí', en: 'your itinerary is here', fr: 'ton itinéraire est là' }[lang] || 'tu itinerario'}`;
  const meta = [departDate && returnDate ? `${departDate} → ${returnDate}` : '', travelers].filter(Boolean).join(' · ');

  const deptDate = departDate ? new Date(departDate + 'T00:00:00') : null;
  const daysUntil = deptDate ? Math.round((deptDate - new Date()) / 86400000) : null;

  const bullets = (daysUntil && daysUntil > 7 ? [
    `✈ ${{ es: `Te avisamos cuando los vuelos a ${dest} estén en precio óptimo`, en: `We'll alert you when flights to ${dest} hit the best price`, fr: `On t'alertera quand les vols pour ${dest} seront au meilleur prix` }[lang]}`,
    `🏨 ${{ es: `Alojamientos recomendados ${daysUntil - 5} días antes de salir`, en: `Accommodation picks ${daysUntil - 5} days before departure`, fr: `Hébergements recommandés ${daysUntil - 5} jours avant le départ` }[lang]}`,
    `🎒 ${{ es: 'Checklist de viaje personalizada a 7 días', en: 'Custom packing checklist 7 days out', fr: 'Checklist personnalisée à J-7' }[lang]}`,
    `🎁 ${{ es: 'Algo especial cuando vuelvas', en: 'Something special when you return', fr: 'Quelque chose de spécial à ton retour' }[lang]}`,
  ] : [
    `🏨 ${{ es: `Reserva alojamiento pronto — los mejores se llenan rápido`, en: 'Book accommodation soon — best places fill fast', fr: 'Réserve vite — les meilleurs partent tôt' }[lang]}`,
    `🎟 ${{ es: 'Las mejores experiencias agotan plazas con semanas de antelación', en: 'Top experiences sell out weeks ahead', fr: 'Les meilleures expériences se remplissent tôt' }[lang]}`,
    `🎁 ${{ es: 'Al volver tendremos algo para ti', en: "When you return, we'll have something for you", fr: 'À ton retour, on aura quelque chose pour toi' }[lang]}`,
  ]).map(b => `<tr><td style="padding:7px 0;font-size:14px;color:#334155;line-height:1.6">${b}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:40px 16px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,.15)">
<tr><td style="background:linear-gradient(135deg,#0F172A 0%,#1E3A5F 55%,#0F766E 100%);padding:40px 36px 32px">
  <div style="font-size:10px;font-weight:700;letter-spacing:.18em;color:#2DD4BF;text-transform:uppercase;margin-bottom:12px">Travel Studio</div>
  <div style="font-family:Georgia,serif;font-size:28px;font-weight:700;color:#fff;line-height:1.15;margin-bottom:10px">${tripName || dest}</div>
  ${meta ? `<div style="font-size:12px;color:rgba(255,255,255,.45)">${meta}</div>` : ''}
</td></tr>
<tr><td style="background:linear-gradient(90deg,#0F766E,#2DD4BF,#67E8F9);height:3px;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="background:#fff;padding:36px">
  <p style="margin:0 0 6px;font-size:17px;color:#0F172A"><strong>${greet} ${firstName},</strong></p>
  <p style="margin:0 0 28px;font-size:14px;color:#64748B;line-height:1.7">
    ${{ es: `Tu plan para <strong>${dest}</strong> está guardado. Te acompañamos de aquí a que vuelvas.`, en: `Your plan for <strong>${dest}</strong> is saved. We'll be with you from now until you return.`, fr: `Ton plan pour <strong>${dest}</strong> est sauvegardé. On t'accompagne jusqu'au retour.` }[lang] || ''}
  </p>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border-radius:14px;border:1px solid #E2E8F0;margin-bottom:28px">
    <tr><td style="padding:20px 24px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#94A3B8;margin-bottom:14px">${{ es: 'Lo que viene', en: "What's next", fr: 'Ce qui arrive' }[lang]}</div>
      <table width="100%" cellpadding="0" cellspacing="0"><tbody>${bullets}</tbody></table>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px"><tr><td align="center">
    <a href="https://travel-studio.vercel.app" style="display:inline-block;background:linear-gradient(135deg,#0F766E,#0D9488);color:#fff;text-decoration:none;padding:15px 36px;border-radius:100px;font-size:14px;font-weight:700">${{ es: 'Volver a mi itinerario →', en: 'Back to my itinerary →', fr: 'Retour à mon itinéraire →' }[lang]}</a>
  </td></tr></table>
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #E2E8F0;padding-top:20px;text-align:center">
    <p style="margin:0 0 6px;font-size:12px;color:#94A3B8">${{ es: 'Viajes con criterio y alma.', en: 'Travel with purpose and soul.', fr: 'Voyager avec sens et âme.' }[lang]}</p>
    <p style="margin:0;font-size:11px;color:#CBD5E1"><a href="#" style="color:#CBD5E1">${{ es: 'Darse de baja', en: 'Unsubscribe', fr: 'Se désabonner' }[lang]}</a></p>
  </td></tr></table>
</td></tr>
</table></td></tr></table>
</body></html>`;

  try {
    // RESEND_TO_OVERRIDE: sin dominio verificado, pon tu propio email aqui en Vercel.
    // Todos los emails llegan a ti con el email del usuario en el asunto.
    const toAddr = process.env.RESEND_TO_OVERRIDE || email;
    const finalSubject = process.env.RESEND_TO_OVERRIDE
      ? '[para: ' + email + '] ' + subject
      : subject;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Travel Studio <onboarding@resend.dev>',
        to: [toAddr],
        reply_to: email,
        subject: finalSubject,
        html,
      }),
    });
    const body = await r.json();
    if (!r.ok) {
      console.error('[email] Resend error:', JSON.stringify(body));
      return res.status(200).json({ ok: true, warn: body?.message });
    }
    console.log('[email] Sent OK id:', body.id, '→', email);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[email] Exception:', e.message);
    return res.status(200).json({ ok: true, warn: 'exception' });
  }
}
