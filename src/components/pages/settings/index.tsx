import { useConfig } from '@/components/ConfigProvider';
import { eitherTrue } from '@/lib/primitive';
import { isAdministrator } from '@/lib/role';
import { useUserStore } from '@/lib/store/user';
import { Group, SimpleGrid, Stack, Title } from '@mantine/core';
import { lazy } from 'react';

const SettingsAvatar = lazy(() => import('./parts/SettingsAvatar'));
const SettingsDashboard = lazy(() => import('./parts/SettingsDashboard'));
const SettingsFileView = lazy(() => import('./parts/SettingsFileView'));
const SettingsGenerators = lazy(() => import('./parts/SettingsGenerators'));
const SettingsMfa = lazy(() => import('./parts/SettingsMfa'));
const SettingsServerActions = lazy(() => import('./parts/SettingsServerUtil'));
const SettingsUser = lazy(() => import('./parts/SettingsUser'));
const SettingsExports = lazy(() => import('./parts/SettingsExports'));
const SettingsSessions = lazy(() => import('./parts/SettingsSessions'));
const SettingsOAuth = lazy(() => import('./parts/SettingsOAuth'));

export default function DashboardSettings() {
  const config = useConfig();
  const user = useUserStore((state) => state.user);

  return (
    <>
      <Group gap='sm'>
        <Title order={1}>Settings</Title>
      </Group>

      <SimpleGrid mt='md' cols={{ base: 1, md: 2 }} spacing='lg'>
        <SettingsUser />

        <SettingsAvatar />

        <Stack gap='sm'>
          <SettingsSessions />
          <SettingsDashboard />
        </Stack>

        <SettingsFileView />

        {eitherTrue(
          config.oauthEnabled.discord,
          config.oauthEnabled.github,
          config.oauthEnabled.google,
          config.oauthEnabled.oidc,
        ) && <SettingsOAuth />}

        {eitherTrue(config.mfa.totp.enabled, config.mfa.passkeys) && <SettingsMfa />}

        <SettingsExports />
        <SettingsGenerators />

        {isAdministrator(user?.role) && <SettingsServerActions />}
      </SimpleGrid>
    </>
  );
}
