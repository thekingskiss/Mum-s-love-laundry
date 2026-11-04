import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Calendar, Clock, Heart, MapPin } from 'lucide-react';

import SectionHeading from '../components/SectionHeading.jsx';
import ScrollReveal from '../components/ScrollReveal.jsx';
import { SHOP_ADDRESS, SHOP_HOURS } from '../lib/shopInfo.js';

import heroImage from '../assets/hero-laundry-woman.jpg';
import heroBackground from '../assets/clean-clothes.jpg';
import washingMachinesCloseup from '../assets/washing-machines-closeup.jpg';
import foldedKnits from '../assets/folded-knits.jpg';
import laundryBasket from '../assets/laundry-basket.jpg';

const MotionLink = motion(Link);

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
      <section className="relative isolate overflow-hidden bg-ink-900">
        <img
          src={heroBackground}
          alt="Freshly cleaned and folded laundry"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        {/* Dark overlays for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

        <div className="relative mx-auto flex min-h-[620px] max-w-7xl items-center px-6 py-20 lg:min-h-[680px] lg:px-8">
          <div className="grid w-full items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">

            {/* Main hero content */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="max-w-2xl"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-md">
                <Heart
                  size={14}
                  fill="currentColor"
                  className="text-brand-300"
                />
                Serving Akuapem-Akropong
              </span>

              <h1 className="mt-7 font-display text-5xl font-semibold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
                Fresh clothes.
                <span className="block text-brand-300">
                  More time for you.
                </span>
              </h1>

              <div className="mt-6 h-1 w-16 rounded-full bg-brand-500" />

              <p className="mt-6 max-w-xl text-base leading-7 text-white/80 sm:text-lg">
                Professional washing, ironing and dry-cleaning services.
                Drop off your laundry and let Mum's Love take care of the rest.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <MotionLink
                  to="/book"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center justify-center rounded-full bg-brand-500 px-8 py-4 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-xl transition-colors hover:bg-brand-600"
                >
                  Book a Drop-off
                </MotionLink>

                <Link
                  to="/services"
                  className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/5 px-8 py-4 text-xs font-bold uppercase tracking-[0.16em] text-white backdrop-blur-sm transition hover:bg-white/15"
                >
                  Explore Services
                </Link>
              </div>
            </motion.div>

            {/* Desktop information card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.15,
                ease: 'easeOut',
              }}
              className="hidden justify-end lg:flex"
            >
              <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-white/10 p-6 text-white shadow-2xl backdrop-blur-xl">

                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-200">
                  Why choose Mum's Love?
                </p>

                <div className="mt-6 space-y-5">

                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                      <Clock size={20} className="text-brand-200" />
                    </div>

                    <div>
                      <h3 className="font-semibold">
                        24–48 hour turnaround
                      </h3>

                      <p className="mt-1 text-sm leading-5 text-white/60">
                        Get your freshly cleaned clothes back quickly.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                      <MapPin size={20} className="text-brand-200" />
                    </div>

                    <div>
                      <h3 className="font-semibold">
                        Convenient walk-in service
                      </h3>

                      <p className="mt-1 text-sm leading-5 text-white/60">
                        Simply bring your laundry to our shop.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                      <Heart size={20} className="text-brand-200" />
                    </div>

                    <div>
                      <h3 className="font-semibold">
                        Care in every order
                      </h3>

                      <p className="mt-1 text-sm leading-5 text-white/60">
                        Your clothes are handled with attention and care.
                      </p>
                    </div>
                  </div>

                </div>

                <div className="mt-7 border-t border-white/10 pt-5">
                  <p className="text-xs leading-5 text-white/50">
                    Serving customers in Akuapem-Akropong and the Eastern Region.
                  </p>
                </div>

              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Reasons to choose us */}
<section className="bg-slate-50 py-24 dark:bg-slate-900/60">
  <div className="mx-auto max-w-7xl px-6 lg:px-8">

    <ScrollReveal>
      <SectionHeading
        title="Laundry Care You Can Trust"
        eyebrow="Why Mum's Love"
      />

      <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-7 text-slate-500 dark:text-slate-400 sm:text-base">
        From washing and ironing to careful finishing, we make laundry
        simple while giving your clothes the attention they deserve.
      </p>
    </ScrollReveal>

    <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
      {REASONS.map((r, i) => (
        <ScrollReveal key={r.title} delay={i * 0.1}>
          <motion.article
            whileHover={{ y: -8 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="group h-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-xl dark:border-slate-700 dark:bg-slate-800"
          >
            {/* Image */}
            <div className="relative h-56 overflow-hidden">
              <img
                src={r.image}
                alt={r.title}
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

              <div className="absolute bottom-4 left-5">
                <span className="rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-600 backdrop-blur-sm">
                  0{i + 1}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-7">
              <div className="mb-4 h-1 w-10 rounded-full bg-brand-500 transition-all duration-300 group-hover:w-16" />

              <h3 className="font-display text-2xl text-ink-900 dark:text-white">
                {r.title}
              </h3>

              <p className="mt-4 text-sm leading-7 text-slate-500 dark:text-slate-400">
                {r.desc}
              </p>

              <Link
                to="/services"
                className="mt-6 inline-flex items-center text-xs font-bold uppercase tracking-widest text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400"
              >
                Explore our services
                <span className="ml-2 transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          </motion.article>
        </ScrollReveal>
      ))}
    </div>

    <ScrollReveal delay={0.2}>
      <div className="mt-12 text-center">
        <Link
          to="/about"
          className="inline-flex items-center rounded-full border border-slate-300 bg-white px-7 py-3.5 text-xs font-bold uppercase tracking-widest text-ink-900 shadow-sm transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:border-brand-500 dark:hover:text-brand-400"
        >
          More About Us
          <span className="ml-2">→</span>
        </Link>
      </div>
    </ScrollReveal>

  </div>
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
