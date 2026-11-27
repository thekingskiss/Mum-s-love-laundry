import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Footer from './Footer.jsx';
import { SHOP_ADDRESS, SHOP_EMAIL, SHOP_PHONE } from '../lib/shopInfo.js';

vi.mock('../context/LanguageContext.jsx', () => ({ useLanguage: () => ({ t: (key) => key }) }));

function renderFooter() {
  return render(
    <MemoryRouter>
      <p>somewhere else on the page</p>
      <Footer />
    </MemoryRouter>
  );
}

const showAddress = () => screen.getByRole('button', { name: 'Show our address' });
const showPhone = () => screen.getByRole('button', { name: 'Show our phone number' });
const showEmail = () => screen.getByRole('button', { name: 'Show our email' });

afterEach(cleanup);

describe('Footer contact details', () => {
  it('shows only the three icons until one is tapped', () => {
    renderFooter();
    expect(showAddress()).toBeInTheDocument();
    expect(showPhone()).toBeInTheDocument();
    expect(showEmail()).toBeInTheDocument();
    expect(screen.queryByText(SHOP_ADDRESS)).not.toBeInTheDocument();
    expect(screen.queryByText(SHOP_PHONE)).not.toBeInTheDocument();
    expect(screen.queryByText(SHOP_EMAIL)).not.toBeInTheDocument();
  });

  it('shows only the detail for the icon that was tapped, and switches when another is tapped', () => {
    renderFooter();
    fireEvent.click(showPhone());
    expect(screen.getByRole('link', { name: SHOP_PHONE })).toHaveAttribute('href', expect.stringMatching(/^tel:\+?\d+$/));
    expect(screen.queryByText(SHOP_EMAIL)).not.toBeInTheDocument();
    expect(screen.queryByText(SHOP_ADDRESS)).not.toBeInTheDocument();
    expect(showPhone()).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(showEmail());
    expect(screen.getByRole('link', { name: SHOP_EMAIL })).toHaveAttribute('href', `mailto:${SHOP_EMAIL}`);
    expect(screen.queryByText(SHOP_PHONE)).not.toBeInTheDocument();

    fireEvent.click(showAddress());
    expect(screen.getByText(SHOP_ADDRESS)).toBeInTheDocument();
    expect(screen.queryByText(SHOP_EMAIL)).not.toBeInTheDocument();
  });

  it('goes back to icons only when the same icon is tapped again', () => {
    renderFooter();
    fireEvent.click(showPhone());
    fireEvent.click(showPhone());
    expect(screen.queryByText(SHOP_PHONE)).not.toBeInTheDocument();
  });

  it('goes back to icons only when anywhere else on the page is clicked', async () => {
    renderFooter();
    fireEvent.click(showAddress());
    expect(screen.getByText(SHOP_ADDRESS)).toBeInTheDocument();

    fireEvent.click(screen.getByText('somewhere else on the page'));
    await waitFor(() => expect(screen.queryByText(SHOP_ADDRESS)).not.toBeInTheDocument());
    expect(showAddress()).toHaveAttribute('aria-expanded', 'false');
  });

  it('goes back to icons only when Escape is pressed', async () => {
    renderFooter();
    fireEvent.click(showEmail());
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText(SHOP_EMAIL)).not.toBeInTheDocument());
  });
});
