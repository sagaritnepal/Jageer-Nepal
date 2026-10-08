// lib/components/finance/DropdownMenu.tsx
//
// A menu that hangs from the button that opened it - the header's date filter and "New entry"
// both use it - instead of a popup in the middle of the screen. It is drawn in a transparent
// Modal, so the top bar and the page's scrolling can never cut it off, and tapping anywhere
// outside it closes it.
import { useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';

/** Where the menu sits and whether it is showing. Put `ref={dropdown.buttonRef}` on the button
 * and call `dropdown.show()` when it is pressed. */
export function useDropdown(width: number) {
  const { width: windowWidth } = useWindowDimensions();
  const buttonRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  // Where the button is on screen, so the menu can hang from it.
  const [anchor, setAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  function show() {
    if (!buttonRef.current) {
      setOpen(true);
      return;
    }
    buttonRef.current.measureInWindow((x, y, w, h) => {
      setAnchor({ x, y, w, h });
      setOpen(true);
    });
  }

  // Under the button, its right edge on the button's, and kept inside the window.
  const left = anchor
    ? Math.max(8, Math.min(anchor.x + anchor.w - width, windowWidth - width - 8))
    : Math.max(8, windowWidth - width - 8);
  const top = anchor ? anchor.y + anchor.h + 6 : 56;

  return { buttonRef, open, show, hide: () => setOpen(false), left, top, width };
}

/** The menu itself: a white card, whatever rows are put in it, under the button. */
export function DropdownPanel({ dropdown, children }: { dropdown: ReturnType<typeof useDropdown>; children: ReactNode }) {
  return (
    <Modal visible={dropdown.open} transparent animationType="none" onRequestClose={dropdown.hide}>
      <Pressable style={{ flex: 1 }} onPress={dropdown.hide} accessibilityLabel="Close menu">
        <Pressable
          onPress={() => {}}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white"
          style={{
            position: 'absolute',
            top: dropdown.top,
            left: dropdown.left,
            width: dropdown.width,
            boxShadow: '0 12px 32px rgba(16,24,40,0.22)',
          }}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
