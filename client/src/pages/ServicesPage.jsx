import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { DoorOpen, Shirt, Smartphone, Sparkles, WashingMachine, Zap } from 'lucide-react';
import api from '../api/axios';
import SectionHeading from '../components/SectionHeading.jsx';
import ScrollReveal from '../components/ScrollReveal.jsx';
import foldingClothes from '../assets/folding-clothes.jpg';

const ICONS = {
  washer: WashingMachine,
  iron: Zap,
  shirt: Shirt,
  sparkles: Sparkles,
};

const STEPS = [
  { icon: Smartphone, title: 'Sign Up', desc: 'Create an account and pick your items in under a minute.' },
  { icon: DoorOpen, title: 'Drop Off', desc: 'Bring your laundry to our shop at your convenience during business hours.' },
  { icon: WashingMachine, title: 'Cleaning', desc: 'We use trusted facilities and treat every garment with care.' },
  { icon: Shirt, title: 'Pick Up', desc: 'Fresh, folded, and pressed clothes ready for you to collect.' },
];

export default function ServicesPage() {
  const [services, setServices] = useState([]);

  useEffect(() => {
    api
      .get('/services')
      .then(({ data }) => setServices(data.services))
      .catch(() => setServices([]));
  }, []);

  return (
    <div>
      <Helmet>
        <title>Our Services — Mum's Love Laundry</title>
        <meta
          name="description"
          content="Washing, ironing, wash & iron, and dry cleaning services from Mum's Love Laundry in Akuapem-Akropong, Ghana."
        />
      </Helmet>
      {/* How our service works */}
      <section className="pb-24 pt-14">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <ScrollReveal>
            <SectionHeading title="Clean Clothes Have Never Been This Easy" eyebrow="How Our Service Works" />
          </ScrollReveal>

          <div className="mt-14 flex flex-col items-start gap-10 sm:flex-row sm:items-start sm:justify-between">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <ScrollReveal key={title} delay={i * 0.1} className="flex flex-1 items-center gap-6 sm:flex-col sm:gap-0 sm:text-center">
                <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-white shadow-soft ring-4 ring-brand-50 dark:bg-slate-800 dark:ring-brand-900/30">
                  <Icon size={36} strokeWidth={1.5} className="text-brand-500" />
                  <span className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white shadow-soft">
                    {i + 1}
                  </span>
                </div>
                <div className="sm:mt-6">
                  <h3 className="font-display text-lg text-ink-900 dark:text-white">{title}</h3>
                  <p className="mt-2 max-w-[15rem] text-base text-slate-500 dark:text-slate-400 sm:mx-auto">{desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Service offerings */}
      <section className="bg-slate-50 py-24 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <ScrollReveal>
            <SectionHeading title="What We Offer" eyebrow="Our Services" />
          </ScrollReveal>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service, i) => {
              const Icon = ICONS[service.icon_name] || Shirt;
              return (
                <ScrollReveal key={service.id} delay={i * 0.06}>
                  <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-soft transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/30">
                      <Icon size={26} />
                    </span>
                    <h3 className="mt-5 font-display text-lg text-ink-900 dark:text-white">{service.service_name}</h3>
                    <p className="mt-2 text-base leading-relaxed text-slate-500 dark:text-slate-400">{service.description}</p>
                    <Link
                      to="/pricing"
                      className="mt-5 text-xs font-bold uppercase tracking-widest text-brand-600 hover:text-brand-700"
                    >
                      See Pricing →
                    </Link>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Promo split */}
      <section className="grid grid-cols-1 md:grid-cols-2">
        <div className="h-64 md:h-auto">
          <img src={foldingClothes} alt="Folding clean laundry" className="h-full w-full object-cover" />
        </div>
        <ScrollReveal className="flex flex-col items-start justify-center bg-brand-400 px-10 py-16 text-white">
          <h3 className="font-display text-2xl font-semibold sm:text-3xl">Simple, Per-Item Pricing</h3>
          <p className="mt-3 max-w-sm text-base text-white/85">
            No flat bundles or guesswork — see exactly what each garment or linen item costs before you book.
          </p>
          <Link
            to="/pricing"
            className="mt-6 rounded-full border-2 border-white px-7 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white hover:text-brand-600"
          >
            Full Price List
          </Link>
        </ScrollReveal>
      </section>
    </div>
  );
}
