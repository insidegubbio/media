import { Url } from '@/lib/db/models/url';
import { fetchApi } from '@/lib/fetchApi';
import { Button, Divider, Modal, NumberInput, PasswordInput, Stack, Switch, TextInput } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { IconEye, IconKey, IconPencil, IconPencilOff, IconTrashFilled } from '@tabler/icons-react';
import { useState } from 'react';
import { mutate } from 'swr';

export default function EditUrlModal({
  url,
  onClose,
  open,
}: {
  open: boolean;
  url: Url | null;
  onClose: () => void;
}) {
  if (!url) return null;

  const [maxViews, setMaxViews] = useState<number | null>(url?.maxViews ?? null);
  const [vanity, setVanity] = useState<string | null>(url?.vanity ?? null);
  const [destination, setDestination] = useState<string | null>(url?.destination ?? null);
  const [enabled, setEnabled] = useState<boolean>(url?.enabled ?? true);
  const [password, setPassword] = useState<string | null>('');

  const handleRemovePassword = async () => {
    if (!url.password) return;

    const { error } = await fetchApi(`/api/user/urls/${url.id}`, 'PATCH', {
      password: null,
    });

    if (error) {
      showNotification({
        title: 'Failed to remove password...',
        message: error.error,
        color: 'red',
        icon: <IconPencilOff size='1rem' />,
      });
    } else {
      showNotification({
        title: 'Password removed!',
        message: 'The password has been removed from the URL.',
        color: 'green',
        icon: <IconPencil size='1rem' />,
      });

      onClose();
      mutate('/api/user/urls');
      mutate({ key: '/api/user/urls' });
    }
  };

  const handleSave = async () => {
    const data: {
      maxViews?: number;
      password?: string;
      vanity?: string;
      destination?: string;
      enabled?: boolean;
    } = {};

    if (maxViews !== null) data['maxViews'] = maxViews;
    if (password !== null) data['password'] = password?.trim();
    if (vanity !== null && vanity !== url.vanity) data['vanity'] = vanity?.trim();
    if (destination !== null && destination !== url.destination) data['destination'] = destination?.trim();
    if (enabled !== url.enabled) data['enabled'] = enabled;

    const { error } = await fetchApi(`/api/user/urls/${url.id}`, 'PATCH', data);

    if (error) {
      showNotification({
        title: 'Failed to save changes...',
        message: error.error,
        color: 'red',
        icon: <IconPencilOff size='1rem' />,
      });
    } else {
      showNotification({
        title: 'Changes saved!',
        message: 'The changes have been saved successfully.',
        color: 'green',
        icon: <IconPencil size='1rem' />,
      });

      onClose();
      mutate('/api/user/urls');
      mutate({ key: '/api/user/urls' });
    }
  };

  return (
    <Modal title={`Editing "${url.vanity ?? url.code}"`} opened={open} onClose={onClose}>
      <Stack gap='xs' my='sm'>
        <NumberInput
          label='Max Views'
          placeholder='Unlimited'
          description='The maximum number of clicks this URL can have before it is automatically deleted. Leave blank to allow as many views as you want.'
          value={maxViews || ''}
          onChange={(value) => setMaxViews(value === '' ? null : Number(value))}
          min={0}
          leftSection={<IconEye size='1rem' />}
        />

        <TextInput
          label='Vanity'
          placeholder='Optional'
          description='A custom alias for your URL. Leave blank to use the randomly generated code.'
          value={vanity || ''}
          onChange={(event) =>
            setVanity(event.currentTarget.value.trim() === '' ? null : event.currentTarget.value.trim())
          }
        />

        <TextInput
          label='Destination'
          placeholder='https://example.com'
          value={destination || ''}
          onChange={(event) =>
            setDestination(event.currentTarget.value.trim() === '' ? null : event.currentTarget.value.trim())
          }
        />

        <Switch
          label='Enabled'
          description='Prevent or allow this URL from being visited.'
          checked={enabled}
          onChange={(event) => setEnabled(event.currentTarget.checked)}
        />

        <Divider />

        {url.password ? (
          <Button
            variant='light'
            color='red'
            leftSection={<IconTrashFilled size='1rem' />}
            onClick={handleRemovePassword}
          >
            Remove password
          </Button>
        ) : (
          <PasswordInput
            label='Password'
            description='Set a password for this URL. Leave blank to disable password protection.'
            value={password ?? ''}
            autoComplete='off'
            onChange={(event) =>
              setPassword(event.currentTarget.value.trim() === '' ? null : event.currentTarget.value.trim())
            }
            leftSection={<IconKey size='1rem' />}
          />
        )}

        <Divider />

        <Button onClick={handleSave} leftSection={<IconPencil size='1rem' />}>
          Save changes
        </Button>
      </Stack>
    </Modal>
  );
}
