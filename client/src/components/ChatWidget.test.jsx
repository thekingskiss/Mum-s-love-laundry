import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatWidget from './ChatWidget.jsx';
import api from '../api/axios';

const session = vi.hoisted(() => ({ user: null }));

vi.mock('../api/axios', () => ({ default: { post: vi.fn() } }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => session }));

function renderAt(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ChatWidget />
    </MemoryRouter>
  );
}

const openChat = () => fireEvent.click(screen.getByRole('button', { name: 'Chat with us' }));
const ask = (text) => {
  fireEvent.change(screen.getByLabelText('Type your question'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  session.user = null;
});

describe('ChatWidget', () => {
  it('starts as a button and opens a chat with a greeting and starter questions', () => {
    renderAt();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    openChat();
    expect(screen.getByRole('dialog', { name: /Mum’s Helper/ })).toBeInTheDocument();
    expect(screen.getByText(/What would you like to know/)).toBeInTheDocument();
    for (const chip of ['Prices', 'Opening hours', 'How do I book?', 'Track my order']) {
      expect(screen.getByRole('button', { name: chip })).toBeInTheDocument();
    }
  });

  it('sends a typed question and shows the answer with its links', async () => {
    api.post.mockResolvedValue({
      data: {
        reply: 'A shirt is GHS 10.',
        suggestions: ['Jeans'],
        actions: [{ label: 'See full pricing', to: '/pricing' }],
      },
    });
    renderAt();
    openChat();
    ask('  how much is a shirt  ');

    expect(await screen.findByText('A shirt is GHS 10.')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/chat', { message: 'how much is a shirt' });
    expect(screen.getByText('how much is a shirt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See full pricing' })).toHaveAttribute('href', '/pricing');
    expect(screen.getByRole('button', { name: 'Jeans' })).toBeInTheDocument();
    // The old starter chips give way to the new suggestions.
    expect(screen.queryByRole('button', { name: 'Prices' })).not.toBeInTheDocument();
  });

  it('sends a suggestion when it is tapped', async () => {
    api.post.mockResolvedValue({ data: { reply: 'We open 8am to 8pm.', suggestions: [], actions: [] } });
    renderAt();
    openChat();
    fireEvent.click(screen.getByRole('button', { name: 'Opening hours' }));
    expect(await screen.findByText('We open 8am to 8pm.')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/chat', { message: 'Opening hours' });
  });

  it('will not send an empty message, and disables sending while waiting', async () => {
    let finish;
    api.post.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderAt();
    openChat();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    ask('hello');
    expect(screen.getByRole('status', { name: /typing/ })).toBeInTheDocument();
    ask('second');
    expect(api.post).toHaveBeenCalledTimes(1);
    finish({ data: { reply: 'Hi!', suggestions: [], actions: [] } });
    expect(await screen.findByText('Hi!')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: /typing/ })).not.toBeInTheDocument();
  });

  it('only follows links of a kind it recognises', async () => {
    api.post.mockResolvedValue({
      data: {
        reply: 'Here you go.',
        suggestions: [],
        actions: [
          { label: 'Call', href: 'tel:+233244980843' },
          { label: 'Evil', href: 'javascript:alert(1)' },
          { label: 'Phish', href: 'https://example.com/login' },
          { label: 'Sneaky route', to: '//example.com' },
          { label: 'Maps', href: 'https://www.google.com/maps/search/?api=1&query=shop' },
        ],
      },
    });
    renderAt();
    openChat();
    ask('contact');
    await screen.findByText('Here you go.');
    expect(screen.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+233244980843');
    const maps = screen.getByRole('link', { name: /Maps/ });
    expect(maps).toHaveAttribute('target', '_blank');
    expect(maps).toHaveAttribute('rel', expect.stringContaining('noopener'));
    for (const label of ['Evil', 'Phish', 'Sneaky route']) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();
    }
  });

  it('shows a friendly message with a phone number when the server cannot be reached', async () => {
    api.post.mockRejectedValue({ response: { status: 500 } });
    renderAt();
    openChat();
    ask('hello');
    expect(await screen.findByText(/can’t answer right now/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Call \+233244980843/ })).toHaveAttribute('href', 'tel:+233244980843');
  });

  it('relays the server’s message when it is rate limiting', async () => {
    api.post.mockRejectedValue({ response: { status: 429, data: { error: 'Slow down a little.' } } });
    renderAt();
    openChat();
    ask('hello');
    expect(await screen.findByText('Slow down a little.')).toBeInTheDocument();
  });

  it('closes with the close button and with Escape, returning focus to the chat button', async () => {
    renderAt();
    openChat();
    fireEvent.click(screen.getByRole('button', { name: 'Close chat' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Chat with us' })).toHaveFocus());

    openChat();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('remembers the conversation for the browser tab, and can start over', async () => {
    api.post.mockResolvedValue({ data: { reply: 'Answer one.', suggestions: [], actions: [] } });
    const first = renderAt();
    openChat();
    ask('question one');
    await screen.findByText('Answer one.');
    first.unmount();
    cleanup();

    renderAt();
    openChat();
    expect(screen.getByText('Answer one.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start a new conversation' }));
    expect(screen.queryByText('Answer one.')).not.toBeInTheDocument();
    expect(screen.getByText(/What would you like to know/)).toBeInTheDocument();
  });

  it('does not show one account’s conversation to another', async () => {
    session.user = { id: 1 };
    api.post.mockResolvedValue({ data: { reply: 'Order #5 is washing.', suggestions: [], actions: [] } });
    const first = renderAt();
    openChat();
    ask('track my order');
    await screen.findByText('Order #5 is washing.');
    first.unmount();
    cleanup();

    session.user = null;
    renderAt();
    openChat();
    expect(screen.queryByText('Order #5 is washing.')).not.toBeInTheDocument();
  });

  it('clears the conversation when the person logs out while it is on screen', async () => {
    session.user = { id: 1 };
    api.post.mockResolvedValue({ data: { reply: 'Order #5 is washing.', suggestions: [], actions: [] } });
    const view = renderAt();
    openChat();
    ask('track my order');
    await screen.findByText('Order #5 is washing.');

    session.user = null;
    view.rerender(
      <MemoryRouter initialEntries={['/']}>
        <ChatWidget />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.queryByText('Order #5 is washing.')).not.toBeInTheDocument());
  });

  it.each(['/staff', '/admin', '/book', '/orders/4/receipt', '/pay/invoice/abc'])('stays out of the way on %s', (path) => {
    renderAt(path);
    expect(screen.queryByRole('button', { name: 'Chat with us' })).not.toBeInTheDocument();
  });

  it.each(['/', '/pricing', '/contact', '/dashboard', '/login'])('is available on %s', (path) => {
    renderAt(path);
    expect(screen.getByRole('button', { name: 'Chat with us' })).toBeInTheDocument();
  });
});
