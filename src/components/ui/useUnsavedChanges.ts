import { useEffect } from 'react';
export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    let navigationConfirmed = false;
    let resetConfirmation: ReturnType<typeof setTimeout> | undefined;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (navigationConfirmed) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const navigate = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
      if (
        !link ||
        link.target === '_blank' ||
        link.hasAttribute('download') ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = new URL(link.href, location.href);
      if (target.pathname === location.pathname && target.search === location.search) return;
      if (!confirm('Draf belum disimpan. Tinggalkan halaman dan abaikan perubahan ini?')) {
        event.preventDefault();
      } else {
        // The user already confirmed this navigation; avoid a second native prompt.
        navigationConfirmed = true;
        resetConfirmation = setTimeout(() => {
          navigationConfirmed = false;
        }, 1000);
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', navigate, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', navigate, true);
      clearTimeout(resetConfirmation);
    };
  }, [dirty]);
}
