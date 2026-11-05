import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage.jsx';

// Choosing a profile picture must open the crop dialog, and only a cropped
// picture is uploaded. (The dialog was once imported but never rendered, so
// picking a file silently did nothing.)
const uploadAvatar = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { zones: [] } })) },
}));
vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { id: 1, role: 'customer', full_name: 'Ama Serwaa', email: 'ama@example.com' },
    updateProfile: vi.fn(),
    uploadAvatar,
  }),
}));
vi.mock('../context/ThemeContext.jsx', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: vi.fn() }),
}));
vi.mock('../context/CurrencyContext.jsx', () => ({
  useCurrency: () => ({ currencies: [], code: 'GHS', setCode: vi.fn() }),
}));
vi.mock('../context/LanguageContext.jsx', () => ({
  useLanguage: () => ({ lang: 'en', setLang: vi.fn(), t: (key) => key }),
}));
vi.mock('../context/ToastContext.jsx', () => ({ useToast: () => toast }));
// The real dialog needs canvas and object URLs, which jsdom doesn't have.
vi.mock('../components/AvatarCropModal.jsx', () => ({
  default: ({ file, onCancel, onSave, saving }) => (
    <div role="dialog" aria-label="Crop picture">
      <span>{file.name}</span>
      <button onClick={() => onSave(new File(['cropped'], 'cropped.png', { type: 'image/png' }))} disabled={saving}>Use picture</button>
      <button onClick={onCancel}>Cancel crop</button>
    </div>
  ),
}));

function renderSettings() {
  return render(<MemoryRouter initialEntries={['/settings']}><SettingsPage /></MemoryRouter>);
}

function choosePicture(container, name = 'me.png') {
  const input = container.querySelector('input[type="file"]');
  const file = new File(['pixels'], name, { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => vi.clearAllMocks());

describe('profile picture', () => {
  it('opens the crop dialog when a picture is chosen, and uploads nothing yet', () => {
    const { container } = renderSettings();
    expect(screen.queryByRole('dialog', { name: 'Crop picture' })).not.toBeInTheDocument();

    choosePicture(container);

    expect(screen.getByRole('dialog', { name: 'Crop picture' })).toBeInTheDocument();
    expect(screen.getByText('me.png')).toBeInTheDocument();
    expect(uploadAvatar).not.toHaveBeenCalled();
  });

  it('uploads the cropped picture, closes the dialog and confirms', async () => {
    uploadAvatar.mockResolvedValue({});
    const { container } = renderSettings();
    choosePicture(container);

    fireEvent.click(screen.getByRole('button', { name: 'Use picture' }));

    await waitFor(() => expect(uploadAvatar).toHaveBeenCalledOnce());
    expect(uploadAvatar.mock.calls[0][0].name).toBe('cropped.png');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Crop picture' })).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith('Profile picture updated!');
  });

  it('keeps the dialog open and shows the server\'s reason if the upload fails', async () => {
    uploadAvatar.mockRejectedValue({ response: { data: { error: 'Image is too large.' } } });
    const { container } = renderSettings();
    choosePicture(container);

    fireEvent.click(screen.getByRole('button', { name: 'Use picture' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Image is too large.'));
    expect(screen.getByRole('dialog', { name: 'Crop picture' })).toBeInTheDocument();
  });

  it('uploads nothing when the crop is cancelled', () => {
    const { container } = renderSettings();
    choosePicture(container);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel crop' }));
    expect(screen.queryByRole('dialog', { name: 'Crop picture' })).not.toBeInTheDocument();
    expect(uploadAvatar).not.toHaveBeenCalled();
  });
});
