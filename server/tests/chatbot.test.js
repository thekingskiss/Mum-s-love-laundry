import { describe, it, expect, vi } from 'vitest';
import { answer, detectIntent, findItems } from '../services/chatbot';

const ITEMS = [
  { category: 'Everyday Wear', item_name: 'Shirt', unit_price: '10.00', price_min: null, price_max: null },
  { category: 'Everyday Wear', item_name: 'T-shirt', unit_price: '8.00', price_min: null, price_max: null },
  { category: 'Everyday Wear', item_name: 'Jeans', unit_price: '15.00', price_min: null, price_max: null },
  { category: 'Bedding & Linens', item_name: 'Duvet Cover (King)', unit_price: '80.00', price_min: null, price_max: null },
  { category: 'Bedding & Linens', item_name: 'Duvet Cover (Queen)', unit_price: '50.00', price_min: null, price_max: null },
  { category: 'Bedding & Linens', item_name: 'Bedsheet (King)', unit_price: '30.00', price_min: null, price_max: null },
  { category: 'Bedding & Linens', item_name: 'Pillow Case', unit_price: '5.00', price_min: null, price_max: null },
  { category: 'Special Care', item_name: 'Wedding Gown', unit_price: null, price_min: '60.00', price_max: '120.00' },
];

const SERVICES = [
  { service_name: 'Ironing Only', description: 'Sharp pressing.', base_price: '10.00', pricing_unit: 'flat', promo_price: null },
  {
    service_name: 'Wash & Iron', description: 'Wash, dry, iron, fold.', base_price: '22.00', pricing_unit: 'flat',
    promo_price: '18.00', promo_starts_at: null, promo_ends_at: null,
  },
];

function makeData(overrides = {}) {
  return {
    getItems: vi.fn(async () => ITEMS),
    getServices: vi.fn(async () => SERVICES),
    getBranches: vi.fn(async () => [{ name: 'Main Branch', address: null, phone: null }]),
    getOrders: vi.fn(async () => []),
    ...overrides,
  };
}

const ask = (message, { user = null, data = makeData() } = {}) => answer(message, { user, data });

describe('detectIntent', () => {
  it.each([
    ['hi', 'greeting'],
    ['Hello there!', 'greeting'],
    ['hi, how much is a duvet?', 'pricing'],
    ['thanks a lot', 'thanks'],
    ['What time do you open?', 'hours'],
    ['are you open on sundays', 'hours'],
    ['Where are you?', 'location'],
    ['where is the shop', 'location'],
    ['What is your address', 'location'],
    ['Track my order', 'order_status'],
    ['where is my order', 'order_status'],
    ['order #42', 'order_status'],
    ['#42', 'order_status'],
    ['is it ready yet?', 'order_status'],
    ['how much do I owe?', 'balance'],
    ['How much is a shirt?', 'pricing'],
    ['how do I pay', 'payment'],
    ['do you take mobile money', 'payment'],
    ['How do I book?', 'booking'],
    ['Book a drop-off', 'booking'],
    ['How long does it take?', 'turnaround'],
    ['Late fees', 'late_fee'],
    ['Late pick-up fees', 'late_fee'],
    ['do you deliver?', 'delivery'],
    ['can I cancel my order', 'cancel'],
    ['any promos?', 'promo'],
    ['it has a stain', 'care'],
    ['Talk to a person', 'human'],
    ['what is your phone number', 'contact'],
    ['I forgot my password', 'account'],
    ['what services do you offer', 'services'],
    ['', 'empty'],
    ['asdfghjkl', 'unknown'],
  ])('reads %j as %s', (message, intent) => {
    expect(detectIntent(message)).toBe(intent);
  });

  it('answers every suggestion chip it offers with the topic the chip names', () => {
    const chips = {
      Prices: 'pricing',
      'Opening hours': 'hours',
      'How do I book?': 'booking',
      'Track my order': 'order_status',
      'Where are you?': 'location',
      'How long does it take?': 'turnaround',
      'Late pick-up fees': 'late_fee',
      'How do I pay?': 'payment',
      'How much do I owe?': 'balance',
      'Talk to a person': 'human',
      'Any promos?': 'promo',
      'Book a drop-off': 'booking',
    };
    for (const [chip, intent] of Object.entries(chips)) expect(detectIntent(chip)).toBe(intent);
  });
});

describe('findItems', () => {
  it('finds a garment by name, ignoring filler and plurals', () => {
    expect(findItems('how much are jeans', ITEMS).items.map((i) => i.item_name)).toEqual(['Jeans']);
    expect(findItems('price of a duvet', ITEMS).items.map((i) => i.item_name)).toEqual(['Duvet Cover (King)', 'Duvet Cover (Queen)']);
  });

  it('matches a word typed as two ("bed sheet" for "Bedsheet")', () => {
    expect(findItems('bed sheet price', ITEMS).items.map((i) => i.item_name)).toEqual(['Bedsheet (King)']);
  });

  it('falls back to a whole category when only the category is named', () => {
    const found = findItems('bedding', ITEMS);
    expect(found.category).toBe('Bedding & Linens');
    expect(found.items).toHaveLength(4);
  });

  it('finds nothing for words that are not on the price list', () => {
    expect(findItems('spaceship', ITEMS).items).toEqual([]);
  });
});

describe('answering', () => {
  it('quotes the live price of a garment', async () => {
    const result = await ask('How much is a duvet?');
    expect(result.reply).toContain('Duvet Cover (King): GHS 80');
    expect(result.reply).toContain('Duvet Cover (Queen): GHS 50');
  });

  it('shows a price range as an estimate', async () => {
    const result = await ask('price of a wedding gown');
    expect(result.reply).toContain('GHS 60–120');
    expect(result.reply).toMatch(/estimates/);
  });

  it('answers a bare garment name with its price', async () => {
    const result = await ask('jeans');
    expect(result.reply).toContain('Jeans: GHS 15');
  });

  it('lists service starting prices when no garment is named, using the promo price', async () => {
    const result = await ask('what are your prices?');
    expect(result.reply).toContain('Ironing Only: from GHS 10');
    expect(result.reply).toContain('Wash & Iron: from GHS 18');
  });

  it('lists the live promotions', async () => {
    const result = await ask('any discounts?');
    expect(result.reply).toContain('Wash & Iron: GHS 18');
    expect(result.reply).toMatch(/birthday/i);
  });

  it('gives the opening hours and offers directions, never a delivery service', async () => {
    expect((await ask('opening hours')).reply).toMatch(/8am/);
    expect((await ask('do you deliver')).reply).toMatch(/no pick-up or delivery/);
  });

  it('gives the address with a maps link and a call button', async () => {
    const result = await ask('where are you located?');
    expect(result.reply).toContain('Akuapem-Akropong');
    expect(result.actions.some((a) => a.href?.startsWith('https://www.google.com/maps'))).toBe(true);
    expect(result.actions.some((a) => a.href?.startsWith('tel:'))).toBe(true);
  });

  it('states the real late-fee policy', async () => {
    const result = await ask('late fees');
    expect(result.reply).toContain('7 days');
    expect(result.reply).toContain('GHS 5');
  });

  it('always offers a way to reach a person', async () => {
    for (const message of ['talk to a person', 'asdfghjkl']) {
      const result = await ask(message);
      expect(result.actions.some((a) => a.href?.startsWith('tel:'))).toBe(true);
    }
  });

  it('never returns an empty reply', async () => {
    for (const message of ['', '   ', '???', '👍', 'x'.repeat(400)]) {
      const result = await ask(message);
      expect(result.reply.length).toBeGreaterThan(0);
    }
  });
});

describe('answering about orders', () => {
  const user = { id: 7 };
  const order = (over) => ({
    id: 12, status: 'in_washing', drop_off_date: '2026-03-02', pickup_date: '2026-03-05',
    storage_location: null, balance_due: '0', items_summary: 'Shirt x3', ready_for_pickup_at: null, ...over,
  });

  it('asks a visitor to log in and never touches orders', async () => {
    const data = makeData();
    const result = await ask('track my order', { data });
    expect(result.reply).toMatch(/log in/i);
    expect(result.actions[0].to).toBe('/login');
    expect(data.getOrders).not.toHaveBeenCalled();
  });

  it('shows a signed-in customer their orders in progress', async () => {
    const data = makeData({ getOrders: vi.fn(async () => [order(), order({ id: 9, status: 'completed' })]) });
    const result = await ask('where is my order', { user, data });
    expect(data.getOrders).toHaveBeenCalledWith(7);
    expect(result.reply).toContain('Order #12: Washing');
    expect(result.reply).toContain('Shirt x3');
    expect(result.reply).not.toContain('Order #9');
  });

  it('looks up one order by number, and says so when it is not theirs', async () => {
    const data = makeData({ getOrders: vi.fn(async () => [order(), order({ id: 9, status: 'completed' })]) });
    expect((await ask('status of order #9', { user, data })).reply).toContain('Order #9: Completed');
    expect((await ask('order #999', { user, data })).reply).toMatch(/couldn’t find an order #999/);
  });

  it('says where a ready order is and what is owed', async () => {
    const data = makeData({
      getOrders: vi.fn(async () => [order({ status: 'ready_for_pickup', storage_location: 'Shelf 1', balance_due: '25', ready_for_pickup_at: new Date() })]),
    });
    const result = await ask('is my laundry ready', { user, data });
    expect(result.reply).toContain('Look for it at: Shelf 1');
    expect(result.reply).toContain('Balance to pay: GHS 25');
  });

  it('warns about a late fee that has built up', async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const data = makeData({ getOrders: vi.fn(async () => [order({ status: 'ready_for_pickup', ready_for_pickup_at: tenDaysAgo })]) });
    expect((await ask('track my order', { user, data })).reply).toContain('late fee so far GHS 15');
  });

  it('totals what is owed, ignoring cancelled and paid orders', async () => {
    const data = makeData({
      getOrders: vi.fn(async () => [
        order({ id: 1, balance_due: '20' }),
        order({ id: 2, balance_due: '15.5' }),
        order({ id: 3, balance_due: '99', status: 'cancelled' }),
        order({ id: 4, balance_due: '0' }),
      ]),
    });
    const result = await ask('how much do I owe?', { user, data });
    expect(result.reply).toContain('GHS 35.50 across 2 orders');
  });

  it('tells a customer with no orders how to start', async () => {
    const result = await ask('track my order', { user, data: makeData() });
    expect(result.reply).toMatch(/don’t have any orders/);
  });
});
