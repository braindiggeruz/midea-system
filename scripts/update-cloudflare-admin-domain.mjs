const token = process.env.CLOUDFLARE_API_TOKEN;
const zoneName = process.env.CLOUDFLARE_ZONE_NAME || 'midea-alba.uz';
const recordName = process.env.CLOUDFLARE_RECORD_NAME || 'admin.midea-alba.uz';
const newTarget = process.env.CLOUDFLARE_NEW_TARGET || 'h7tq7iiv.up.railway.app';

if (!token) {
  throw new Error('CLOUDFLARE_API_TOKEN is not configured');
}

async function cf(path, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const payload = await response.json();

  if (!response.ok || payload.success === false) {
    throw new Error(`Cloudflare API error for ${path}: ${JSON.stringify(payload)}`);
  }

  return payload;
}

const zonePayload = await cf(`/zones?name=${encodeURIComponent(zoneName)}&per_page=1`);
const zone = zonePayload.result?.[0];

if (!zone?.id) {
  throw new Error(`Zone not found for ${zoneName}`);
}

const recordsPayload = await cf(
  `/zones/${zone.id}/dns_records?name=${encodeURIComponent(recordName)}&per_page=100`
);

const existing = (recordsPayload.result || []).find((record) =>
  record.name === recordName && (record.type === 'CNAME' || record.type === 'A')
);

const desiredRecord = {
  type: 'CNAME',
  name: recordName,
  content: newTarget,
  ttl: 1,
  proxied: false,
  comment: 'Updated by Manus to complete Railway custom domain rebind and certificate issuance',
};

let result;
if (existing?.id) {
  result = await cf(`/zones/${zone.id}/dns_records/${existing.id}`, {
    method: 'PUT',
    body: JSON.stringify(desiredRecord),
  });
} else {
  result = await cf(`/zones/${zone.id}/dns_records`, {
    method: 'POST',
    body: JSON.stringify(desiredRecord),
  });
}

console.log(JSON.stringify({
  zoneId: zone.id,
  zoneName,
  recordAction: existing?.id ? 'updated' : 'created',
  recordId: result.result?.id,
  recordName,
  target: result.result?.content,
  proxied: result.result?.proxied,
  ttl: result.result?.ttl,
}, null, 2));
