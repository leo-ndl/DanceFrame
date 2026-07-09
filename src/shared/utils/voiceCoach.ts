import Tts from 'react-native-tts';

// Speaks coaching feedback so it can be heard mid-dance, when the user can't
// read a screen. Wraps react-native-tts behind a single-utterance queue so
// milestone/coaching/summary lines never overlap or clip mid-word — only one
// voice line plays at a time. Policy: never interrupt what's currently
// speaking; queue depth is capped at 1, and a new arrival replaces whatever
// is pending unless the pending item outranks it (freshest signal wins,
// except a lower-priority coaching tip never bumps a queued milestone).
export type VoicePriority = 'milestone' | 'coaching' | 'summary';

const PRIORITY_RANK: Record<VoicePriority, number> = { milestone: 2, coaching: 1, summary: 0 };

let initialized = false;
let speaking = false;
let pending: { text: string; priority: VoicePriority } | null = null;

function drain(): void {
  if (speaking || !pending) return;
  const next = pending;
  pending = null;
  speaking = true;
  Tts.speak(next.text);
}

function onFinished(): void {
  speaking = false;
  drain();
}

function enqueue(text: string, priority: VoicePriority): void {
  if (!text) return;
  if (!speaking) {
    speaking = true;
    Tts.speak(text);
    return;
  }
  if (!pending || PRIORITY_RANK[priority] >= PRIORITY_RANK[pending.priority]) {
    pending = { text, priority };
  }
}

export const voiceCoach = {
  init: async (): Promise<void> => {
    if (initialized) return;
    initialized = true;
    try {
      await Tts.getInitStatus();
      Tts.setDefaultRate(0.5);
      Tts.setIgnoreSilentSwitch('ignore');
      Tts.addEventListener('tts-finish', onFinished);
      Tts.addEventListener('tts-cancel', onFinished);
      Tts.addEventListener('tts-error', onFinished);
    } catch {
      // No TTS engine available on this device — coaching stays silent
      // rather than crashing the practice session.
      initialized = false;
    }
  },
  speakCoaching: (text: string): void => enqueue(text, 'coaching'),
  speakMilestone: (text: string): void => enqueue(text, 'milestone'),
  speakSummary: (text: string): void => enqueue(text, 'summary'),
  stop: (): void => {
    pending = null;
    speaking = false;
    try {
      // react-native-tts's iOS stop() throws synchronously on this RN
      // version's New Architecture interop layer regardless of the arg
      // passed — a library/newArch bridging incompatibility, not
      // something fixable from the call site. Swallow it: stop() is
      // best-effort cleanup, not core functionality, so a failure here
      // must never crash the screen that called it.
      Tts.stop(false);
    } catch {
      // no-op
    }
  },
};
