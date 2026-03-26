import { generateSecret, generateURI, verifySync } from 'otplib';
import { toDataURL } from 'qrcode';

export function generateKey() {
  return generateSecret({
    length: 16,
  });
}

export function verifyTotpCode(code: string, secret: string) {
  return verifySync({
    secret,
    token: code,
  });
}

export function totpQrcode({
  issuer,
  username,
  secret,
}: {
  issuer?: string;
  username: string;
  secret: string;
}) {
  return toDataURL(
    generateURI({
      secret,
      issuer: issuer ?? 'Zipline',
      label: username,
    }),
  );
}
