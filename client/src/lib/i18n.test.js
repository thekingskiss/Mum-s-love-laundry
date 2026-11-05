import { describe, it, expect } from 'vitest';
import { SUPPORTED_LANGUAGES, languageDirection, normalizeLanguage, translate } from './i18n.js';

describe('translate', () => {
  it('returns the language string when present', () => {
    expect(translate('fr', 'nav_home')).toBe('Accueil');
    expect(translate('ar', 'nav_home')).toBe('الرئيسية');
  });

  it('falls back to English for a key a partial language lacks', () => {
    expect(translate('ga', 'nav_login')).toBe('Log In');
    expect(translate('dag', 'nav_pricing')).toBe('Pricing');
  });

  it('falls back to English for an unknown language, and to the key for an unknown key', () => {
    expect(translate('xx', 'nav_home')).toBe('Home');
    expect(translate('en', 'no_such_key')).toBe('no_such_key');
  });

  it('translates every phrase in the fully translated languages', () => {
    for (const code of ['tw', 'ha', 'fr', 'zh', 'ar']) {
      for (const key of ['nav_login', 'footer_tagline', 'settings_title', 'settings_saved']) {
        expect(translate(code, key), `${code}.${key}`).not.toBe(translate('en', key));
      }
    }
  });
});

describe('languages', () => {
  it('lists each code once', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('normalizes unknown codes to English', () => {
    expect(normalizeLanguage('ar')).toBe('ar');
    expect(normalizeLanguage('sepia')).toBe('en');
    expect(normalizeLanguage(null)).toBe('en');
  });

  it('writes Arabic right-to-left and everything else left-to-right', () => {
    expect(languageDirection('ar')).toBe('rtl');
    expect(languageDirection('fr')).toBe('ltr');
    expect(languageDirection('unknown')).toBe('ltr');
  });
});
