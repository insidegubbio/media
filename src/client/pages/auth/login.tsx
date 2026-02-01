import ExternalAuthButton from '@/components/pages/login/ExternalAuthButton';
import { Response } from '@/lib/api/response';
import { fetchApi } from '@/lib/fetchApi';
import useLogin from '@/lib/hooks/useLogin';
import { useTitle } from '@/lib/hooks/useTitle';
import {
  Anchor,
  Box,
  Button,
  Center,
  Code,
  Divider,
  Group,
  Image,
  LoadingOverlay,
  Modal,
  Paper,
  PasswordInput,
  PinInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications, showNotification } from '@mantine/notifications';
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import {
  IconBrandDiscordFilled,
  IconBrandGithubFilled,
  IconBrandGoogleFilled,
  IconCircleKeyFilled,
  IconKey,
  IconShieldQuestion,
  IconUserPlus,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import GenericError from '../../error/GenericError';

export default function Login() {
  useTitle('Login');

  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const { user, mutate } = useLogin();

  const navigate = useNavigate();

  const isHttps = window.location.protocol === 'https:';

  const {
    data: config,
    error: configError,
    isLoading: configLoading,
  } = useSWR<Response['/api/server/public']>('/api/server/public', {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshWhenHidden: false,
    revalidateIfStale: false,
  });

  const showLocalLogin =
    query.get('local') === 'true' ||
    !(
      config?.oauth?.bypassLocalLogin &&
      Object.values(config?.oauthEnabled ?? {}).filter((x) => x === true).length > 0
    );

  const willRedirect =
    config?.oauth?.bypassLocalLogin &&
    Object.values(config?.oauthEnabled ?? {}).filter((x) => x === true).length === 1 &&
    query.get('local') !== 'true';

  const [totpOpen, setTotpOpen] = useState(false);
  const [pinDisabled, setPinDisabled] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pin, setPin] = useState('');

  const [passkeyErrored, setPasskeyErrored] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const [secureModal, setSecureModal] = useState(false);

  const form = useForm({
    initialValues: {
      username: '',
      password: '',
    },
    validate: {
      username: (value) => (value.length > 1 ? null : 'Username is required'),
      password: (value) => (value.length > 1 ? null : 'Password is required'),
    },
    enhanceGetInputProps: ({ field }) => ({
      name: field,
    }),
  });

  const onSubmit = async (values: typeof form.values, code: string | undefined = undefined) => {
    setPinDisabled(true);
    setPinError('');

    const { username, password } = values;

    const { data, error } = await fetchApi<Response['/api/auth/login']>('/api/auth/login', 'POST', {
      username,
      password,
      code,
    });

    if (error) {
      if (error.error === 'Invalid username or password') {
        form.setFieldError('username', 'Invalid username');
        form.setFieldError('password', 'Invalid password');
      } else if (error.error === 'Invalid code') setPinError(error.error!);
      setPinDisabled(false);
    } else {
      if (data!.totp) {
        setTotpOpen(true);
        setPinDisabled(false);
        return;
      }

      mutate(data as Response['/api/user']);
    }
  };

  const handlePinChange = (value: string) => {
    setPin(value);

    if (value.length === 6) {
      onSubmit(form.values, value);
    }
  };

  const handlePasskeyLogin = async () => {
    try {
      setPasskeyLoading(true);
      const { data: options, error: optionsError } = await fetchApi<Response['/api/auth/webauthn/options']>(
        '/api/auth/webauthn/options',
        'GET',
      );
      if (optionsError) {
        setPasskeyErrored(true);
        setPasskeyLoading(false);
        notifications.show({
          title: 'Error while authenticating with passkey',
          message: optionsError.error,
          color: 'red',
        });
        return;
      }

      const res = await startAuthentication({ optionsJSON: options!.options! });
      const { data, error } = await fetchApi<Response['/api/auth/webauthn']>('/api/auth/webauthn', 'POST', {
        response: res,
      });
      if (error) {
        setPasskeyErrored(true);
        setPasskeyLoading(false);
        notifications.show({
          title: 'Error while authenticating with passkey',
          message: error.error,
          color: 'red',
        });
      } else {
        mutate(data as Response['/api/user']);
      }
    } catch (e) {
      console.log(e);
      setPasskeyErrored(true);
      setPasskeyLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user]);

  useEffect(() => {
    if (willRedirect && config) {
      const provider = Object.keys(config.oauthEnabled).find(
        (x) => config.oauthEnabled[x as keyof typeof config.oauthEnabled] === true,
      );

      if (provider) {
        window.location.href = `/api/auth/oauth/${provider.toLowerCase()}`;
      }
    }
  }, [willRedirect, config]);

  useEffect(() => {
    if (passkeyErrored) {
      setTimeout(() => {
        setPasskeyErrored(false);
      }, 3000);

      showNotification({
        title: 'Error while authenticating with passkey',
        message: 'Please try again',
        color: 'red',
        icon: <IconX size='1rem' />,
      });
    }
  }, [passkeyErrored]);

  useEffect(() => {
    if (config?.firstSetup) navigate('/auth/setup');
  }, [config]);

  if (configLoading) return <LoadingOverlay visible />;

  if (configError)
    return (
      <GenericError
        title='Error loading configuration'
        message='Could not load server configuration...'
        details={configError}
      />
    );

  if (!config) return <LoadingOverlay visible />;

  return (
    <>
      {willRedirect && !showLocalLogin && <LoadingOverlay visible />}

      <Modal onClose={() => {}} title='Enter code' opened={totpOpen} withCloseButton={false}>
        <Center>
          <PinInput
            data-autofocus
            length={6}
            oneTimeCode
            type='number'
            placeholder=''
            onChange={handlePinChange}
            autoFocus={true}
            error={!!pinError}
            disabled={pinDisabled}
            size='xl'
          />
        </Center>
        {pinError && (
          <Text ta='center' size='sm' c='red' mt={0}>
            {pinError}
          </Text>
        )}

        <Group mt='sm' grow>
          <Button
            leftSection={<IconX size='1rem' />}
            color='red'
            variant='outline'
            onClick={() => {
              setTotpOpen(false);
              form.reset();
            }}
          >
            Cancel login attempt
          </Button>
          <Button
            leftSection={<IconShieldQuestion size='1rem' />}
            loading={pinDisabled}
            type='submit'
            onClick={() => onSubmit(form.values, pin)}
          >
            Verify
          </Button>
        </Group>
      </Modal>

      <Modal opened={secureModal} onClose={() => setSecureModal(false)} title='HTTPS Configuration' size='lg'>
        <Text>
          It appears that you are accessing this instance through a secure context (HTTPS), but the server is
          not configured to use HTTPS. This can lead issues when logging in.
        </Text>
        <Text mt='md'>
          To resolve this issue, it is recommended to have your server configured to use HTTPS. This can be
          done by setting the <Code>CORE_RETURN_HTTPS_URLS</Code> environment variable to <Code>true</Code>{' '}
          and ensuring that your server has a valid SSL setup through a reverse proxy like Nginx or Caddy.
        </Text>

        <Text mt='md'>
          After making these changes, restart the server for the changes to take effect. If you continue to
          experience issues, please consult the{' '}
          <Anchor
            underline='always'
            href='https://zipline.diced.sh/docs/config/settings#more-about-return-https-urls'
          >
            documentation
          </Anchor>{' '}
          or seek support.
        </Text>
      </Modal>

      {isHttps && !config.returnHttps && (
        <Box pos='absolute' top={10} left='50%' style={{ transform: 'translateX(-50%)' }}>
          <Text size='sm' c='red' ta='center'>
            You are accessing this instance through a secure context but the server is not configured to use
            HTTPS. Click <Anchor onClick={() => setSecureModal(true)}> here</Anchor> to learn more.
          </Text>
        </Box>
      )}

      <Center h='100vh'>
        {config.website.loginBackground && (
          <Image
            src={config.website.loginBackground}
            alt={config.website.loginBackground + ' failed to load'}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              ...(config.website.loginBackgroundBlur && { filter: 'blur(10px)' }),
            }}
          />
        )}

        <Paper
          w='350px'
          p='xl'
          shadow='xl'
          withBorder
          style={{
            backgroundColor: config.website.loginBackground ? 'rgba(0, 0, 0, 0)' : undefined,
            backdropFilter: config.website.loginBackgroundBlur ? 'blur(35px)' : undefined,
          }}
        >
          <div style={{ width: '100%', overflowWrap: 'break-word' }}>
            <Title
              order={1}
              ta='center'
              style={{
                whiteSpace: 'normal',
                fontSize: `clamp(20px, ${Math.max(
                  50 - (config.website.title?.length ?? 0) / 2,
                  20,
                )}px, 50px)`,
              }}
            >
              <b>{config.website.title ?? 'Zipline'}</b>
            </Title>
          </div>

          {showLocalLogin && (
            <form onSubmit={form.onSubmit((v) => onSubmit(v))}>
              <Stack my='sm'>
                <TextInput
                  size='md'
                  placeholder='Enter your username...'
                  autoComplete='username'
                  styles={{
                    input: {
                      backgroundColor: config.website.loginBackground ? 'transparent' : undefined,
                    },
                  }}
                  {...form.getInputProps('username', { withError: true })}
                />

                <PasswordInput
                  size='md'
                  placeholder='Enter your password...'
                  autoComplete='current-password'
                  styles={{
                    input: {
                      backgroundColor: config.website.loginBackground ? 'transparent' : undefined,
                    },
                  }}
                  {...form.getInputProps('password')}
                />

                <Button
                  size='md'
                  fullWidth
                  type='submit'
                  loading={!config}
                  variant={config.website.loginBackground ? 'outline' : 'filled'}
                >
                  Login
                </Button>
              </Stack>
            </form>
          )}

          <Stack my='xs'>
            {(config.features.oauthRegistration || config.features.userRegistration) && (
              <Divider label='or' />
            )}

            {config.mfa.passkeys && browserSupportsWebAuthn() && (
              <Button
                onClick={handlePasskeyLogin}
                size='md'
                fullWidth
                variant='outline'
                leftSection={<IconKey size='1rem' />}
                color={passkeyErrored ? 'red' : undefined}
                loading={passkeyLoading}
              >
                Login with passkey
              </Button>
            )}

            {config.features.userRegistration && (
              <Button
                component={Link}
                to='/auth/register'
                size='md'
                fullWidth
                variant='outline'
                leftSection={<IconUserPlus size='1rem' />}
              >
                Sign up
              </Button>
            )}

            <Group grow>
              {config.oauthEnabled.discord && (
                <ExternalAuthButton
                  provider='Discord'
                  leftSection={<IconBrandDiscordFilled stroke={4} size='1.1rem' />}
                />
              )}
              {config.oauthEnabled.github && (
                <ExternalAuthButton provider='GitHub' leftSection={<IconBrandGithubFilled size='1.1rem' />} />
              )}
              {config.oauthEnabled.google && (
                <ExternalAuthButton
                  provider='Google'
                  leftSection={<IconBrandGoogleFilled stroke={4} size='1.1rem' />}
                />
              )}
              {config.oauthEnabled.oidc && (
                <ExternalAuthButton provider='OIDC' leftSection={<IconCircleKeyFilled size='1.1rem' />} />
              )}
            </Group>
          </Stack>
        </Paper>
      </Center>
    </>
  );
}
