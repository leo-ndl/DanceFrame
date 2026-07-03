export interface ExtractionErrorInfo {
  title: string;
  message: string;
  /** If true, screen should navigate back silently without any Alert. */
  silent?: boolean;
}

const EXTRACTION_ERROR_MAP: Record<string, ExtractionErrorInfo> = {
  E_PICKER_CANCELLED: { title: '', message: '', silent: true },
  E_PICKER_BUSY: {
    title: 'Picker Busy',
    message: 'Another video picker is already open. Please try again.',
  },
  E_INVALID_TYPE: {
    title: 'Unsupported File',
    message: 'The selected item is not a video. Please choose a video file.',
  },
  E_LOAD_FAILED: {
    title: 'Couldn’t Load Video',
    message: 'We couldn’t load that video. Try picking it again or choose a different file.',
  },
  E_COPY_FAILED: {
    title: 'Import Failed',
    message: 'We couldn’t import this video. Please try again.',
  },
  E_PERSIST_FAILED: {
    title: 'Import Failed',
    message: 'We couldn’t save this video. Please try again.',
  },
  E_INVALID_URI: {
    title: 'Import Failed',
    message: 'This video reference looks invalid. Please try picking it again.',
  },
  E_NO_URI: {
    title: 'Import Failed',
    message: 'No video was received. Please try again.',
  },
  E_INVALID_VIDEO: {
    title: 'Invalid Video',
    message: 'We couldn’t read this video file. Try a different video.',
  },
  E_DURATION_EXCEEDED: {
    title: 'Video Too Long',
    message: 'Videos must be 90 seconds or shorter. Trim your video and try again.',
  },
  E_EXTRACTION_FAILED: {
    title: 'Extraction Failed',
    message: 'We couldn’t analyse this video’s movement. Make sure a person is clearly visible and try again.',
  },
  E_NO_ACTIVITY: {
    title: 'Import Failed',
    message: 'Something went wrong opening the picker. Please try again.',
  },
  E_NO_AUDIO_TRACK: {
    title: 'No Audio Found',
    message: 'This video has no audio track, so we can’t detect beats. Try a different video.',
  },
  E_AUDIO_EXTRACTION_FAILED: {
    title: 'Import Failed',
    message: 'We couldn’t analyse this video’s audio. Please try again.',
  },
  E_LOW_CONFIDENCE: {
    title: 'Couldn’t Detect Your Movement',
    message: 'We had trouble tracking your movement — make sure you’re fully in frame with good lighting, and only one person is visible.',
  },
};

const DEFAULT_ERROR: ExtractionErrorInfo = {
  title: 'Extraction Failed',
  message: 'Could not process this video. Please try again.',
};

export function getExtractionErrorInfo(err: unknown): ExtractionErrorInfo {
  const code = (err as { code?: string } | null)?.code;
  if (code && EXTRACTION_ERROR_MAP[code]) return EXTRACTION_ERROR_MAP[code];
  return DEFAULT_ERROR;
}
