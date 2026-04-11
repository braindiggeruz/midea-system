import { describe, expect, it } from 'vitest';

describe('Cloudflare secret validation', () => {
  it('can read the midea-alba.uz zone using CLOUDFLARE_API_TOKEN', async () => {
    const token = process.env.CLOUDFLARE_API_TOKEN;

    expect(token, 'CLOUDFLARE_API_TOKEN must be configured').toBeTruthy();

    const response = await fetch('https://api.cloudflare.com/client/v4/zones?name=midea-alba.uz&per_page=1', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    expect(response.ok, `Cloudflare API responded with ${response.status}`).toBe(true);

    const payload = (await response.json()) as {
      success?: boolean;
      result?: Array<{ id: string; name: string }>;
      errors?: Array<{ message?: string }>;
    };

    expect(payload.success, JSON.stringify(payload.errors ?? payload)).toBe(true);
    expect(Array.isArray(payload.result)).toBe(true);
    expect(payload.result?.[0]?.name).toBe('midea-alba.uz');
    expect(payload.result?.[0]?.id).toBeTruthy();

    const zoneId = payload.result?.[0]?.id;
    const dnsResponse = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=admin.midea-alba.uz&per_page=10`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    expect(dnsResponse.ok, `Cloudflare DNS API responded with ${dnsResponse.status}`).toBe(true);

    const dnsPayload = (await dnsResponse.json()) as {
      success?: boolean;
      result?: Array<{ id: string; name: string; type: string }>;
      errors?: Array<{ message?: string }>;
    };

    expect(dnsPayload.success, JSON.stringify(dnsPayload.errors ?? dnsPayload)).toBe(true);
    expect(Array.isArray(dnsPayload.result)).toBe(true);
  }, 20_000);
});
