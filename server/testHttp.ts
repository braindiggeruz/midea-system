import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type CurlJsonResponse<T> = {
  status: number;
  json: T;
};

export async function requestJsonWithCurl<T>(
  url: string,
  headers: Record<string, string> = {}
): Promise<CurlJsonResponse<T>> {
  const args = [
    "--silent",
    "--show-error",
    "--location",
    "--connect-timeout",
    "10",
    "--max-time",
    "20",
    "--write-out",
    "\n__STATUS__:%{http_code}",
  ];

  for (const [key, value] of Object.entries(headers)) {
    args.push("--header", `${key}: ${value}`);
  }

  args.push(url);

  const { stdout, stderr } = await execFileAsync("curl", args);

  const marker = "\n__STATUS__:";
  const markerIndex = stdout.lastIndexOf(marker);

  if (markerIndex === -1) {
    throw new Error(`curl did not return an HTTP status marker. stderr: ${stderr}`);
  }

  const rawBody = stdout.slice(0, markerIndex).trim();
  const rawStatus = stdout.slice(markerIndex + marker.length).trim();
  const status = Number.parseInt(rawStatus, 10);

  if (!Number.isFinite(status)) {
    throw new Error(`curl returned an invalid status code: ${rawStatus}`);
  }

  let json: T;

  try {
    json = JSON.parse(rawBody) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse JSON response from ${url}. Status: ${status}. Body: ${rawBody}. Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return { status, json };
}
