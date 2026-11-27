// The shop's chat assistant. It understands a customer's question with plain
// keyword rules (no outside AI service, so it costs nothing, never goes down
// with a vendor, and can never promise something the shop doesn't) and answers
// from the same live data the rest of the app uses: the price list, promos,
// branches and, for a signed-in customer, their own orders.
//
// Everything here is pure except the `data` loaders passed to `answer`, so it
// can be tested without a database.
const { SHOP_NAME, SHOP_ADDRESS, SHOP_PHONE, SHOP_EMAIL, SHOP_HOURS } = require('../config/shopInfo');
const { STATUS_LABELS } = require('../config/orderLifecycle');
const { FREE_PICKUP_DAYS, LATE_FEE_PER_DAY, calculateLateFee } = require('../utils/lateFee');
const { isPromoActive, getUnitPrice } = require('../utils/pricing');

const MAX_MESSAGE_LENGTH = 500;
const MAX_ITEMS_SHOWN = 6;
const MAX_ORDERS_SHOWN = 3;

const BOT_NAME = 'Mum’s Helper';
const GREETING =
  `Hi, I'm ${BOT_NAME}! 👋 I can help with prices, opening hours, how drop-off works and tracking your orders. What would you like to know?`;
const DEFAULT_SUGGESTIONS = ['Prices', 'Opening hours', 'How do I book?', 'Track my order'];

// ---------------------------------------------------------------------------
// Understanding the question
// ---------------------------------------------------------------------------

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9#'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Rules are tried in order and the first match wins, so the more specific
// questions ("late fee", "how much do I owe") sit above the general ones
// ("how much"). `short: true` means the rule only counts for a brief message,
// so "hi" is a greeting but "hi, how much is a duvet?" is a price question.
const RULES = [
  {
    intent: 'human',
    pattern: /\b(human|real person|agent|representative|speak (to|with)|talk (to|with)|customer (care|service|support)|complaint|complain|manager|call me|someone)\b/,
  },
  { intent: 'greeting', short: 5, pattern: /^(hi|hello|hey|hiya|howdy|yo|hola|akwaaba|good (morning|afternoon|evening)|greetings|sup)\b/ },
  { intent: 'thanks', short: 6, pattern: /\b(thanks|thank you|thank u|thx|cheers|appreciate|medaase)\b/ },
  { intent: 'bye', short: 5, pattern: /^(bye|goodbye|see you|see ya|later|good night|cya)\b/ },
  { intent: 'cancel', pattern: /\bcancel/ },
  {
    intent: 'late_fee',
    pattern: /\b(late (pick ?up )?(fees?|charges?)|storage fees?|overdue|uncollected|not collected|never collected|forgot to (collect|pick)|keep (my|the|our) (laundry|clothes|order)|how long (will|do|can) (you|it) (keep|hold|store)|abandon\w*)\b/,
  },
  {
    intent: 'delivery',
    pattern: /\b(deliver\w*|home service|pick ?up (service|from (my|our))|come (to|and) (get|collect|pick)|do you (pick|collect) (up|from)|collect from (my|our))\b/,
  },
  {
    intent: 'balance',
    pattern: /\b(owe|balance|outstanding|unpaid|amount due|what do i pay|how much (do|must|should) i pay)\b/,
  },
  {
    intent: 'order_status',
    pattern: /\b(track\w*|status|where('s| is| are) (my|it|they|the order)|my (order|orders|laundry|clothes|stuff|things)|is (it|my \w+) ready|ready yet|order #?\d+|check (on )?(my|the) order|progress|update on)\b|(^|\s)#\d+/,
  },
  {
    intent: 'payment',
    pattern: /\b(pay|paying|payment|payments|momo|mobile money|mtn|vodafone|telecel|airteltigo|card|visa|mastercard|cash|bank transfer|paystack|invoice|receipt|refund|deposit|installment)\b/,
  },
  { intent: 'turnaround', pattern: /\b(how long|turnaround|turn around|how soon|how fast|ready (in|by|when)|same day|next day|express|urgent|rush|quick\w*|days? to)\b/ },
  // Ahead of promos so "what services do you offer?" isn't mistaken for "any offers?".
  { intent: 'services', pattern: /\bservices?\b|\bwhat do you (do|offer)\b/ },
  { intent: 'promo', pattern: /\b(birthday|discount\w*|promo\w*|offers?|deals?|coupon|voucher|sale|special|cheaper|loyalty)\b/ },
  { intent: 'pricing', pattern: /\b(price\w*|cost\w*|how much|rates?|charges?|charging|tariff|per kg|per kilo|kilo|cheap\w*|expensive|ghs|cedis?)\b/ },
  { intent: 'hours', pattern: /\b(open\w*|clos(e|es|ed|ing)|hours?|what time|working time|business hours|sundays?|saturdays?|weekends?|holidays?|public holiday)\b/ },
  { intent: 'location', pattern: /\b(where (are|is)\s+(you|the shop|your|mum)|address|location|directions?|find you|located|map|branch(es)?|near (me|you)|how (do|can) i get (to|there))\b/ },
  { intent: 'contact', pattern: /\b(phone|call|number|e-?mail|whatsapp|contact|reach|get in touch|text you|sms)\b/ },
  { intent: 'services', pattern: /\b(services?|what do you (do|offer)|do you (wash|iron|offer|do|clean|have)|dry ?clean\w*|washing|ironing|wash and iron|wash & iron|offer)\b/ },
  {
    intent: 'booking',
    pattern: /\b(book\w*|drop ?-?\s?off|place (an|a|my) order|new order|make (an|a) order|order (online|now)|how (do|can|to) (i )?(order|start|use|begin)|schedule|appointment|reserve|sign me up)\b/,
  },
  { intent: 'account', pattern: /\b(password|forgot|reset|log ?in|log ?out|sign ?(up|in)|register\w*|account|username|profile|verify)\b/ },
  { intent: 'care', pattern: /\b(stain\w*|shrunk|shrink\w*|damag\w*|lost|missing|ruin\w*|torn|tear|delicate|silk|wool|lace|bleach|fade\w*|colou?r run|wrong item)\b/ },
];

function detectIntent(message) {
  const text = normalize(message);
  if (!text) return 'empty';
  const wordCount = text.split(' ').length;
  for (const rule of RULES) {
    if (rule.short && wordCount > rule.short) continue;
    if (rule.pattern.test(text)) return rule.intent;
  }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Price list lookups
// ---------------------------------------------------------------------------

// Words that carry no information about *which* garment someone means.
const FILLER_WORDS = new Set([
  'the', 'and', 'for', 'you', 'your', 'how', 'much', 'does', 'what', 'whats', 'is', 'are', 'do', 'it', 'its',
  'cost', 'costs', 'price', 'prices', 'pricing', 'charge', 'charges', 'rate', 'rates', 'wash', 'washing', 'iron',
  'ironing', 'clean', 'cleaning', 'with', 'without', 'can', 'could', 'would', 'please', 'want', 'need', 'have',
  'has', 'per', 'any', 'one', 'some', 'ghs', 'cedis', 'cedi', 'about', 'tell', 'give', 'show', 'list', 'much',
  'many', 'item', 'items', 'garment', 'garments', 'cloth', 'clothes', 'my', 'our', 'a', 'an', 'to', 'of', 'in',
  'on', 'me', 'i', 'we', 'am', 'will', 'get', 'this', 'that', 'there', 'than', 'but', 'not', 'also', 'too',
]);

function singular(word) {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function tokens(text) {
  return normalize(text)
    .replace(/'/g, '')
    .split(' ')
    .filter(Boolean)
    .map(singular);
}

// Everything a customer might have typed to mean this word: the word itself,
// and (so "bed sheet" finds "Bedsheet") the neighbouring words glued together.
function withJoinedPairs(words) {
  const set = new Set(words);
  for (let i = 0; i < words.length - 1; i += 1) set.add(words[i] + words[i + 1]);
  return set;
}

function formatMoney(amount) {
  const n = Number(amount);
  return `GHS ${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

function itemPrice(item) {
  if (item.unit_price != null) return formatMoney(item.unit_price);
  return `${formatMoney(item.price_min)}–${formatMoney(item.price_max).replace('GHS ', '')}`;
}

// The catalogue items the customer named, best match first. Returns
// { items, category } — items when a garment was named, otherwise the whole
// category if a category was ("bedding" → every bedding item).
function findItems(message, catalogue) {
  const typed = withJoinedPairs(tokens(message).filter((w) => !FILLER_WORDS.has(w) && w.length > 1));
  if (typed.size === 0) return { items: [], category: null };

  const scored = catalogue
    .map((item) => {
      const itemWords = tokens(item.item_name).filter((w) => !FILLER_WORDS.has(w) && w.length > 1);
      const hits = itemWords.filter((w) => typed.has(w)).length + (typed.has(itemWords.join('')) ? itemWords.length : 0);
      // Prefer items whose every word was typed over ones only partly covered.
      const coverage = itemWords.length ? hits / itemWords.length : 0;
      return { item, hits, coverage };
    })
    .filter((entry) => entry.hits > 0);

  if (scored.length > 0) {
    const best = Math.max(...scored.map((e) => e.hits));
    const top = scored
      .filter((e) => e.hits === best)
      .sort((a, b) => b.coverage - a.coverage || a.item.item_name.localeCompare(b.item.item_name));
    return { items: top.map((e) => e.item), category: null };
  }

  const categoryWords = (name) => tokens(name).filter((w) => !FILLER_WORDS.has(w) && w.length > 2);
  const categories = [...new Set(catalogue.map((i) => i.category))];
  const category = categories.find((name) => categoryWords(name).some((w) => typed.has(w)));
  if (category) return { items: catalogue.filter((i) => i.category === category), category };
  return { items: [], category: null };
}

function describeItems(items, category) {
  const shown = items.slice(0, MAX_ITEMS_SHOWN);
  const lines = shown.map((item) => `• ${item.item_name}: ${itemPrice(item)}`);
  const more = items.length - shown.length;
  const heading = category ? `Here are our ${category} prices:` : 'Here’s what I found:';
  const tail = more > 0 ? `\n…and ${more} more. The Pricing page has the full list.` : '';
  const estimate = shown.some((i) => i.unit_price == null)
    ? '\nPrices shown as a range are estimates; staff confirm the final amount when you drop off.'
    : '';
  return `${heading}\n${lines.join('\n')}${tail}${estimate}`;
}

// ---------------------------------------------------------------------------
// Dates and orders
// ---------------------------------------------------------------------------

function formatDate(value) {
  if (!value) return null;
  let date;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    date = new Date(y, m - 1, d);
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_BLURBS = {
  order_received: 'We have your laundry and it’s waiting its turn.',
  in_washing: 'It’s in the wash right now.',
  ironing_process: 'It’s being ironed and folded.',
  quality_check: 'We’re giving it a final check.',
  ready_for_pickup: 'It’s ready, come and collect it!',
  completed: 'It’s been collected.',
  cancelled: 'This order was cancelled.',
};

function describeOrder(order) {
  const lines = [`Order #${order.id}: ${STATUS_LABELS[order.status] || order.status}`];
  if (STATUS_BLURBS[order.status]) lines.push(STATUS_BLURBS[order.status]);
  if (order.items_summary) lines.push(`Items: ${order.items_summary}`);

  const dropOff = formatDate(order.drop_off_date);
  if (dropOff) lines.push(`Dropped off: ${dropOff}`);

  const open = !['completed', 'cancelled'].includes(order.status);
  const pickup = formatDate(order.pickup_date);
  if (open && pickup) lines.push(`Expected ready: ${pickup}`);
  if (open && !pickup) lines.push('We’ll confirm the pick-up date once staff have checked your items in.');

  if (order.status === 'ready_for_pickup') {
    if (order.storage_location) lines.push(`Look for it at: ${order.storage_location}`);
    const { daysOverdue, fee } = calculateLateFee(order.ready_for_pickup_at);
    if (daysOverdue > 0) {
      lines.push(`It has been waiting past the ${FREE_PICKUP_DAYS} free days: late fee so far ${formatMoney(fee)}.`);
    }
  }

  const balance = Number(order.balance_due);
  if (order.status !== 'cancelled' && balance > 0) lines.push(`Balance to pay: ${formatMoney(balance)}`);
  return lines.join('\n');
}

// The order number a customer named ("order 42", "#42"), if any.
function mentionedOrderId(message) {
  const match = normalize(message).match(/(?:#|\border(?: number| no)?\s*)(\d{1,9})\b/);
  return match ? Number(match[1]) : null;
}

// ---------------------------------------------------------------------------
// Replies
// ---------------------------------------------------------------------------

const ACTIONS = {
  pricing: { label: 'See full pricing', to: '/pricing' },
  book: { label: 'Book a drop-off', to: '/book' },
  dashboard: { label: 'Open my dashboard', to: '/dashboard' },
  login: { label: 'Log in', to: '/login' },
  register: { label: 'Create account', to: '/register' },
  contact: { label: 'Contact page', to: '/contact' },
  services: { label: 'Our services', to: '/services' },
  forgot: { label: 'Reset password', to: '/forgot-password' },
};

function whatsappLink() {
  return `https://wa.me/${SHOP_PHONE.replace(/\D/g, '')}`;
}

const callAction = () => ({ label: `Call ${SHOP_PHONE}`, href: `tel:${SHOP_PHONE}` });
const whatsappAction = () => ({ label: 'WhatsApp us', href: whatsappLink() });
const emailAction = () => ({ label: 'Email us', href: `mailto:${SHOP_EMAIL}` });

function reply(text, suggestions = DEFAULT_SUGGESTIONS, actions = []) {
  return { reply: text, suggestions, actions };
}

const STATIC_REPLIES = {
  greeting: () => reply(GREETING),
  thanks: () => reply('You’re very welcome! 😊 Anything else I can help with?', ['Prices', 'Opening hours', 'Track my order']),
  bye: () => reply(`Bye for now! Thank you for choosing ${SHOP_NAME}. 🧺`, []),

  hours: () =>
    reply(`We’re ${SHOP_HOURS.charAt(0).toLowerCase()}${SHOP_HOURS.slice(1)}. Since we’re a walk-in shop, just bring your laundry in during those hours, no appointment needed.`,
      ['Where are you?', 'How long does it take?', 'Prices']),

  turnaround: () =>
    reply('When you drop your laundry off, staff check it in and give you a pick-up date, which is also shown on your order. You’ll get a notification as it moves through washing, ironing and quality check, and another when it’s ready to collect. If you need it by a certain day, tell the team at drop-off and they’ll let you know what’s possible.',
      ['Track my order', 'Late pick-up fees', 'Book a drop-off'], [ACTIONS.book]),

  delivery: () =>
    reply('We’re a walk-in shop, so there’s no pick-up or delivery service: you bring your laundry to us and collect it when it’s ready. You can book your drop-off online to save time at the counter.',
      ['Where are you?', 'Opening hours', 'How do I book?'], [ACTIONS.book]),

  late_fee: () =>
    reply(`Once your order is ready to collect, storage is free for ${FREE_PICKUP_DAYS} days. After that a late fee of ${formatMoney(LATE_FEE_PER_DAY)} applies for each extra day, so please collect it as soon as you can. We’ll send reminders while it’s waiting.`,
      ['Track my order', 'Opening hours', 'How do I pay?']),

  booking: () =>
    reply('Booking a drop-off takes a minute:\n1. Log in (or create a free account).\n2. Open “Book” and pick your items and how many of each.\n3. Choose your drop-off date and confirm.\n4. Bring your laundry to the shop on that day. Staff check it in and give you a pick-up date.\nYou can follow progress on your dashboard.',
      ['Prices', 'Opening hours', 'Where are you?'], [ACTIONS.book, ACTIONS.register]),

  cancel: () =>
    reply('You can cancel your own order yourself from your dashboard as long as we haven’t started processing it (while it’s still “Order Received”). After that, please contact the shop and the team will see what can be done.',
      ['Track my order', 'Talk to a person'], [ACTIONS.dashboard, callAction()]),

  payment: () =>
    reply('You can pay at the shop by cash, mobile money, card or bank transfer. If an invoice has been sent to you, you can also pay it online through the secure link in the invoice. Your receipt is available from your dashboard once an order is placed.',
      ['How much do I owe?', 'Track my order', 'Talk to a person'], [ACTIONS.dashboard]),

  account: () =>
    reply('Creating an account is free and lets you book drop-offs, track orders and see receipts. If you can’t get in, use “Reset password” and we’ll email you a link. Tell us your birthday when you sign up and you’ll get 5% off any order dropped off on the day. 🎂',
      ['How do I book?', 'Prices'], [ACTIONS.register, ACTIONS.login, ACTIONS.forgot]),

  care: () =>
    reply('Every item is checked and tagged when it’s dropped off, so please point out any stains, delicate fabrics or existing damage to the team at the counter. If something doesn’t look right after you collect it, contact us with your order number and the team will look into it with you.',
      ['Talk to a person', 'Opening hours'], [callAction(), whatsappAction()]),

  contact: () =>
    reply(`You can reach us on ${SHOP_PHONE} or ${SHOP_EMAIL}. WhatsApp works too. We’re ${SHOP_HOURS.charAt(0).toLowerCase()}${SHOP_HOURS.slice(1)}.`,
      ['Where are you?', 'Opening hours'], [callAction(), whatsappAction(), emailAction()]),

  human: () =>
    reply(`Of course. The team will be glad to help directly. Call or WhatsApp ${SHOP_PHONE}, email ${SHOP_EMAIL}, or drop us a note on the Contact page. We’re ${SHOP_HOURS.charAt(0).toLowerCase()}${SHOP_HOURS.slice(1)}.`,
      ['Opening hours', 'Where are you?'], [callAction(), whatsappAction(), ACTIONS.contact]),

  empty: () => reply('Type a question and I’ll do my best to help. For example, “How much is a duvet?”'),

  unknown: () =>
    reply('I’m not sure I understood that one. I can help with prices, opening hours, where to find us, how booking works, payments and tracking your order. For anything else, the team is happy to help directly.',
      ['Prices', 'Opening hours', 'Track my order', 'Talk to a person'], [callAction(), whatsappAction()]),
};

async function answerLocation(data) {
  const branches = await data.getBranches();
  const withAddress = branches.filter((b) => b.address);
  const lines = [`${SHOP_NAME} is at ${SHOP_ADDRESS}.`];
  if (withAddress.length > 1) {
    lines.length = 0;
    lines.push('We have more than one branch:');
    withAddress.forEach((b) => lines.push(`• ${b.name}: ${b.address}${b.phone ? ` (${b.phone})` : ''}`));
  }
  lines.push(`We’re ${SHOP_HOURS.charAt(0).toLowerCase()}${SHOP_HOURS.slice(1)}.`);
  const mapQuery = encodeURIComponent(`${SHOP_NAME} ${SHOP_ADDRESS}`);
  return reply(lines.join('\n'), ['Opening hours', 'How do I book?', 'Prices'], [
    { label: 'Open in Maps', href: `https://www.google.com/maps/search/?api=1&query=${mapQuery}` },
    callAction(),
  ]);
}

async function answerServices(data, message) {
  const [services, catalogue] = await Promise.all([data.getServices(), data.getItems()]);
  const named = findItems(message, catalogue);
  if (named.items.length > 0 && !/\bservices?\b/.test(normalize(message))) {
    return reply(describeItems(named.items, named.category), ['Prices', 'How do I book?'], [ACTIONS.pricing, ACTIONS.book]);
  }
  if (services.length === 0) return STATIC_REPLIES.unknown();
  const lines = services.map((s) => {
    const price = getUnitPrice(s);
    const unit = s.pricing_unit === 'per_kg' ? '/kg' : '';
    const promo = isPromoActive(s) ? ' (promo!)' : '';
    return `• ${s.service_name}: ${formatMoney(price)}${unit}${promo}${s.description ? `. ${s.description}` : ''}`;
  });
  return reply(`Here’s what we offer:\n${lines.join('\n')}`, ['Prices', 'How do I book?', 'Opening hours'], [ACTIONS.services, ACTIONS.book]);
}

async function answerPricing(data, message) {
  const catalogue = await data.getItems();
  const named = findItems(message, catalogue);
  if (named.items.length > 0) {
    return reply(describeItems(named.items, named.category), ['Prices', 'How do I book?', 'Opening hours'], [ACTIONS.pricing, ACTIONS.book]);
  }

  const services = await data.getServices();
  const lines = services.map((s) => {
    const unit = s.pricing_unit === 'per_kg' ? '/kg' : '';
    return `• ${s.service_name}: from ${formatMoney(getUnitPrice(s))}${unit}`;
  });
  const categories = [...new Set(catalogue.map((i) => i.category))];
  const intro = lines.length ? `Our services start from:\n${lines.join('\n')}\n\n` : '';
  const ask = categories.length
    ? `Tell me a garment, like “shirt” or “duvet”, and I’ll give you its price. We price by item in ${categories.join(', ')} and more.`
    : 'The Pricing page lists every item.';
  return reply(`${intro}${ask}`, ['Shirt', 'Duvet', 'Jeans', 'Any promos?'], [ACTIONS.pricing]);
}

async function answerPromo(data) {
  const services = await data.getServices();
  const live = services.filter((s) => isPromoActive(s));
  const lines = [];
  if (live.length > 0) {
    lines.push('Current promotions:');
    live.forEach((s) => {
      const unit = s.pricing_unit === 'per_kg' ? '/kg' : '';
      const ends = s.promo_ends_at ? ` until ${formatDate(s.promo_ends_at)}` : '';
      lines.push(`• ${s.service_name}: ${formatMoney(s.promo_price)}${unit}${ends}`);
    });
  } else {
    lines.push('There are no special promotions running right now, but check back soon.');
  }
  lines.push('\nAlso: add your birthday to your account and get 5% off any order you drop off on your birthday. 🎂');
  return reply(lines.join('\n'), ['Prices', 'How do I book?'], [ACTIONS.pricing, ACTIONS.register]);
}

function needLogin(what) {
  return reply(`Please log in so I can look up ${what}. I only ever show you your own orders.`, ['Prices', 'Opening hours', 'Talk to a person'], [ACTIONS.login, ACTIONS.register]);
}

async function answerOrders(data, user, message, intent) {
  if (!user) return needLogin(intent === 'balance' ? 'what you owe' : 'your orders');

  const orders = await data.getOrders(user.id);
  if (orders.length === 0) {
    return reply('You don’t have any orders with us yet. Ready when you are, booking takes a minute!', ['How do I book?', 'Prices'], [ACTIONS.book]);
  }

  if (intent === 'balance') {
    const owing = orders.filter((o) => o.status !== 'cancelled' && Number(o.balance_due) > 0);
    if (owing.length === 0) return reply('You’re all paid up. You have no outstanding balance. 🎉', ['Track my order', 'Prices']);
    const total = owing.reduce((sum, o) => sum + Number(o.balance_due), 0);
    const lines = owing.slice(0, MAX_ORDERS_SHOWN).map((o) => `• Order #${o.id}: ${formatMoney(o.balance_due)}`);
    return reply(`You currently owe ${formatMoney(total)} across ${owing.length} order${owing.length === 1 ? '' : 's'}:\n${lines.join('\n')}\nYou can settle it at the shop by cash, mobile money, card or bank transfer.`,
      ['How do I pay?', 'Track my order'], [ACTIONS.dashboard]);
  }

  const wanted = mentionedOrderId(message);
  if (wanted != null) {
    const order = orders.find((o) => o.id === wanted);
    if (!order) {
      return reply(`I couldn’t find an order #${wanted} on your account. Check the number on your receipt, or ask me about “my orders” to see yours.`, ['Track my order', 'Talk to a person'], [ACTIONS.dashboard]);
    }
    return reply(describeOrder(order), ['How do I pay?', 'Opening hours', 'Late pick-up fees'], [ACTIONS.dashboard]);
  }

  const active = orders.filter((o) => !['completed', 'cancelled'].includes(o.status));
  const shown = (active.length > 0 ? active : orders).slice(0, MAX_ORDERS_SHOWN);
  const heading = active.length > 0
    ? `You have ${active.length} order${active.length === 1 ? '' : 's'} in progress:`
    : 'You have no orders in progress. Here’s your latest:';
  const body = shown.map(describeOrder).join('\n\n');
  const extra = (active.length > 0 ? active.length : orders.length) > shown.length ? '\n\nOpen your dashboard to see them all.' : '';
  return reply(`${heading}\n\n${body}${extra}`, ['How do I pay?', 'Opening hours', 'Late pick-up fees'], [ACTIONS.dashboard]);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

// `data` supplies async getServices / getItems / getBranches / getOrders(userId);
// `user` is the signed-in account or null.
async function answer(message, { user = null, data } = {}) {
  const intent = detectIntent(message);

  switch (intent) {
    case 'order_status':
    case 'balance':
      return { intent, ...(await answerOrders(data, user, message, intent)) };
    case 'pricing':
      return { intent, ...(await answerPricing(data, message)) };
    case 'services':
      return { intent, ...(await answerServices(data, message)) };
    case 'promo':
      return { intent, ...(await answerPromo(data)) };
    case 'location':
      return { intent, ...(await answerLocation(data)) };
    case 'unknown': {
      // "duvet?" on its own is a perfectly good question, so a bare garment
      // name gets its price even though no rule matched.
      const named = findItems(message, await data.getItems());
      if (named.items.length > 0 && named.items.length <= MAX_ITEMS_SHOWN * 2) {
        return { intent: 'pricing', ...reply(describeItems(named.items, named.category), ['Prices', 'How do I book?'], [ACTIONS.pricing, ACTIONS.book]) };
      }
      return { intent, ...STATIC_REPLIES.unknown() };
    }
    default:
      return { intent, ...STATIC_REPLIES[intent]() };
  }
}

module.exports = {
  BOT_NAME,
  GREETING,
  DEFAULT_SUGGESTIONS,
  MAX_MESSAGE_LENGTH,
  detectIntent,
  findItems,
  answer,
};
