export function isTV(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /(TV|Tizen|Web0S|WebOS|SMART-TV|BRAVIA|Viera|Android TV|CrKey|AFTS|Xbox|PlayStation|PS4|PS5)/i.test(
    navigator.userAgent,
  );
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}