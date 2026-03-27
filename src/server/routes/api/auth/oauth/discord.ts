import { fetchToDataURL } from '@/lib/base64';
import { config } from '@/lib/config';
import { encrypt } from '@/lib/crypto';
import Logger from '@/lib/logger';
import enabled from '@/lib/oauth/enabled';
import { discordAuth } from '@/lib/oauth/providers';
import { OAuthQuery, OAuthResponse } from '@/server/plugins/oauth';
import typedPlugin from '@/server/typedPlugin';

async function discordOauth({ code, host, state }: OAuthQuery, logger: Logger): Promise<OAuthResponse> {
  if (!config.features.oauthRegistration)
    return {
      error: 'OAuth registration is disabled.',
      error_code: 403,
    };

  const { discord: discordEnabled } = enabled(config);

  if (!discordEnabled)
    return {
      error: 'Discord OAuth is not configured.',
      error_code: 401,
    };

  if (!code) {
    const linkState = encrypt('link', config.core.secret);

    return {
      redirect: discordAuth.url(
        config.oauth.discord.clientId!,
        `${config.core.returnHttpsUrls ? 'https' : 'http'}://${host}`,
        state === 'link' ? linkState : undefined,
        config.oauth.discord.redirectUri ?? undefined,
      ),
    };
  }

  const body = new URLSearchParams({
    client_id: config.oauth.discord.clientId!,
    client_secret: config.oauth.discord.clientSecret!,
    grant_type: 'authorization_code',
    code,
    redirect_uri:
      config.oauth.discord.redirectUri ??
      `${config.core.returnHttpsUrls ? 'https' : 'http'}://${host}/api/auth/oauth/discord`,
    scope: 'identify',
  });

  logger.debug('discord oauth request', {
    body: body.toString(),
  });

  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    logger.debug('discord oauth failed with a non 200 status code', {
      status: res.status,
      text,
    });

    return {
      error: 'Failed to fetch access token',
    };
  }

  const json = await res.json();

  if (!json.access_token) return { error: 'No access token in response' };
  if (!json.refresh_token) return { error: 'No refresh token in response' };

  const userJson = await discordAuth.user(json.access_token);
  if (!userJson) return { error: 'Failed to fetch user' };

  logger.debug('user', { '@me': userJson });

  const allowedIds = config.oauth.discord.allowedIds;
  const deniedIds = config.oauth.discord.deniedIds;
  if (deniedIds && deniedIds.length > 0 && deniedIds.includes(userJson.id)) {
    return { error: 'You are not allowed to log in with Discord.' };
  }
  if (allowedIds && allowedIds.length > 0 && !allowedIds.includes(userJson.id)) {
    return { error: 'You are not allowed to log in with Discord.' };
  }

  const avatar = userJson.avatar
    ? `https://cdn.discordapp.com/avatars/${userJson.id}/${userJson.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/${userJson.discriminator % 5}.png`;

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    username: userJson.username,
    user_id: userJson.id,
    avatar: await fetchToDataURL(avatar),
  };
}

export const PATH = '/api/auth/oauth/discord';
export default typedPlugin(
  async (server) => {
    server.get(PATH, async (req, res) => {
      return req.oauthHandle(res, 'DISCORD', discordOauth);
    });
  },
  { name: PATH },
);
