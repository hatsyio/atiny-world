/** Native app selection is a mobile flow; desktop share support alone does not select a network. */
export function isMobileShareDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const agentData = (navigator as Navigator & {userAgentData?:{mobile:boolean; platform?:string}}).userAgentData
  if (agentData?.mobile || agentData?.platform === 'Android') return true
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
export function supportsMobileFileSharing(): boolean {
  if (!isMobileShareDevice()) return false
  try {
    return typeof navigator.share === 'function' && Boolean(navigator.canShare?.({files:[new File([''], 'letter.png', {type:'image/png'})]}))
  } catch { return false }
}
