import { FileText } from 'lucide-react';
import { assetSrc } from '../lib/avatar.js';
import { formatBytes } from '../lib/messageFiles.js';

// Shows the files that came with a message: images inline, audio and video
// with players, documents as download links. Used in the notification bell and
// the customer's Notifications page. `onOpen` lets the caller mark the message
// read when the person actually looks at or plays something.
export default function MessageAttachments({ attachments, onOpen }) {
  if (!Array.isArray(attachments) || attachments.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {attachments.map((a, index) => {
        const src = assetSrc(a.url);
        const key = `${a.url}-${index}`;

        if (a.kind === 'image') {
          return (
            <a key={key} href={src} target="_blank" rel="noopener noreferrer" onClick={onOpen} className="block w-fit">
              <img
                src={src}
                alt={a.name}
                loading="lazy"
                className="max-h-48 max-w-full rounded-lg border border-slate-100 object-cover dark:border-slate-700"
              />
            </a>
          );
        }

        if (a.kind === 'audio') {
          return (
            <div key={key}>
              <audio controls preload="none" src={src} onPlay={onOpen} className="h-10 w-full max-w-xs" aria-label={a.name} />
              <p className="mt-0.5 truncate text-[11px] text-slate-400">{a.name}</p>
            </div>
          );
        }

        if (a.kind === 'video') {
          return (
            <div key={key}>
              <video
                controls
                preload="metadata"
                src={src}
                onPlay={onOpen}
                className="max-h-56 max-w-full rounded-lg bg-black"
                aria-label={a.name}
              />
              <p className="mt-0.5 truncate text-[11px] text-slate-400">{a.name}</p>
            </div>
          );
        }

        return (
          <a
            key={key}
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onOpen}
            className="flex w-fit max-w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-ink-900 transition hover:border-brand-300 hover:text-brand-600 dark:border-slate-600 dark:text-white"
          >
            <FileText size={14} className="shrink-0 text-brand-500" />
            <span className="truncate">{a.name}</span>
            {a.size ? <span className="shrink-0 font-normal text-slate-400">{formatBytes(a.size)}</span> : null}
          </a>
        );
      })}
    </div>
  );
}
