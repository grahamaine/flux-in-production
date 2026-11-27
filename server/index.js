// FLUX Studio: local web app for the series. Run: npm run studio -> http://localhost:3000
// Binds to 127.0.0.1 only; the BFL key never leaves this machine's server process.
import express from 'express';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { generate, ENDPOINTS, hasKey } from '../src/bfl.js';
import {
  ROOT, OUTPUT, KEYFRAMES, slug, getBible, saveBible, listEpisodes, getShotlist, saveShotlist,
  createEpisode, shotPath, episodeCut, listFiles, hasFfmpeg, stitch,
} from '../src/project.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.use(express.json({ limit: '2mb' }));
app.use(express.static(join(ROOT, 'web')));
app.use('/media/output', express.static(OUTPUT));
app.use('/media/keyframes', express.static(KEYFRAMES));
app.use('/brand', express.static(join(ROOT, 'assets', 'brand')));

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  res.status(e.status || 500).json({ error: e.message });
});

// ---- Render jobs (in memory; renders on disk survive restarts) ----
const jobs = new Map();
function startJob(kind, label, run) {
  const job = { id: randomUUID(), kind, label, status: 'Queued', error: null, file: null, started: new Date().toISOString() };
  jobs.set(job.id, job);
  run((s) => { job.status = s; })
    .then((file) => { job.status = 'Done'; job.file = file; })
    .catch((e) => { job.status = 'Failed'; job.error = e.message; });
  return job;
}

app.get('/api/status', wrap(async (_req, res) => {
  res.json({ hasKey: hasKey(), ffmpeg: await hasFfmpeg() });
}));

app.get('/api/bible', wrap(async (_req, res) => res.json(await getBible())));
app.put('/api/bible', wrap(async (req, res) => { await saveBible(req.body); res.json({ ok: true }); }));

app.get('/api/episodes', wrap(async (_req, res) => res.json(await listEpisodes())));
app.post('/api/episodes', wrap(async (req, res) => {
  await createEpisode(req.body.episode, req.body.title);
  res.status(201).json({ ok: true });
}));
app.get('/api/episodes/:ep', wrap(async (req, res) => {
  const ep = slug(req.params.ep);
  const list = await getShotlist(ep);
  const renders = Object.fromEntries(list.shots.map((s) => [s.id, existsSync(shotPath(ep, s.id))]));
  res.json({ ...list, renders, cut: existsSync(episodeCut(ep)) });
}));
app.put('/api/episodes/:ep', wrap(async (req, res) => {
  await saveShotlist(req.params.ep, req.body);
  res.json({ ok: true });
}));

app.post('/api/episodes/:ep/shots/:id/render', wrap(async (req, res) => {
  if (!hasKey()) return res.status(400).json({ error: 'No BFL_API_KEY in .env' });
  const ep = slug(req.params.ep), id = slug(req.params.id);
  const list = await getShotlist(ep);
  const shot = list.shots.find((s) => s.id === id);
  if (!shot) return res.status(404).json({ error: 'Shot not found' });
  const draft = req.body?.draft ?? list.draft ?? true;
  const body = {
    prompt: [list.style, shot.prompt].filter(Boolean).join('\n\n'),
    duration: Number(shot.duration) || 8,
    aspect_ratio: list.aspect_ratio || '16:9',
    resolution: list.resolution || 'hd',
    generate_audio: true,
    draft,
  };
  const job = startJob('video', `${ep} / ${id}${draft ? ' (draft)' : ''}`,
    (onStatus) => generate(ENDPOINTS.video, body, shotPath(ep, id), { onStatus }).then(() => `${ep}/${id}.mp4`));
  res.status(202).json(job);
}));

app.post('/api/episodes/:ep/stitch', wrap(async (req, res) => res.json(await stitch(slug(req.params.ep)))));

app.get('/api/keyframes', wrap(async (_req, res) => res.json(await listFiles(KEYFRAMES, ['.jpg', '.jpeg', '.png', '.webp']))));
app.post('/api/keyframes', wrap(async (req, res) => {
  if (!hasKey()) return res.status(400).json({ error: 'No BFL_API_KEY in .env' });
  const name = slug(req.body.name);
  const prompt = String(req.body.prompt || '').trim();
  if (!prompt) return res.status(400).json({ error: 'Prompt is empty' });
  const out = join(KEYFRAMES, `${name}.jpg`);
  const job = startJob('image', `keyframe / ${name}`,
    (onStatus) => generate(ENDPOINTS.image, { prompt, aspect_ratio: req.body.aspect_ratio || '16:9' }, out, { onStatus }).then(() => `${name}.jpg`));
  res.status(202).json(job);
}));

app.get('/api/jobs', (_req, res) => res.json([...jobs.values()].reverse().slice(0, 50)));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  FLUX Studio running at http://localhost:${PORT}\n  Powered by thee AGENCY Consults (UG) Limited\n`);
  if (!hasKey()) console.log('  Note: no BFL_API_KEY in .env yet - writing works, rendering is disabled.\n');
});
