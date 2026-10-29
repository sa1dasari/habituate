import { useCallback, useRef, useState } from 'react';

/**
 * Same local-not-global reasoning as useToast — instantiated once per
 * screen/modal, rendered via <ConfirmModal/> near the end of that same
 * JSX tree so a confirmation fired from inside an already-open RN
 * `<Modal>` still appears (nested `<Modal>`s stack correctly on their own,
 * unlike a gesture handler or a plain overlay would).
 *
 * confirm({ title, message, confirmLabel, destructive }) resolves true if
 * the user confirmed, false if they cancelled or dismissed — mirrors the
 * shape of Alert.alert's two-button case, just Promise-based instead of
 * callback-based, and rendered with this app's own visual language instead
 * of the OS's native dialog.
 */
export function useConfirm() {
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setRequest(options);
    });
  }, []);

  const respond = useCallback((result) => {
    setRequest(null);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    if (resolve) resolve(result);
  }, []);

  return { request, confirm, respond };
}
