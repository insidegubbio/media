const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CHARSET_LENGTH = CHARSET.length;
const MAX = 256 - (256 % CHARSET_LENGTH);

function getRandomValues(array: Uint8Array) {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(array);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('crypto').webcrypto.getRandomValues(array);
  }
}

export function randomCharacters(length: number) {
  const randomValues = new Uint8Array(Math.ceil(length * 1.5));
  let result = '';

  while (result.length < length) {
    getRandomValues(randomValues);
    for (let i = 0; i !== randomValues.length && result.length !== length; ++i) {
      const value = randomValues[i];
      if (value < MAX) {
        result += CHARSET[value % CHARSET_LENGTH];
      }
    }
  }

  return result;
}

export function randomIndex(length: number) {
  const randomValues = new Uint8Array(1);
  getRandomValues(randomValues);

  return randomValues[0] % length;
}
