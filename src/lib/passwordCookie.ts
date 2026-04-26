import { config } from '@/lib/config';
import { decrypt, encrypt } from '@/lib/crypto';
import { FastifyReply } from 'fastify';

export function setPasswordCookie(res: FastifyReply, kind: 'file' | 'url', id: string, password: string) {
  res.cookie(`${kind}_pw_${id}`, encrypt(password, config.core.secret), {
    sameSite: 'lax',
    expires: new Date(Date.now() + 15 * 60_000),
    httpOnly: true,
    secure: config.core.returnHttpsUrls,
    path: '/',
  });
}

export function getPasswordCookie(
  cookies: Record<string, string | undefined>,
  kind: 'file' | 'url',
  id: string,
) {
  const cookie = cookies[`${kind}_pw_${id}`];
  if (!cookie) return null;
  try {
    return decrypt(cookie, config.core.secret);
  } catch {
    return null;
  }
}
