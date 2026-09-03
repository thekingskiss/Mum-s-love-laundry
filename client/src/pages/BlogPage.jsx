import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import SectionHeading from '../components/SectionHeading.jsx';
import ScrollReveal from '../components/ScrollReveal.jsx';
import laundryBasket from '../assets/laundry-basket.jpg';
import foldingClothes from '../assets/folding-clothes.jpg';
import ironingBoard from '../assets/ironing-board.jpg';

const TIPS = [
  {
    image: laundryBasket,
    date: 'Laundry Tips',
    title: 'Sort Your Laundry Like a Pro',
    desc: 'A simple sorting system keeps colors bright and whites truly white — here is what we do before every wash.',
  },
  {
    image: foldingClothes,
    date: 'Laundry Tips',
    title: 'Fold Smarter, Save Closet Space',
    desc: 'Our folding technique keeps garments wrinkle-free and stacked neatly, so they stay fresh until you wear them.',
  },
  {
    image: ironingBoard,
    date: 'Laundry Tips',
    title: 'The Right Way to Iron a Dress Shirt',
    desc: 'Collar, cuffs, then body — a proper press makes all the difference for a sharp, professional look.',
  },
];

export default function BlogPage() {
  return (
    <section className="pb-24 pt-14">
      <Helmet>
        <title>Laundry Tips & Advice — Mum's Love Laundry</title>
        <meta
          name="description"
          content="Sorting, folding, and ironing tips from the team at Mum's Love Laundry, Akuapem-Akropong."
        />
      </Helmet>
      <div className="mx-auto max-w-7xl px-6 text-center">
        <ScrollReveal>
          <SectionHeading title="Laundry Tips & Advice" eyebrow="From Our Blog" />
        </ScrollReveal>

        <div className="mt-14 grid grid-cols-1 gap-8 text-left sm:grid-cols-3">
          {TIPS.map((tip, i) => (
            <ScrollReveal key={tip.title} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden rounded-2xl bg-white shadow-soft hover:shadow-lg"
              >
                <div className="relative h-48">
                  <img src={tip.image} alt={tip.title} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 via-transparent to-transparent" />
                  <span className="absolute bottom-4 left-4 text-xs font-bold uppercase tracking-widest text-brand-200">
                    {tip.date}
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="font-display text-lg text-ink-900">{tip.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-500">{tip.desc}</p>
                </div>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
