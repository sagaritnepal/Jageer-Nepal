// lib/hooks/pushTypes.ts

/** Where this device stands with push notifications:
 *  checking       still looking
 *  unsupported    this browser / build cannot receive them
 *  needs-install  an iPhone browser tab: the site has to be added to the Home Screen first
 *  blocked        the person said no (or turned it off in settings) - only they can undo that
 *  off            can be turned on
 *  on             this device is registered and will be sent pushes */
export type PushStatus = 'checking' | 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on';

export interface PushController {
  status: PushStatus;
  /** A turn on / turn off is in flight. */
  busy: boolean;
  /** Why the last attempt failed, in words a person can read. */
  error: string | null;
  /** Asks permission (must come from a tap) and registers this device. */
  enable: () => Promise<void>;
  /** Stops pushes to this device. */
  disable: () => Promise<void>;
}
