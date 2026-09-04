/**
 * POST /api/lead  ->  Kintone "KinPlug Event Leads" (app 2572)
 *
 * The booth form at /kd stores every capture on the device first and flushes here with
 * retries, so this handler is idempotent: a lead_id that already exists is reported as
 * success, otherwise a lost response would make the client retry a record already saved.
 *
 * After the record is safely written we send two emails through Resend - a branded
 * confirmation to the visitor (only with consent) and a plain alert to the booth.
 * Neither can fail the request: the lead is already in Kintone by that point.
 *
 * Secrets: KINTONE_LEAD_TOKEN, RESEND_API_KEY. Neither reaches the browser.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ALLOWED_INTEREST = new Set(['Dashboard', 'Mail', 'PDF Pro', 'The whole suite', 'Kintone consulting']);
const ALLOWED_STATUS   = new Set(['Using today', 'Evaluating', 'Not yet']);
const ALLOWED_PRIORITY = new Set(['Hot', 'Warm', 'Cold']);
const ALLOWED_COUNTRY  = new Set(['Malaysia','Singapore','Thailand','Indonesia','Vietnam','Philippines','Japan','Other']);

function confirmationHtml(first, interest, subdomain) {
  const NAVY = '#1B2B5A', CLAY = '#C47A42', PAPER = '#F7F5F0', INK = '#0F1419';
  const serif = "Georgia,'Times New Roman',serif";
  const sans = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const wants = interest.length
    ? 'You asked about <strong style="color:' + INK + '">' + esc(interest.join(', ')) + '</strong>. '
    : '';
  const sub = subdomain
    ? '<tr><td style="padding:0 0 18px"><table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F7EAD9;border-left:4px solid ' + CLAY + '"><tr><td style="padding:14px 18px;font:15px/1.5 ' + sans + ';color:#9E5E2E">We will activate your trial on <strong>' + esc(subdomain) + '.kintone.com</strong> and email you when it is ready.</td></tr></table></td></tr>'
    : '';
  return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:' + PAPER + '">'
    + '<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:' + PAPER + '">'
    + '<tr><td align="center" style="padding:28px 12px">'
    + '<table cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%">'
    + '<tr><td style="background:' + NAVY + ';padding:26px 32px 22px">'
    + '<div style="font:600 22px/1 ' + sans + ';color:' + PAPER + ';letter-spacing:-.5px">kinplug</div>'
    + '<div style="font:500 11px/1.4 ui-monospace,Menlo,monospace;color:rgba(247,245,240,.65);letter-spacing:2px;text-transform:uppercase;padding-top:8px">Native Kintone plugins</div>'
    + '</td></tr>'
    + '<tr><td style="background:' + CLAY + ';height:3px;line-height:3px;font-size:0">&nbsp;</td></tr>'
    + '<tr><td style="background:#ffffff;padding:32px">'
    + '<table cellpadding="0" cellspacing="0" border="0" width="100%">'
    + '<tr><td style="font:bold 26px/1.25 ' + serif + ';color:' + INK + ';padding-bottom:16px">Thanks for stopping by, ' + esc(first) + '.</td></tr>'
    + '<tr><td style="font:16px/1.6 ' + sans + ';color:#3A4049;padding-bottom:20px">' + wants + 'Your 30-day trial covers every plugin and every feature &mdash; no credit card.</td></tr>'
    + sub
    + '<tr><td style="padding:4px 0 24px"><table cellpadding="0" cellspacing="0" border="0"><tr><td style="background:' + NAVY + ';border-radius:3px"><a href="https://kinplug.com/?utm_source=kintoneday&amp;utm_medium=email" style="display:inline-block;padding:14px 28px;font:bold 15px/1 ' + sans + ';color:' + PAPER + ';text-decoration:none">Start the trial &rarr;</a></td></tr></table></td></tr>'
    + '<tr><td style="border-top:1px solid #E5E1D8;padding-top:20px;font:15px/1.6 ' + serif + ';color:' + NAVY + '">The engineer who wrote the plugin answers your support email. No tier-1 scripts, no ticket silos &mdash; just reply to this message.</td></tr>'
    + '</table></td></tr>'
    + '<tr><td style="background:#0F1A3D;padding:18px 32px;font:12px/1.6 ' + sans + ';color:rgba(247,245,240,.7)">'
    + '<strong style="color:' + PAPER + '">kinplug.com</strong> &nbsp;&middot;&nbsp; support@kinplug.com<br>'
    + 'Edamame Inc. &mdash; Manila, Philippines &nbsp;&middot;&nbsp; Kintone Global Partner of the Year 2024'
    + '</td></tr></table></td></tr></table></body></html>';
}

async function sendMail(env, payload) {
  if (!env.RESEND_API_KEY) return 'no_key';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return r.ok ? 'sent' : 'failed_' + r.status;
  } catch (e) { return 'error'; }
}

export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch (e) { return json({ ok: false, error: 'invalid_json' }, 400); }

  if (body.website) return json({ ok: true, skipped: true });   // honeypot

  const name = clip(body.name, 100).trim();
  const company = clip(body.company, 120).trim();
  const email = clip(body.email, 160).trim().toLowerCase();
  if (!name || !company) return json({ ok: false, error: 'name_and_company_required' }, 400);
  if (!EMAIL.test(email)) return json({ ok: false, error: 'invalid_email' }, 400);

  const interest = Array.isArray(body.interest) ? body.interest.filter((i) => ALLOWED_INTEREST.has(i)) : [];
  const d = new Date(body.captured_at || Date.now());
  const when = (isNaN(d) ? new Date() : d).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const leadId = clip(body.id, 60) || 'kd-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  const subdomain = clip(body.kintone_subdomain, 80);

  const record = {
    lead_id: { value: leadId }, captured_at: { value: when },
    name: { value: name }, company: { value: company },
    job_title: { value: clip(body.job_title, 100) }, email: { value: email },
    phone: { value: clip(body.phone, 40) }, kintone_subdomain: { value: subdomain },
    interest: { value: interest }, notes: { value: clip(body.notes, 4000) },
    event_name: { value: clip(body.event_name, 120) },
    captured_by: { value: clip(body.captured_by, 80) },
    source: { value: clip(body.source, 60) || 'booth-form' },
    user_agent: { value: clip(body.ua, 300) },
    consent: { value: body.consent ? ['Agreed to be contacted'] : [] },
  };
  if (ALLOWED_STATUS.has(body.kintone_status)) record.kintone_status = { value: body.kintone_status };
  if (ALLOWED_PRIORITY.has(body.priority)) record.priority = { value: body.priority };
  if (ALLOWED_COUNTRY.has(body.country)) record.country = { value: body.country };

  const base = env.KINTONE_BASE || 'https://edamame.kintone.com';
  let res, text;
  try {
    res = await fetch(base + '/k/v1/record.json', {
      method: 'POST',
      headers: { 'X-Cybozu-API-Token': env.KINTONE_LEAD_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ app: env.KINTONE_LEAD_APP, record }),
    });
    text = await res.text();
  } catch (e) { return json({ ok: false, error: 'kintone_unreachable' }, 429); }

  // Kintone reports a unique-field clash as CB_VA01 "This value already exists in another record."
  const duplicate = !res.ok && /already exists|GAIA_UQ01/i.test(text);
  if (!res.ok && !duplicate) {
    // 429 rather than 5xx: Cloudflare replaces a 502 from a Function with its own error page.
    return json({ ok: false, error: 'kintone_rejected', status: res.status, detail: text.slice(0, 300) }, 429);
  }

  let id = null;
  try { id = JSON.parse(text).id; } catch (e) {}

  // Email is best effort. The lead is already stored; nothing below may fail the request.
  let mail = 'skipped';
  if (!duplicate) {
    const first = name.split(/\s+/)[0];
    if (body.consent) {
      mail = await sendMail(env, {
        from: 'kinplug <noreply@kinplug.com>',
        to: [email],
        reply_to: 'support@kinplug.com',
        subject: 'Your kinplug trial, ' + first,
        html: confirmationHtml(first, interest, subdomain),
      });
    }
    const rows = [
      'Name      ' + name, 'Company   ' + company, 'Email     ' + email,
      'Role      ' + (record.job_title.value || '-'),
      'Phone     ' + (record.phone.value || '-'),
      'Country   ' + (record.country ? record.country.value : '-'),
      'Kintone   ' + (record.kintone_status ? record.kintone_status.value : '-') + (subdomain ? ' (' + subdomain + ')' : ''),
      'Interest  ' + (interest.join(', ') || '-'),
      'Priority  ' + (record.priority ? record.priority.value : '-'),
      'Source    ' + record.source.value,
      'By        ' + (record.captured_by.value || '-'),
      '', record.notes.value || '',
    ].join('\n');
    await sendMail(env, {
      from: 'kinplug booth <noreply@kinplug.com>',
      to: [env.LEAD_ALERT_TO || 'support@kinplug.com'],
      reply_to: email,
      subject: 'Lead - ' + company + ' (' + name + ')',
      html: '<pre style="font:14px/1.6 ui-monospace,Menlo,monospace">' + esc(rows) + '</pre>',
    });
  }

  return json({ ok: true, id: id, lead_id: leadId, duplicate: duplicate, mail: mail });
}
