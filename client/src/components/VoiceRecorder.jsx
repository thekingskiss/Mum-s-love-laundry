import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';

const MAX_SECONDS = 5 * 60;
// First one the browser supports wins. Chrome/Firefox record webm or ogg,
// Safari records mp4.
const CANDIDATES = [
  { mime: 'audio/webm;codecs=opus', type: 'audio/webm', ext: 'webm' },
  { mime: 'audio/webm', type: 'audio/webm', ext: 'webm' },
  { mime: 'audio/ogg;codecs=opus', type: 'audio/ogg', ext: 'ogg' },
  { mime: 'audio/mp4', type: 'audio/mp4', ext: 'm4a' },
];

export function canRecordAudio() {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

function clock(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

// Records a voice note from the microphone and hands it back as a File, which
// the composer attaches like any other audio file.
export default function VoiceRecorder({ onRecorded, disabled }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  function release() {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  // Leaving the page mid-recording must not leave the microphone on.
  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
      }
      release();
    },
    []
  );

  async function start() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const choice = CANDIDATES.find((c) => window.MediaRecorder.isTypeSupported?.(c.mime)) || CANDIDATES[0];
      const recorder = new window.MediaRecorder(stream, { mimeType: choice.mime });
      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        release();
        setRecording(false);
        if (!chunks.length) return;
        // Digits only, e.g. 202611081324. Don't list the separators in a bracket
        // pattern here: Tailwind's class scanner reads that as an arbitrary-property
        // class and emits a junk CSS rule (and a build warning).
        const stamp = new Date().toISOString().slice(0, 16).replace(/\D/g, '');
        const file = new File([new Blob(chunks, { type: choice.type })], `voice-note-${stamp}.${choice.ext}`, {
          type: choice.type,
        });
        onRecorded(file);
      };
      recorderRef.current = recorder;
      recorder.start();
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) recorder.stop();
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      release();
      setRecording(false);
      setError(
        err?.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it in your browser to record.'
          : 'Could not start recording on this device.'
      );
    }
  }

  function stop() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  }

  if (!canRecordAudio()) return null;

  return (
    <div className="flex items-center gap-2">
      {recording ? (
        <button
          type="button"
          onClick={stop}
          className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600"
        >
          <Square size={12} className="fill-current" />
          Stop · {clock(seconds)}
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={disabled}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300"
        >
          <Mic size={13} />
          Record voice note
        </button>
      )}
      {recording && <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden="true" />}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
