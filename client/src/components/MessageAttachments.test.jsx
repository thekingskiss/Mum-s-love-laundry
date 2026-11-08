import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MessageAttachments from './MessageAttachments.jsx';

const attachments = [
  { kind: 'image', name: 'before.png', mime: 'image/png', size: 2048, url: 'https://res.cloudinary.com/demo/image/upload/a.png' },
  { kind: 'audio', name: 'voice.webm', mime: 'audio/webm', size: 4096, url: '/uploads/messages/b.webm' },
  { kind: 'video', name: 'clip.mp4', mime: 'video/mp4', size: 8192, url: '/uploads/messages/c.mp4' },
  { kind: 'document', name: 'receipt.pdf', mime: 'application/pdf', size: 1024 * 200, url: '/uploads/messages/d.pdf' },
];

describe('MessageAttachments', () => {
  it('renders nothing when there are no attachments', () => {
    const { container } = render(<MessageAttachments attachments={[]} />);
    expect(container).toBeEmptyDOMElement();
    const { container: other } = render(<MessageAttachments attachments={undefined} />);
    expect(other).toBeEmptyDOMElement();
  });

  it('shows each kind the right way', () => {
    const { container } = render(<MessageAttachments attachments={attachments} />);
    expect(screen.getByAltText('before.png')).toHaveAttribute('src', 'https://res.cloudinary.com/demo/image/upload/a.png');
    // Local uploads are served by the API origin, not the client.
    expect(container.querySelector('audio')).toHaveAttribute('src', expect.stringMatching(/^https?:\/\/.+\/uploads\/messages\/b\.webm$/));
    expect(container.querySelector('video')).toHaveAttribute('src', expect.stringMatching(/\/uploads\/messages\/c\.mp4$/));
    const doc = screen.getByRole('link', { name: /receipt\.pdf/ });
    expect(doc).toHaveAttribute('href', expect.stringMatching(/\/uploads\/messages\/d\.pdf$/));
    expect(doc).toHaveAttribute('target', '_blank');
    expect(doc).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(doc).toHaveTextContent('200 KB');
  });

  it('reports when someone opens an attachment', () => {
    const onOpen = vi.fn();
    render(<MessageAttachments attachments={[attachments[3]]} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('link', { name: /receipt\.pdf/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
