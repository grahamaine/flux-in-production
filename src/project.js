// File-based project store: story/ holds the writing, output/ holds renders.
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

export const ROOT = resolve(import.meta.dirname, '..');
export const STORY = join(ROOT, 'story');
export const OUTPUT = join(ROOT, 'output');
export const KEYFRAMES = join(ROOT, 'assets', 'keyframes');

// Only simple slugs reach the file system (blocks ../ tricks).
export const SLUG = /^[a-z0-9][a-z0-9-]{0,60}$/;
export function slug(s) {
  if (!SLUG.test(s || '')) throw Object.assign(new Error(`Invalid name: ${s}`), { status: 400 });
  return s;
}

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}
async function writeJson(path, data) {
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + '\n');
}

export const EMPTY_BIBLE = {
  title: '', logline: '', hook: '', genre: '', world: '', style: '',
  characters: [], episodes: [],
};

export const getBible = () => readJson(join(STORY, 'series-bible.json'), EMPTY_BIBLE);
export const saveBible = (b) => writeJson(join(STORY, 'series-bible.json'), { ...EMPTY_BIBLE, ...b });

export async function listEpisodes() {
  const dirs = await readdir(STORY, { withFileTypes: true }).catch(() => []);
  const eps = [];
  for (const d of dirs) {
    if (!d.isDirectory() || !SLUG.test(d.name)) continue;
    const list = await readJson(join(STORY, d.name, 'shotlist.json'), null);
    if (list) eps.push({ episode: d.name, title: list.title || d.name, shots: list.shots?.length || 0 });
  }
  return eps.sort((a, b) => a.episode.localeCompare(b.episode));
}

export async function getShotlist(ep) {
  const list = await readJson(join(STORY, slug(ep), 'shotlist.json'), null);
  if (!list) throw Object.assign(new Error('Episode not found'), { status: 404 });
  return list;
}
export async function saveShotlist(ep, list) {
  slug(ep);
  for (const s of list.shots || []) slug(s.id);
  const ids = (list.shots || []).map((s) => s.id);
  if (new Set(ids).size !== ids.length) throw Object.assign(new Error('Shot ids must be unique'), { status: 400 });
  await writeJson(join(STORY, ep, 'shotlist.json'), { ...list, episode: ep });
}
export async function createEpisode(ep, title) {
  slug(ep);
  if (existsSync(join(STORY, ep, 'shotlist.json'))) throw Object.assign(new Error('Episode exists'), { status: 409 });
  await saveShotlist(ep, {
    episode: ep, title: title || ep, aspect_ratio: '16:9', resolution: 'hd', draft: true,
    style: 'Prestige TV drama, 35mm look, natural light, consistent characters and wardrobe across shots.',
    shots: [],
  });
}

export const shotPath = (ep, id) => join(OUTPUT, slug(ep), `${slug(id)}.mp4`);
export const episodeCut = (ep) => join(OUTPUT, `${slug(ep)}.mp4`);

export async function listFiles(dir, exts) {
  const files = await readdir(dir).catch(() => []);
  const out = [];
  for (const f of files) {
    if (!exts.some((e) => f.toLowerCase().endsWith(e))) continue;
    const s = await stat(join(dir, f));
    out.push({ name: f, size: s.size, modified: s.mtime.toISOString() });
  }
  return out.sort((a, b) => b.modified.localeCompare(a.modified));
}

export function hasFfmpeg() {
  return new Promise((done) => {
    const p = spawn('ffmpeg', ['-version'], { stdio: 'ignore' });
    p.on('error', () => done(false));
    p.on('exit', (code) => done(code === 0));
  });
}

// Joins rendered shots in shot-list order. Works on Windows, macOS and Linux.
export async function stitch(ep) {
  const list = await getShotlist(ep);
  const parts = list.shots.map((s) => shotPath(ep, s.id)).filter((p) => existsSync(p));
  if (!parts.length) throw Object.assign(new Error('No rendered shots yet'), { status: 400 });
  const concat = join(OUTPUT, ep, 'concat.txt');
  await writeFile(concat, parts.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  const out = episodeCut(ep);
  const args = ['-y', '-f', 'concat', '-safe', '0', '-i', concat,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', out];
  await new Promise((done, fail) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err = (err + d).slice(-2000); });
    p.on('error', () => fail(new Error('ffmpeg not found - install it (winget install Gyan.FFmpeg)')));
    p.on('exit', (code) => (code === 0 ? done() : fail(new Error(`ffmpeg failed: ${err.split('\n').slice(-4).join(' ')}`))));
  });
  return { file: `${ep}.mp4`, shots: parts.length, skipped: list.shots.length - parts.length };
}
