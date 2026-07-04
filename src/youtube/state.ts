import fs from 'node:fs/promises';
import path from 'node:path';

const STATE_FILE = path.join(process.cwd(), 'data', 'youtube-state.json');

interface YoutubeState {
  episodeCount: number;
  lastEpisodeTimestamp: number | null;
}

async function readState(): Promise<YoutubeState> {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    return JSON.parse(raw) as YoutubeState;
  } catch {
    return { episodeCount: 0, lastEpisodeTimestamp: null };
  }
}

async function writeState(state: YoutubeState): Promise<void> {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

export async function getEpisodeCount(): Promise<number> {
  return (await readState()).episodeCount;
}

export async function incrementEpisode(): Promise<number> {
  const state = await readState();
  state.episodeCount += 1;
  state.lastEpisodeTimestamp = Date.now();
  await writeState(state);
  return state.episodeCount;
}

export async function isTimeForNewEpisode(intervalDays = 3): Promise<boolean> {
  const state = await readState();
  if (state.lastEpisodeTimestamp === null) return true;
  const elapsed = Date.now() - state.lastEpisodeTimestamp;
  return elapsed >= intervalDays * 24 * 3600 * 1000;
}
