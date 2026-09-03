import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Calendar, Clock, Heart, MapPin } from 'lucide-react';
import SectionHeading from '../components/SectionHeading.jsx';
import ScrollReveal from '../components/ScrollReveal.jsx';
import { SHOP_ADDRESS, SHOP_HOURS } from '../lib/shopInfo.js';

const MotionLink = motion(Link);
import heroImage from '../assets/hero-laundry-woman.jpg';
import heroBackground from '../assets/clean-clothes.jpg';
import washingMachinesCloseup from '../assets/washing-machines-closeup.jpg';
import foldedKnits from '../assets/folded-knits.jpg';
import laundryBasket from '../assets/laundry-basket.jpg';

const REASONS = [
  {
    image: washingMachinesCloseup,
    title: 'Professional Care',
    desc: 'Simply bring your laundry to our shop — no appointment needed. Our team takes it from there with careful, professional handling.',
  },
  {
    image: heroImage,
    title: 'Fast Turnaround',
    desc: 'Same-day and next-day service. Your clean clothes will be ready to collect within 24–48 hours of drop-off, every time.',
  },
  {
    image: foldedKnits,
    title: 'Excellent Results',
    desc: 'We provide high quality washing, ironing, and dry cleaning from trusted facilities, and take custom orders so your clothes look and feel their best.',
  },
];

export default function LandingPage() {
  return (
    <div>
      <Helmet>
        <title>Mum's Love Laundry — Walk-In Laundry & Dry Cleaning in Akuapem-Akropong</title>
        <meta
          name="description"
          content="Professional laundry, ironing, and dry cleaning in Akuapem-Akropong, Eastern Region, Ghana. Drop off your laundry and collect it fresh within 24–48 hours."
        />
      </Helmet>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <img
          src={heroBackground}
          alt="Attendant pulling freshly washed clothes from a washing machine"
          className="absolute inset-0 h-full w-full object-cover object-[50%_15%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/70" />

        <div className="relative mx-auto max-w-7xl px-6 py-24 md:py-32">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-200 backdrop-blur">
              <Heart size={14} fill="currentColor" /> Serving the Eastern Region, Ghana
            </span>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Fresh, Clean Laundry — Just Drop It Off
            </h1>
            <div className="mt-5 h-px w-24 bg-white/30" />
            <p className="mt-5 text-sm font-semibold uppercase tracking-widest text-white/80">
              Bring it in, we'll handle the rest — ready for you to collect
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <MotionLink
                to="/book"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                className="rounded-full bg-brand-500 px-8 py-3.5 text-xs font-bold uppercase tracking-widest text-white shadow-soft transition-colors hover:bg-brand-600"
              >
                Order Now
              </MotionLink>
              <Link
                to="/services"
                className="rounded-full border border-white/30 px-8 py-3.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white/10"
              >
                View Services
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Reasons to choose us */}
      <section className="mx-auto max-w-7xl px-6 py-24 text-center">
        <ScrollReveal>
          <SectionHeading title="Clean Clothes and Total Peace of Mind" eyebrow="Reasons to Choose Us" />
        </ScrollReveal>

        <div className="mt-12 grid grid-cols-1 gap-12 sm:grid-cols-3">
          {REASONS.map((r, i) => (
            <ScrollReveal key={r.title} delay={i * 0.1}>
              <motion.div whileHover={{ y: -8 }} transition={{ duration: 0.3, ease: 'easeOut' }} className="group flex flex-col items-center">
                <div className="relative h-44 w-44 overflow-hidden rounded-full shadow-soft ring-4 ring-brand-50 transition-all duration-300 group-hover:shadow-xl group-hover:ring-brand-300 dark:ring-brand-900/30 dark:group-hover:ring-brand-700">
                  <img
                    src={r.image}
                    alt={r.title}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                  />
                  <div className="absolute inset-0 rounded-full bg-brand-500/0 transition-colors duration-300 group-hover:bg-brand-500/10" />
                </div>
                <h3 className="mt-6 font-display text-xl text-ink-900 dark:text-white">{r.title}</h3>
                <div className="mt-3 h-px w-10 bg-brand-300 transition-all duration-300 group-hover:w-16 group-hover:bg-brand-500" />
                <p className="mt-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{r.desc}</p>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>

        <Link
          to="/about"
          className="mt-14 inline-block rounded-full bg-brand-500 px-8 py-3.5 text-xs font-bold uppercase tracking-widest text-white shadow-soft transition hover:bg-brand-600"
        >
          More About Us
        </Link>
      </section>

      {/* Visit us */}
      <section className="relative overflow-hidden py-24">
        <img src={laundryBasket} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-slate-50/90 dark:bg-slate-800/70" />
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-600/25" />
        <div className="relative mx-auto max-w-3xl px-6">
          <ScrollReveal>
            <div className="relative rounded-2xl border border-slate-100 bg-white p-8 pt-14 text-center shadow-xl dark:border-slate-700 dark:bg-slate-800 sm:p-10 sm:pt-14">
              <div className="absolute -top-8 left-1/2 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full bg-brand-500 text-white shadow-soft">
                <MapPin size={28} />
              </div>
              <h3 className="font-display text-2xl text-ink-900 dark:text-white">Visit Our Shop</h3>
              <div className="mx-auto mt-3 h-px w-10 bg-brand-300" />
              <p className="mx-auto mt-4 max-w-md text-sm text-slate-500 dark:text-slate-400">
                We're a walk-in laundry — no need to schedule a pickup, just bring your items by.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3.5 text-left dark:bg-slate-900/50">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/30">
                    <MapPin size={18} />
                  </span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">{SHOP_ADDRESS}</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3.5 text-left dark:bg-slate-900/50">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/30">
                    <Clock size={18} />
                  </span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">{SHOP_HOURS}</span>
                </div>
              </div>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SHOP_ADDRESS)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-500 px-7 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-soft transition hover:bg-brand-600"
              >
                <MapPin size={15} /> Get Directions
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-500">
        <ScrollReveal className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-14 text-center md:flex-row md:text-left">
          <div>
            <h2 className="font-display text-2xl font-semibold text-white">Ready for fresh, folded laundry?</h2>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-brand-50 md:justify-start">
              <Calendar size={15} /> Book your first drop-off today — it only takes a minute.
            </p>
          </div>
          <Link
            to="/book"
            className="whitespace-nowrap rounded-full bg-white px-8 py-3.5 text-xs font-bold uppercase tracking-widest text-brand-600 shadow-soft transition hover:bg-brand-50"
          >
            Book a Drop-off
          </Link>
        </ScrollReveal>
      </section>
    </div>
  );
}
