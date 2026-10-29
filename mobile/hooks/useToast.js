import { useCallback, useRef, useState } from 'react';

/**
 * Local (not global-context) toast state — deliberately instantiated once
 * per screen/modal that needs it, not shared app-wide. A toast fired from
 * inside an already-open RN `<Modal>` (CreateGroupModal, GroupsManageModal,
 * etc.) has to render as part of THAT modal's own JSX to be visible at all:
 * `<Modal>` renders its content in its own native surface, so a toast
 * mounted only once at the app root (outside every modal) would be
 * invisible behind whichever modal is currently open — the same
 * cross-surface issue NotificationCenterModal's GestureHandlerRootView fix
 * dealt with, just for toasts instead of gesture handlers. Each caller
 * renders its own `<Toast toast={toast} onHide={hideToast} />` near the end
 * of its own tree instead.
 */
export function useToast() {
  const [toast, setToast] = useState(null);
  const idRef = useRef(0);

  const hideToast = useCallback(() => setToast(null), []);

  const showToast = useCallback((message, type = 'success') => {
    idRef.current += 1;
    setToast({ id: idRef.current, message, type });
  }, []);

  return { toast, showToast, hideToast };
}
