// Minimal BFL API client: submit -> poll the returned polling_url -> download.
// Model IDs / fields change often: confirm against https://docs.bfl.ai before a run.
import 'dotenv/config';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const BASE = process.env.BFL_API_BASE || 'https://api.bfl.ai';
const KEY = process.env.BFL_API_KEY;

export const ENDPOINTS = {
  video: '/v1/flux-3-video',
  image: '/v1/flux-3-image',
  imageKlein: '/v1/flux-3-image-klein',
};

function headers() {
  if (!KEY) throw new Error('BFL_API_KEY missing - copy .env.example to .env');
  return { 'x-key': KEY, 'Content-Type': 'application/json', accept: 'application/json' };
}

export async function submit(endpoint, body) {
  const res = await fetch(BASE + endpoint, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Submit ${res.status}: ${JSON.stringify(json)}`);
  return json; // { id, polling_url, ... }
}

export async function poll(pollingUrl, { intervalMs = 3000, timeoutMs = 15 * 60_000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(pollingUrl, { headers: headers() });
    const json = await res.json().catch(() => ({}));
    const status = json.status;
    if (status === 'Ready') return json;
    if (['Error', 'Failed', 'Request Moderated', 'Content Moderated', 'Task not found'].includes(status)) {
      throw new Error(`Task ended with status "${status}": ${JSON.stringify(json)}`);
    }
    process.stdout.write(`  ${status ?? res.status}...\r`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Polling timed out');
}

// result.sample URLs expire after ~10 minutes: download straight away.
export async function download(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download ${res.status}`);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, Buffer.from(await res.arrayBuffer()));
  return outPath;
}

export async function generate(endpoint, body, outPath) {
  const task = await submit(endpoint, body);
  console.log(`Submitted ${task.id}`);
  const done = await poll(task.polling_url);
  const url = done.result?.sample;
  if (!url) throw new Error(`No result.sample in ${JSON.stringify(done)}`);
  await download(url, outPath);
  // Secret-free record of what was asked for and what came back.
  await writeFile(outPath + '.json', JSON.stringify({ endpoint, body, id: task.id, finishedAt: new Date().toISOString() }, null, 2));
  console.log(`Saved ${outPath}`);
  return outPath;
}
