/**
 * POST /api/lead  →  Kintone "KinPlug Event Leads" (app 2572)
 *
 * The booth form at /kd stores every capture on the device first and flushes here
 * with retries, so this handler must be idempotent: a lead_id that already exists
 * is reported as success, otherwise a lost response would make the client retry a
 * record that was in fact saved.
 *
 * The Kintone token lives in KINTONE_LEAD_TOKEN and never reaches the browser.
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

const ALLOWED_INTEREST = new Set([
  'Dashboard', 'Mail', 'PDF Pro', 'The whole suite', 'Kintone consulting',
]);
const ALLOWED_STATUS = new Set(['Using today', 'Evaluating', 'Not yet']);
const ALLOWED_PRIORITY = new Set(['Hot', 'Warm', 'Cold']);
const ALLOWED_COUNTRY = new Set([
  'Malaysia', 'Singapore', 'Thailand', 'Indonesia', 'Vietnam',
  'Philippines', 'Japan', 'Other',
]);

export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  // Honeypot — real visitors never fill this.
  if (body.website) return json({ ok: true, skipped: true });

  const name = clip(body.name, 100).trim();
  const company = clip(body.company, 120).trim();
  const email = clip(body.email, 160).trim().toLowerCase();

  if (!name || !company) return json({ ok: false, error: 'name_and_company_required' }, 400);
  if (!EMAIL.test(email)) return json({ ok: false, error: 'invalid_email' }, 400);

  const interest = Array.isArray(body.interest)
    ? body.interest.filter((i) => ALLOWED_INTEREST.has(i))
    : [];

  const when = (() => {
    const d = new Date(body.captured_at || Date.now());
    return isNaN(d) ? new Date().toISOString() : d.toISOString();
  })();

  const leadId = clip(body.id, 60) || `kd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const record = {
    lead_id:           { value: leadId },
    captured_at:       { value: when.replace(/\.\d{3}Z$/, 'Z') },
    name:              { value: name },
    company:           { value: company },
    job_title:         { value: clip(body.job_title, 100) },
    email:             { value: email },
    phone:             { value: clip(body.phone, 40) },
    kintone_subdomain: { value: clip(body.kintone_subdomain, 80) },
    interest:          { value: interest },
    notes:             { value: clip(body.notes, 4000) },
    event_name:        { value: clip(body.event_name, 120) },
    captured_by:       { value: clip(body.captured_by, 80) },
    source:            { value: clip(body.source, 60) || 'booth-form' },
    user_agent:        { value: clip(body.ua, 300) },
    consent:           { value: body.consent ? ['Agreed to be contacted'] : [] },
  };
  if (ALLOWED_STATUS.has(body.kintone_status))  record.kintone_status = { value: body.kintone_status };
  if (ALLOWED_PRIORITY.has(body.priority))      record.priority       = { value: body.priority };
  if (ALLOWED_COUNTRY.has(body.country))        record.country        = { value: body.country };

  const base = env.KINTONE_BASE || 'https://edamame.kintone.com';
  let res, text;
  try {
    res = await fetch(`${base}/k/v1/record.json`, {
      method: 'POST',
      headers: {
        'X-Cybozu-API-Token': env.KINTONE_LEAD_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ app: env.KINTONE_LEAD_APP, record }),
    });
    text = await res.text();
  } catch (e) {
    return json({ ok: false, error: 'kintone_unreachable' }, 502);
  }

  if (res.ok) {
    let id = null;
    try { id = JSON.parse(text).id; } catch {}
    return json({ ok: true, id, lead_id: leadId });
  }

  // Already stored on an earlier attempt — treat as done so the queue stops retrying.
  if (/GAIA_UQ01|duplicate|重複/i.test(text)) {
    return json({ ok: true, duplicate: true, lead_id: leadId });
  }

  return json({ ok: false, error: 'kintone_rejected', status: res.status, detail: text.slice(0, 300) }, 502);
}
