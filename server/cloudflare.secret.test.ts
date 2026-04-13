import { describe, expect, it } from "vitest";

import { requestJsonWithCurl } from "./testHttp";

describe("Cloudflare secret validation", () => {
  it("can read the midea-alba.uz zone using CLOUDFLARE_API_TOKEN", async () => {
    const token = process.env.CLOUDFLARE_API_TOKEN;

    expect(token, "CLOUDFLARE_API_TOKEN must be configured").toBeTruthy();

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const zoneResponse = await requestJsonWithCurl<{
      success?: boolean;
      result?: Array<{ id: string; name: string }>;
      errors?: Array<{ message?: string }>;
    }>("https://api.cloudflare.com/client/v4/zones?name=midea-alba.uz&per_page=1", headers);

    expect(zoneResponse.status, `Cloudflare API responded with ${zoneResponse.status}`).toBe(200);
    expect(zoneResponse.json.success, JSON.stringify(zoneResponse.json.errors ?? zoneResponse.json)).toBe(true);
    expect(Array.isArray(zoneResponse.json.result)).toBe(true);
    expect(zoneResponse.json.result?.[0]?.name).toBe("midea-alba.uz");
    expect(zoneResponse.json.result?.[0]?.id).toBeTruthy();

    const zoneId = zoneResponse.json.result?.[0]?.id;

    const dnsResponse = await requestJsonWithCurl<{
      success?: boolean;
      result?: Array<{ id: string; name: string; type: string }>;
      errors?: Array<{ message?: string }>;
    }>(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=admin.midea-alba.uz&per_page=10`,
      headers
    );

    expect(dnsResponse.status, `Cloudflare DNS API responded with ${dnsResponse.status}`).toBe(200);
    expect(dnsResponse.json.success, JSON.stringify(dnsResponse.json.errors ?? dnsResponse.json)).toBe(true);
    expect(Array.isArray(dnsResponse.json.result)).toBe(true);
  }, 20_000);
});
