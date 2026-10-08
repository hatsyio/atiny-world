/** Includes portalled overlays owned by controls inside the container. */
export function containsOverlayTarget(container: HTMLElement | null, target: EventTarget | null): boolean {
  if (!container || !(target instanceof Node)) return false
  if (container.contains(target)) return true
  if (!(target instanceof Element)) return false
  const owner = target.closest('[data-overlay-owner]')?.getAttribute('data-overlay-owner')
  return !!owner && Array.from(container.querySelectorAll('[data-overlay-owner]')).some(element => element.getAttribute('data-overlay-owner') === owner)
}
