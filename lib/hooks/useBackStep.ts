// lib/hooks/useBackStep.ts
import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

/** While `active`, the Back button (Android's, the browser's) undoes it - `onBack` closes the view - instead
 * of leaving the page.
 *
 * For a view that is only a setting inside a page: a pop-up, a full-screen mode, a "detailed" layout. Those
 * add nothing to the navigation history, so Back used to skip past them and out of the page. A view that is
 * a page of its own (requests/board) doesn't need this - Back already returns from it.
 *
 * Android: the hardware Back handler. Web: one entry in the browser's history, added when the view opens.
 * The router only reads `history.state.id`, so the entry copies the current state and the router takes it for
 * the page it sits on. See the notes on `onPopState` for the three ways such an entry can be left behind. */
export function useBackStep(active: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active || Platform.OS === 'web') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBackRef.current();
      return true;
    });
    return () => sub.remove();
  }, [active]);

  useEffect(() => {
    if (!active || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const url = window.location.href;
    const step: Step = { token: `step${++counter}`, key: null, url, closedByBack: false, onBack: () => onBackRef.current() };
    steps.push(step);
    window.history.pushState({ ...window.history.state, [STEP_KEY]: step.token }, '', url);
    step.key = entryKey();
    if (step.key) tokenOfEntry.set(step.key, { token: step.token, url });

    return () => {
      const at = steps.indexOf(step);
      if (at >= 0) steps.splice(at, 1);
      if (step.closedByBack) return;
      // Closed another way (its own button): take the entry back out, or the next Back would seem to do nothing.
      // A beat later, and only if still on it: a view that closes by opening another page has the router pushing -
      // or, between pages it already has in its history, REPLACING our entry with - that page right now, and popping
      // then would undo it. The entry's id survives a replace, so the address is checked too.
      setTimeout(() => {
        const onOurEntry = step.key ? entryKey() === step.key : window.history.state?.[STEP_KEY] === step.token;
        if (onOurEntry && window.location.href === step.url) window.history.back();
      }, 0);
    };
  }, [active]);
}

type Step = { token: string; key: string | null; url: string; closedByBack: boolean; onBack: () => void };

const STEP_KEY = '__backStep';
/** The views open right now, oldest first. Their entries sit in the history in the same order. */
const steps: Step[] = [];
/** The browser's own id for an entry (Chromium's Navigation API) -> the step that added it, and the address it
 * showed. The router rewrites an entry's state as it lands on it, which erases the token we put there; the id
 * survives that. It survives the router REPLACING the entry with another page too, so an id counts only while the
 * entry still shows the address it was given. */
const tokenOfEntry = new Map<string, { token: string; url: string }>();
let counter = 0;
let direction: 'back' | 'forward' = 'back';

function entryKey(): string | null {
  return (window as any).navigation?.currentEntry?.key ?? null;
}

/** One listener for every step, added when this module loads - before the router adds its own - so it sees the
 * entry as it was, before the router rewrites its state.
 *
 * - Landing on an entry below a step's own: that step's entry was popped, so close it (Back from an open view).
 * - Landing on a step's entry that no view owns any more: the page was left while the view was open, and the entry
 *   stayed behind as a copy of the page it sat on. Landing on it would seem to do nothing, so keep going. */
function onPopState() {
  const key = entryKey();
  const known = key ? tokenOfEntry.get(key) : undefined;
  const landed: string | undefined =
    window.history.state?.[STEP_KEY] ?? (known && known.url === window.location.href ? known.token : undefined);
  if (landed && !steps.some((s) => s.token === landed)) {
    window.history.go(direction === 'back' ? -1 : 1);
    return;
  }
  const landedAt = landed ? steps.findIndex((s) => s.token === landed) : -1;
  steps
    .slice(landedAt + 1)
    .reverse()
    .forEach((s) => {
      s.closedByBack = true;
      s.onBack();
    });
}

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  // Where the browser can say which way it just went (Chromium), skip stranded entries in that direction; else Back.
  const nav = (window as any).navigation;
  nav?.addEventListener?.('currententrychange', (e: any) => {
    if (e.navigationType === 'traverse') direction = nav.currentEntry.index < e.from.index ? 'back' : 'forward';
  });
  window.addEventListener('popstate', onPopState, true);
}
