import RelativeDate from '@/components/RelativeDate';
import { fetchApi } from '@/lib/fetchApi';
import { useUserStore } from '@/lib/store/user';
import { UserPasskey } from '@/prisma/client';
import { ActionIcon, Button, Group, Modal, Paper, Stack, Text, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
  startRegistration,
} from '@simplewebauthn/browser';
import { IconKey, IconKeyOff, IconTrashFilled } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { mutate } from 'swr';

export default function PasskeyButton() {
  const user = useUserStore((state) => state.user);

  const [passkeyOpen, setPasskeyOpen] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [namerShown, setNamerShown] = useState(false);
  const [savedKey, setSavedKey] = useState<RegistrationResponseJSON | null>(null);
  const [name, setName] = useState('');

  const handleRegisterPasskey = async () => {
    try {
      const { data } = await fetchApi<PublicKeyCredentialCreationOptionsJSON>(
        '/api/user/mfa/passkey/options',
        'GET',
      );

      setPasskeyLoading(true);
      const res = await startRegistration({ optionsJSON: data! });
      setNamerShown(true);
      setSavedKey(res);
    } catch (e: any) {
      setPasskeyError(e.message ?? 'An error occurred while creating a passkey');
      setPasskeyLoading(false);
      setSavedKey(null);
    }
  };

  const handleSavePasskey = async () => {
    if (!savedKey) return;

    const { error } = await fetchApi('/api/user/mfa/passkey', 'POST', {
      response: savedKey,
      name: name.trim(),
    });

    if (error) {
      setNamerShown(false);
      setPasskeyError('');
      setPasskeyLoading(false);
      setSavedKey(null);

      notifications.show({
        title: 'Error while saving passkey',
        message: error.error,
        color: 'red',
        icon: <IconKeyOff size='1rem' />,
      });
    } else {
      setNamerShown(false);
      setPasskeyLoading(false);
      setSavedKey(null);
      setPasskeyOpen(false);

      notifications.show({
        title: 'Passkey saved!',
        message: 'Your passkey has been saved successfully.',
        color: 'green',
        icon: <IconKey size='1rem' />,
      });

      mutate('/api/user');
    }
  };

  const removePasskey = async (passkey: UserPasskey) => {
    modals.openConfirmModal({
      title: 'Are you sure?',
      children: `Your browser and device may still show "${passkey.name}" as an option to log in. If you want to remove it, you'll have to do so manually through your device's settings.`,
      labels: {
        confirm: `Remove "${passkey.name}"`,
        cancel: 'Cancel',
      },
      confirmProps: {
        color: 'red',
      },
      onConfirm: async () => {
        const { error } = await fetchApi('/api/user/mfa/passkey', 'DELETE', {
          id: passkey.id,
        });

        if (error) {
          notifications.show({
            title: 'Error while removing passkey',
            message: error.error,
            color: 'red',
            icon: <IconKeyOff size='1rem' />,
          });
        } else {
          notifications.show({
            title: 'Passkey removed!',
            message: 'Your passkey has been removed successfully.',
            color: 'green',
            icon: <IconKey size='1rem' />,
          });

          mutate('/api/user');
        }
      },
    });
  };

  useEffect(() => {
    if (passkeyError) {
      const timeout = setTimeout(() => {
        setPasskeyError(null);
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [passkeyError]);

  return (
    <>
      <Modal title='Manage passkeys' opened={passkeyOpen} onClose={() => setPasskeyOpen(false)}>
        <Stack gap='sm'>
          <>
            {user?.passkeys?.map((passkey, i) => (
              <Paper withBorder p='xs' key={i}>
                <Group justify='space-between'>
                  <Text fw='bolder'>{passkey.name}</Text>
                  <ActionIcon color='red' onClick={() => removePasskey(passkey)}>
                    <IconTrashFilled size='1rem' />
                  </ActionIcon>
                </Group>
                <Text size='sm'>
                  Passkey created <RelativeDate date={passkey.createdAt} />
                  {passkey.lastUsed && (
                    <>
                      , last used <RelativeDate date={passkey.lastUsed} />.
                    </>
                  )}
                </Text>
                {!(passkey?.reg as Record<string, any>).webauthn && (
                  <Text size='xs' mt='xs' c='red'>
                    Warning: This passkey was created with an older version of Zipline and <b>WILL NOT</b>{' '}
                    work with this version. Please delete and recreate this passkey to ensure compatibility.
                  </Text>
                )}
              </Paper>
            ))}
          </>
          <Button
            size='sm'
            leftSection={<IconKey size='1rem' />}
            color={passkeyError ? 'red' : undefined}
            onClick={handleRegisterPasskey}
            loading={passkeyLoading}
            disabled={!!passkeyError}
          >
            {passkeyError
              ? 'Error while creating a passkey - try again later'
              : passkeyLoading
                ? 'Loading...'
                : 'Create a passkey'}
          </Button>
          {passkeyError && (
            <Text size='xs' c='red'>
              {passkeyError}
            </Text>
          )}

          {namerShown && (
            <>
              <Text size='sm'>Assign a name to this passkey so you can remember it later.</Text>

              <TextInput
                placeholder='Passkey name'
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
              />

              <Button
                size='sm'
                leftSection={<IconKey size='1rem' />}
                color='blue'
                onClick={handleSavePasskey}
              >
                Save
              </Button>
            </>
          )}
        </Stack>
      </Modal>

      <Button size='sm' leftSection={<IconKey size='1rem' />} onClick={() => setPasskeyOpen(true)}>
        Manage passkeys
      </Button>
    </>
  );
}
