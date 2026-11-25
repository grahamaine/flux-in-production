# FLUX: In Production — TV Series with RTL

Our entry to **FLUX: In Production**, the Black Forest Labs × Encode Club AI film programme (30 Nov – 13 Dec 2026), on the **TV Series with RTL** track.

Pipeline: series bible → shot list → FLUX 3 video (native audio) → stitched episode.

## Setup

```bash
git clone https://github.com/grahamaine/flux-in-production.git
cd flux-in-production
npm install
cp .env.example .env        # add your BFL_API_KEY from https://dashboard.bfl.ai
npx skills add black-forest-labs/skills   # optional: official FLUX prompting skills for coding agents
```

Requires Node 20+ and ffmpeg.

## Use

```bash
npm run video -- "A rain-soaked Berlin street at night, a detective looks up" output/test.mp4 8 16:9
npm run image -- "Character sheet: ..." assets/keyframes/lead.jpg
npm run shots     # render every shot in story/episode-01/shotlist.json (drafts by default)
npm run stitch    # join output/episode-01/*.mp4 into output/episode-01.mp4
```

Result URLs from the BFL API expire after ~10 minutes; the client downloads immediately and writes a secret-free `.json` record next to each file.

## Layout

| Path | What |
|------|------|
| `briefs/` | Track brief, dates and rules checklist |
| `story/` | Series bible and per-episode shot lists |
| `src/bfl.js` | BFL API client (submit → poll → download) |
| `scripts/` | Generate video/images, render shot lists, stitch |
| `assets/keyframes/` | Character/location stills for continuity |
| `output/` | Renders (git-ignored) |

## References
- BFL API docs: https://docs.bfl.ai
- Official BFL skills: https://github.com/black-forest-labs/skills

---

Powered and rendered by **thee AGENCY Consults (UG) Limited** — *Innovation Unleashed*
ainegb05@gmail.com · WhatsApp +256 742 701 202 · Call +256 704 533 541
