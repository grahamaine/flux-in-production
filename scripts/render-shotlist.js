// Renders every shot of an episode that has no file yet: output/<episode>/<shot-id>.mp4
// Usage: npm run shots -- [episode-01] [--final]
import { existsSync } from 'node:fs';
import { generate, ENDPOINTS } from '../src/bfl.js';
import { getShotlist, shotPath } from '../src/project.js';

const ep = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'episode-01';
const final = process.argv.includes('--final');
const list = await getShotlist(ep);

for (const [i, shot] of list.shots.entries()) {
  const out = shotPath(ep, shot.id);
  if (existsSync(out)) { console.log(`skip ${shot.id} (already rendered)`); continue; }
  console.log(`\n[${i + 1}/${list.shots.length}] ${shot.id}`);
  await generate(ENDPOINTS.video, {
    prompt: [list.style, shot.prompt].filter(Boolean).join('\n\n'),
    duration: Number(shot.duration) || 8,
    aspect_ratio: list.aspect_ratio ?? '16:9',
    resolution: list.resolution ?? 'hd',
    generate_audio: true,
    draft: !final && (list.draft ?? true),
  }, out);
}
