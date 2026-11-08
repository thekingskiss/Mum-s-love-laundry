import { useCallback, useEffect, useSyncExternalStore } from 'react';

// Everything about the app being an installed, offline-capable app: the service
// worker, the browser's install prompt, and connection state. It lives outside
// React (a tiny store) because `beforeinstallprompt` can fire before any
// component has mounted, and the event only fires once.

const DISMISS_KEY = 'mll_install_dismissed_at';
const DISMISS_DAYS = 14;
const UPDATE_CHECK_MS = 60 * 60 * 1000;

let state = {
  updateReady: false,
  installEvent: null,
  installed: false,
};
const listeners = new Set();
let waitingWorker = null;

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getState = () => state;

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.navigator.standalone === true
  );
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPadOS reports itself as a Mac, but only a Mac with a touch screen is an iPad.
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function readDismissedAt() {
  try {
    return Number(localStorage.getItem(DISMISS_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function wasInstallPromptDismissedRecently() {
  return Date.now() - readDismissedAt() < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function dismissInstallPrompt() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Without storage the prompt simply comes back next visit.
  }
  listeners.forEach((listener) => listener());
}

/** Capture the install prompt and the installed event. Safe to call more than once. */
let listening = false;
export function listenForInstall() {
  if (listening || typeof window === 'undefined') return;
  listening = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    // Hold the event so our own button can trigger the prompt later.
    event.preventDefault();
    setState({ installEvent: event });
  });

  window.addEventListener('appinstalled', () => {
    setState({ installEvent: null, installed: true });
  });
}

export async function promptInstall() {
  const event = state.installEvent;
  if (!event) return 'unavailable';
  event.prompt();
  const { outcome } = await event.userChoice;
  // The event can only be used once, whatever the answer was.
  setState({ installEvent: null });
  if (outcome === 'dismissed') dismissInstallPrompt();
  return outcome;
}

/** Tells the waiting worker to take over; the page reloads when it does. */
export function applyUpdate() {
  if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  else window.location.reload();
}

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  // The dev server rewrites modules constantly; a cache would only get in the way.
  if (!import.meta.env.PROD) return;

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    let registration;
    try {
      registration = await navigator.serviceWorker.register('/sw.js');
    } catch {
      return;
    }

    const flagIfWaiting = (worker) => {
      // No controller means this is the very first install, not an update.
      if (worker && navigator.serviceWorker.controller) {
        waitingWorker = worker;
        setState({ updateReady: true });
      }
    };

    flagIfWaiting(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const incoming = registration.installing;
      incoming?.addEventListener('statechange', () => {
        if (incoming.state === 'installed') flagIfWaiting(incoming);
      });
    });

    // Installed apps stay open for days; look for releases when they come back.
    const check = () => registration.update().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    setInterval(check, UPDATE_CHECK_MS);
  });
}

export function useInstall() {
  const snapshot = useSyncExternalStore(subscribe, getState, getState);
  // Re-read on every store change so dismissing hides the banner immediately.
  const dismissed = wasInstallPromptDismissedRecently();
  const standalone = isStandalone() || snapshot.installed;
  const ios = isIOS();

  useEffect(() => {
    listenForInstall();
  }, []);

  const install = useCallback(() => promptInstall(), []);

  return {
    standalone,
    ios,
    dismissed,
    // A real prompt exists (Chromium) or the person is on iOS, where installing is manual.
    canInstall: !standalone && (Boolean(snapshot.installEvent) || ios),
    hasNativePrompt: Boolean(snapshot.installEvent),
    install,
    dismiss: dismissInstallPrompt,
  };
}

export function useUpdateReady() {
  return useSyncExternalStore(subscribe, getState, getState).updateReady;
}

function subscribeOnline(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export function useOnlineStatus() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  );
}
