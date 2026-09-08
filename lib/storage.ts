export interface StorageWriteResult {
  ok: boolean;
  reason?: 'quota' | 'unavailable';
}

export const writeLocalStorage = (
  key: string,
  value: string,
): StorageWriteResult => {
  if (typeof window === 'undefined')
    return { ok: false, reason: 'unavailable' };

  try {
    window.localStorage.setItem(key, value);
    return { ok: true };
  } catch (error) {
    const isQuotaError =
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    return { ok: false, reason: isQuotaError ? 'quota' : 'unavailable' };
  }
};
