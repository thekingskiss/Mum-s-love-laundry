import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MessagesTab } from './MessagesTab.jsx';
import api from '../../api/axios';

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation((url) =>
    url === '/contact'
      ? Promise.resolve({ data: { messages: [] } })
      : Promise.resolve({
          data: { customers: [{ id: 7, full_name: 'Ama Boateng', phone_number: '0240000000', email: 'ama@example.com' }] },
        })
  );
  api.post.mockResolvedValue({ data: { recipient_count: 1, email_requested: false, email_sent_count: 0, attachment_count: 0 } });
});

const png = (name = 'before.png') => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], name, { type: 'image/png' });

async function chooseCustomer() {
  fireEvent.click(screen.getByRole('button', { name: 'Individual Customer' }));
  fireEvent.change(screen.getByPlaceholderText(/search by name/i), { target: { value: 'ama' } });
  fireEvent.click(await screen.findByText('Ama Boateng'));
}

function fillText(title = 'Hello', body = 'Your clothes are ready') {
  fireEvent.change(screen.getByPlaceholderText(/^(Title|Subject)$/), { target: { value: title } });
  if (body) fireEvent.change(screen.getByPlaceholderText(/^Message/), { target: { value: body } });
}

describe('send-a-message composer', () => {
  it('sends text and attachments as multipart form data', async () => {
    api.post.mockResolvedValue({ data: { recipient_count: 1, email_requested: false, email_sent_count: 0, attachment_count: 1 } });
    render(<MessagesTab isAdmin />);
    await chooseCustomer();
    fillText();
    fireEvent.change(screen.getByTestId('attachment-input'), { target: { files: [png()] } });
    expect(screen.getByText('before.png')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [url, form] = api.post.mock.calls[0];
    expect(url).toBe('/admin/messages');
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('title')).toBe('Hello');
    expect(form.get('body')).toBe('Your clothes are ready');
    expect(form.get('customer_id')).toBe('7');
    expect(form.get('delivery')).toBe('in_app_email');
    expect(form.getAll('attachments').map((f) => f.name)).toEqual(['before.png']);
    expect(await screen.findByText(/1 attachment included/)).toBeInTheDocument();
  });

  it('lets the message be a file on its own', async () => {
    render(<MessagesTab isAdmin />);
    await chooseCustomer();
    fillText('Receipt', '');
    fireEvent.change(screen.getByTestId('attachment-input'), { target: { files: [png('receipt.png')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
  });

  it('removes an attached file before sending', async () => {
    render(<MessagesTab isAdmin />);
    fireEvent.change(screen.getByTestId('attachment-input'), { target: { files: [png('a.png'), png('b.png')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove a.png' }));
    expect(screen.queryByText('a.png')).not.toBeInTheDocument();
    expect(screen.getByText('b.png')).toBeInTheDocument();
  });

  it('refuses an unsupported file and says why', () => {
    render(<MessagesTab isAdmin />);
    const html = new File(['<b>hi</b>'], 'page.html', { type: 'text/html' });
    fireEvent.change(screen.getByTestId('attachment-input'), { target: { files: [html] } });
    expect(screen.getByRole('alert')).toHaveTextContent(/page\.html.*not a supported file type/);
    expect(screen.queryByText('page.html', { selector: 'li *' })).not.toBeInTheDocument();
  });

  it('sends "email only" as a direct email', async () => {
    render(<MessagesTab isAdmin />);
    await chooseCustomer();
    fillText();
    fireEvent.click(screen.getByLabelText(/Email only/));
    fireEvent.click(screen.getByRole('button', { name: 'Send Email' }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0][1].get('delivery')).toBe('email');
    expect(api.post.mock.calls[0][1].get('send_sms')).toBeNull();
  });

  it('emails any typed address directly, with no delivery choice', async () => {
    render(<MessagesTab isAdmin />);
    fireEvent.click(screen.getByRole('button', { name: 'Any Email Address' }));
    expect(screen.queryByLabelText(/In-app message/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Recipient email address'), { target: { value: 'someone@example.com' } });
    fillText('Invoice', 'Attached');
    fireEvent.click(screen.getByRole('button', { name: 'Send Email' }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const form = api.post.mock.calls[0][1];
    expect(form.get('recipient_email')).toBe('someone@example.com');
    expect(form.get('delivery')).toBe('email');
    expect(form.get('customer_id')).toBeNull();
  });

  it('warns when fewer emails went out than were requested', async () => {
    api.post.mockResolvedValue({ data: { recipient_count: 1, email_requested: true, email_sent_count: 0, attachment_count: 0 } });
    render(<MessagesTab isAdmin />);
    await chooseCustomer();
    fillText();
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));
    expect(await screen.findByText(/Only 0 of 1 emails went out/)).toBeInTheDocument();
  });

  it('shows the server error when sending fails', async () => {
    api.post.mockRejectedValue({ response: { data: { error: 'Email is not set up on the server yet.' } } });
    render(<MessagesTab isAdmin />);
    await chooseCustomer();
    fillText();
    fireEvent.click(screen.getByLabelText(/Email only/));
    fireEvent.click(screen.getByRole('button', { name: 'Send Email' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email is not set up on the server yet.');
  });

  it('does not show the composer to non-admin staff', async () => {
    render(<MessagesTab isAdmin={false} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/contact'));
    expect(screen.queryByText('Send a Message')).not.toBeInTheDocument();
  });
});
