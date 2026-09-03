import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AnimatePresence, motion } from 'framer-motion';
import { MapPinned, Timer, Users, WashingMachine } from 'lucide-react';
import SectionHeading from '../components/SectionHeading.jsx';
import ScrollReveal from '../components/ScrollReveal.jsx';
import AnimatedNumber from '../components/AnimatedNumber.jsx';
import heroLaundryWoman from '../assets/hero-laundry-woman.jpg';
import laundromatMachines from '../assets/laundromat-machines.jpg';
import foldingClothes from '../assets/folding-clothes.jpg';
import laundryRoom from '../assets/laundry-room.jpg';

const withCommas = (n) => Math.round(n).toLocaleString();

// `value` is the number that counts up; `prefix`/`suffix` are the static
// text around it (a range like "24–48 hrs" keeps "24–" fixed and only
// counts up to 48, since animating both ends of a range reads as noise).
const STATS = [
  { icon: Users, value: 500, suffix: '+', label: 'Clients per Month' },
  { icon: WashingMachine, value: 2000, suffix: ' lbs', format: withCommas, label: 'Laundry Washed Weekly' },
  { icon: MapPinned, value: 8, suffix: ' Towns', label: 'Served Across the Region' },
  { icon: Timer, value: 48, prefix: '24–', suffix: ' hrs', label: 'Average Turnaround' },
];

// Counts up from 0 to `value` every time it scrolls into view (not just the
// first time) — resets back to unrevealed on scroll-out so re-entering
// triggers AnimatedNumber's effect again instead of staying at the target.
function AnimatedStat({ icon: Icon, value, prefix = '', suffix = '', format, label, delay }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <ScrollReveal delay={delay} once={false} onReveal={() => setRevealed(true)} onLeave={() => setRevealed(false)}>
      <Icon className="mx-auto text-brand-300" size={28} />
      <p className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
        {prefix}
        <AnimatedNumber value={revealed ? value : 0} format={format} />
        {suffix}
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-white/70">{label}</p>
    </ScrollReveal>
  );
}

const TESTIMONIALS = [
  {
    name: 'Ama Serwaa, Koforidua',
    quote:
      "I drop my laundry off on my way to work and it's always ready exactly when they say. Best laundry service in the Eastern Region!",
  },
  {
    name: 'Kwabena Asante, Akropong',
    quote:
      'Reliable, on time, every time. I run a small guesthouse and they handle all our linens without a single complaint from guests.',
  },
  {
    name: 'Efua Mensah, Aburi',
    quote:
      "No appointment, no hassle — I just walk in on my way home. My shirts come back pressed better than I could ever do myself.",
  },
  {
    name: 'Yaw Boateng, Larteh',
    quote:
      "I travel for work every other week and never have to think twice about my laundry. It's always ready within two days, exactly as promised.",
  },
  {
    name: 'Abena Owusu, Mampong Akuapem',
    quote:
      'I trusted them with a delicate wedding dress and they handled it with so much care. Genuinely feels like family looking after your things.',
  },
];

// Cycles through testimonials automatically (one slides out as the next
// slides in), pausing while the visitor's cursor is on it, with dots for
// manual control. AnimatePresence handles the exit/enter pair so the
// outgoing quote never just vanishes — it hands off to the next.
function TestimonialCarousel({ testimonials }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [paused, testimonials.length]);

  const current = testimonials[index];

  return (
    <div
      className="mx-auto mt-14 max-w-2xl text-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative min-h-[220px] sm:min-h-[180px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, x: 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -48 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="text-white"
          >
            <p className="font-display text-xl leading-relaxed sm:text-2xl">&ldquo;{current.quote}&rdquo;</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-sm font-bold">
                {current.name.charAt(0)}
              </span>
              <p className="text-xs font-bold uppercase tracking-widest text-white/90">{current.name}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex justify-center gap-2">
        {testimonials.map((t, i) => (
          <button
            key={t.name}
            onClick={() => setIndex(i)}
            aria-label={`Show testimonial from ${t.name}`}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === index ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div>
      <Helmet>
        <title>About Us — Mum's Love Laundry</title>
        <meta
          name="description"
          content="Learn about Mum's Love Laundry — trusted laundry, ironing, and dry cleaning serving Akuapem-Akropong and the Eastern Region of Ghana."
        />
      </Helmet>
      <section className="mx-auto max-w-7xl px-6 pb-24 pt-14">
        <ScrollReveal>
          <SectionHeading title="About Mum's Love Laundry" eyebrow="Our Story" />
        </ScrollReveal>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-10 md:grid-cols-2">
          <ScrollReveal>
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft">
              <img src={foldingClothes} alt="Freshly washed clothes being folded by hand" className="h-48 w-full object-cover" />
              <div className="p-8">
                <h3 className="font-display text-xl text-ink-900">Our Mission</h3>
                <div className="mt-3 h-px w-10 bg-brand-300" />
                <p className="mt-4 text-sm leading-relaxed text-slate-500">
                  Dependable, affordable laundry care for every household and business in the Eastern
                  Region. We believe clean clothes shouldn't be a chore — bring your laundry in and our
                  team handles the washing, ironing, and finishing with care.
                </p>
              </div>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft">
              <img src={laundryRoom} alt="A bright, well-organized laundry space" className="h-48 w-full object-cover" />
              <div className="p-8">
                <h3 className="font-display text-xl text-ink-900">Our Vision</h3>
                <div className="mt-3 h-px w-10 bg-brand-300" />
                <p className="mt-4 text-sm leading-relaxed text-slate-500">
                  To become the most trusted laundry brand across Ghana, one region at a time —
                  starting in the Eastern Region, we're building a service so reliable that our name
                  becomes synonymous with care, just like Mum's.
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Because we care banner */}
      <section className="relative overflow-hidden">
        <img src={heroLaundryWoman} alt="A smiling attendant holding a stack of freshly folded laundry" className="h-80 w-full object-cover sm:h-96" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-900/80 via-ink-900/40 to-transparent" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-7xl px-6">
            <h3 className="max-w-md font-display text-3xl font-semibold text-white sm:text-4xl">
              Because We Are Laundry That Cares
            </h3>
            <div className="mt-5 h-px w-24 bg-white/40" />
            <p className="mt-5 text-xs font-bold uppercase tracking-widest text-white/80">
              Walk-In Drop-Off, Always Welcome
            </p>
            <Link
              to="/book"
              className="mt-7 inline-block rounded-full border-2 border-white px-7 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white hover:text-ink-900"
            >
              More Details
            </Link>
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="relative overflow-hidden py-20">
        <img src={laundromatMachines} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-ink-900/80" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-10 px-6 text-center text-white md:grid-cols-4">
          {STATS.map((stat, i) => (
            <AnimatedStat key={stat.label} {...stat} delay={i * 0.08} />
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-brand-500 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <ScrollReveal>
            <SectionHeading title="Loved Across the Eastern Region" eyebrow="Testimonials" light />
          </ScrollReveal>
          <TestimonialCarousel testimonials={TESTIMONIALS} />
        </div>
      </section>
    </div>
  );
}
