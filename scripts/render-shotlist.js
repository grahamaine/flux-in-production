// Renders every shot in a shotlist JSON into output/<episode>/NN-<id>.mp4
// Usage: npm run shots   (or: node scripts/render-shotlist.js path/to/shotlist.json)
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { generate, ENDPOINTS } from '../src/bfl.js';

const file = process.argv[2] || 'story/episode-01/shotlist.json';
const list = JSON.parse(await readFile(file, 'utf8'));
const outDir = `output/${list.episode}`;

for (const [i, shot] of list.shots.entries()) {
  const out = `${outDir}/${String(i + 1).padStart(2, '0')}-${shot.id}.mp4`;
  if (existsSync(out)) { console.log(`skip ${out}`); continue; }
  console.log(`\n[${i + 1}/${list.shots.length}] ${shot.id}`);
  await generate(
    ENDPOINTS.video,
    {
      prompt: `${list.style}\n\n${shot.prompt}`,
      duration: shot.duration ?? 8,
      aspect_ratio: list.aspect_ratio ?? '16:9',
      resolution: list.resolution ?? 'hd',
      generate_audio: true,
      draft: list.draft ?? true,
    },
    out,
  );
}
