import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

const VIEWPORT_SIZE = 288;
const OUTPUT_SIZE = 512;
const MAX_ZOOM = 4;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function AvatarCropModal({ file, onCancel, onSave, saving }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [natural, setNatural] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  // Creating the object URL as a useState initializer (rather than in this
  // effect) would leave it permanently revoked under React 18 StrictMode:
  // dev-mode double-invokes effects (mount -> cleanup -> mount) to surface
  // exactly this kind of bug, so a cleanup tied to a URL created outside
  // the effect revokes it after that first phantom mount with nothing to
  // re-create it. Creating and revoking inside the same effect means each
  // invocation's cleanup only ever revokes the URL that invocation made.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = natural ? Math.max(VIEWPORT_SIZE / natural.w, VIEWPORT_SIZE / natural.h) : 1;
  const scale = baseScale * zoom;
  const displayedW = natural ? natural.w * scale : 0;
  const displayedH = natural ? natural.h * scale : 0;

  function clampPos(x, y, w, h) {
    return {
      x: clamp(x, VIEWPORT_SIZE - w, 0),
      y: clamp(y, VIEWPORT_SIZE - h, 0),
    };
  }

  function handleImageLoad(e) {
    const w = e.target.naturalWidth;
    const h = e.target.naturalHeight;
    const bs = Math.max(VIEWPORT_SIZE / w, VIEWPORT_SIZE / h);
    setNatural({ w, h });
    setPos({ x: (VIEWPORT_SIZE - w * bs) / 2, y: (VIEWPORT_SIZE - h * bs) / 2 });
  }

  // Zooming keeps whatever is currently at the viewport center fixed,
  // instead of re-centering on the image's top-left corner.
  function handleZoomChange(nextZoom) {
    if (!natural) return;
    const nextScale = baseScale * nextZoom;
    const nextW = natural.w * nextScale;
    const nextH = natural.h * nextScale;
    const center = VIEWPORT_SIZE / 2;
    const imgX = (center - pos.x) / scale;
    const imgY = (center - pos.y) / scale;
    setZoom(nextZoom);
    setPos(clampPos(center - imgX * nextScale, center - imgY * nextScale, nextW, nextH));
  }

  function handlePointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origin: pos };
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos(
      clampPos(dragRef.current.origin.x + dx, dragRef.current.origin.y + dy, displayedW, displayedH)
    );
  }

  function handlePointerUp(e) {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function handleSave() {
    if (!natural) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      const sourceSize = VIEWPORT_SIZE / scale;
      ctx.drawImage(img, -pos.x / scale, -pos.y / scale, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      canvas.toBlob(
        (blob) => {
          if (blob) onSave(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.92
      );
    };
    img.src = imageUrl;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800">
        <h2 className="font-display text-lg font-semibold text-ink-900 dark:text-white">Adjust your photo</h2>
        <p className="mt-1 text-xs text-slate-400">Drag to reposition, use the slider to zoom.</p>

        <div
          className="relative mx-auto mt-4 touch-none select-none overflow-hidden rounded-lg bg-slate-900"
          style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            onLoad={handleImageLoad}
            className="absolute max-w-none"
            style={{ left: pos.x, top: pos.y, width: displayedW, height: displayedH }}
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55)' }}
          />
        </div>

        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => handleZoomChange(Number(e.target.value))}
          disabled={!natural}
          className="mt-4 w-full accent-brand-500"
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!natural || saving}
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />} Save photo
          </button>
        </div>
      </div>
    </div>
  );
}
