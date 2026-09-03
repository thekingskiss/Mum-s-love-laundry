export default function SectionHeading({ eyebrow, title, center = true, light = false }) {
  return (
    <div className={center ? 'text-center' : ''}>
      <h2 className={`font-display text-3xl font-semibold sm:text-4xl ${light ? 'text-white' : 'text-ink-900 dark:text-white'}`}>
        {title}
      </h2>
      <div className={`mt-5 h-px w-24 ${light ? 'bg-white/30' : 'bg-slate-200 dark:bg-slate-700'} ${center ? 'mx-auto' : ''}`} />
      {eyebrow && (
        <p className={`mt-5 text-xs font-bold uppercase tracking-widest ${light ? 'text-brand-200' : 'text-brand-600 dark:text-brand-400'}`}>
          {eyebrow}
        </p>
      )}
    </div>
  );
}
