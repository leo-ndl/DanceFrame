import { BeatSegment } from '../types/beatSegment.types';

// Onset/strong-beat detection from a broadband audio energy envelope —
// NOT full tempo-grid beat-tracking (no autocorrelation/BPM lock-step).
// Peak-picks local maxima in energy flux above a percentile threshold, the
// same architectural pattern as MovementSegmenter.ts's stillness/spike
// detection, just fed by audio energy instead of motion complexity. This is
// deliberately simple: no FFT, no spectral analysis — just RMS energy and
// its first difference, which is enough to find strong beats/phrase changes.

const MIN_SEGMENT_MS = 800;
const FLUX_PERCENTILE = 0.85;

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * p)] ?? 0;
}

function computeFlux(envelope: number[]): number[] {
  const flux = new Array(envelope.length).fill(0);
  for (let i = 1; i < envelope.length; i++) {
    flux[i] = Math.max(0, envelope[i] - envelope[i - 1]);
  }
  return flux;
}

function detectBoundaryIndices(envelope: number[]): number[] {
  if (envelope.length === 0) return [];
  const flux = computeFlux(envelope);
  const threshold = percentile(flux, FLUX_PERCENTILE);

  const boundaries: number[] = [0];
  for (let i = 1; i < flux.length - 1; i++) {
    const isPeak = flux[i] > threshold && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1];
    if (isPeak && boundaries[boundaries.length - 1] !== i) {
      boundaries.push(i);
    }
  }
  boundaries.push(envelope.length - 1);
  return [...new Set(boundaries)].sort((a, b) => a - b);
}

export function segmentByBeats(
  envelope: number[],
  windowMs: number,
  durationMs: number,
): BeatSegment[] {
  if (envelope.length === 0) return [];

  const boundaries = detectBoundaryIndices(envelope);
  const rawSegments: Array<{ startMs: number; endMs: number }> = [];

  for (let b = 0; b < boundaries.length - 1; b++) {
    const startIdx = boundaries[b];
    const endIdx = boundaries[b + 1];
    const startMs = startIdx * windowMs;
    const endMs = endIdx === envelope.length - 1 ? durationMs : endIdx * windowMs;
    if (endMs <= startMs) continue;
    rawSegments.push({ startMs, endMs });
  }
  if (rawSegments.length === 0) {
    return [{ startMs: 0, endMs: durationMs, label: 'Segment 1' }];
  }

  // Merge segments shorter than MIN_SEGMENT_MS into their neighbour.
  const merged: Array<{ startMs: number; endMs: number }> = [];
  for (const seg of rawSegments) {
    const last = merged[merged.length - 1];
    if (last && seg.endMs - seg.startMs < MIN_SEGMENT_MS) {
      merged[merged.length - 1] = { startMs: last.startMs, endMs: seg.endMs };
    } else {
      merged.push(seg);
    }
  }

  return merged.map((seg, i) => ({ ...seg, label: `Segment ${i + 1}` }));
}

// Optional nice-to-have: approximate BPM from the median inter-segment
// interval, octave-corrected into a plausible dance-tempo range. Not a real
// tempo-tracker — just a cheap way to replace the previously-hardcoded 120.
export function estimateBpm(segments: BeatSegment[]): number | undefined {
  if (segments.length < 2) return undefined;

  const intervals = segments.slice(1).map((seg, i) => seg.startMs - segments[i].startMs).filter(ms => ms > 0);
  if (intervals.length === 0) return undefined;

  const sorted = [...intervals].sort((a, b) => a - b);
  const medianMs = sorted[Math.floor(sorted.length / 2)];
  if (medianMs <= 0) return undefined;

  let bpm = 60000 / medianMs;
  while (bpm < 60) bpm *= 2;
  while (bpm > 180) bpm /= 2;
  return Math.round(bpm);
}
