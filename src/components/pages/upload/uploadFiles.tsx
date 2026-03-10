import { Response } from '@/lib/api/response';
import { ErrorBody } from '@/lib/response';
import { UploadOptionsStore } from '@/lib/store/uploadOptions';
import { ActionIcon, Anchor, Button, Group, Stack, Tooltip } from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconClipboardCopy, IconExternalLink, IconFileUpload, IconFileXFilled } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

export function handleResponse<R = Response['/api/upload']>(
  xml: XMLHttpRequest,
): { data: R | null; error: ErrorBody | null } {
  if (xml.status < 200 || xml.status >= 300) {
    return {
      data: null,
      error: {
        statusCode: xml.status,
        error: `Request failed with status code ${xml.status}: ${xml.responseText}`,
      },
    };
  }

  try {
    const res = JSON.parse(xml.responseText) as R | ErrorBody;

    if ((res as ErrorBody).statusCode) {
      return { data: null, error: res as ErrorBody };
    }

    return { data: res as R, error: null };
  } catch (e) {
    console.error('Failed to parse server response:', e, xml.responseText);

    return {
      data: null,
      error: {
        statusCode: 500,
        error: 'Failed to parse server response. See browser console for more details.',
      },
    };
  }
}

function progressTracker() {
  const alpha = 0.2;

  let lastLoaded = 0;
  let lastTime = Date.now();
  let resSpeed = 0;

  return (loaded: number, total: number) => {
    const now = Date.now();
    const timeDiff = (now - lastTime) / 1000;

    if (timeDiff > 0) {
      const loadedDiff = loaded - lastLoaded;
      const speed = loadedDiff / timeDiff;

      // exponential moving average
      resSpeed = resSpeed === 0 ? speed : speed * alpha + resSpeed * (1 - alpha);
      lastLoaded = loaded;
      lastTime = now;
    }

    const percent = Math.round((loaded / total) * 100);

    const remainingBytes = total - loaded;
    const remaining = resSpeed > 0 ? remainingBytes / resSpeed : 0;

    return {
      percent,
      speed: resSpeed,
      remaining,
    };
  };
}

export function filesModal(
  files: Response['/api/upload']['files'],
  {
    clipboard,
    clearEphemeral,
  }: {
    clipboard: ReturnType<typeof useClipboard>;
    clearEphemeral: () => void;
  },
) {
  const open = (idx: number) => window.open(files[idx].url, '_blank');
  const copy = (idx: number) => {
    clipboard.copy(files[idx].url);
    notifications.show({
      title: 'Copied URL to clipboard',
      message: (
        <Anchor component={Link} to={files[idx].url} target='_blank'>
          {files[idx].url}
        </Anchor>
      ),
      color: 'blue',
      icon: <IconClipboardCopy size='1rem' />,
    });
  };

  modals.open({
    title: 'Uploaded files',
    size: 'auto',
    children: (
      <>
        <Stack>
          {files.map((file, idx) => (
            <Group key={idx} justify='space-between'>
              <Group justify='left'>
                <Anchor component={Link} to={file.url} target='_blank'>
                  {file.url}
                </Anchor>
              </Group>
              <Group justify='right'>
                <Tooltip label='Open link in a new tab'>
                  <ActionIcon onClick={() => open(idx)} variant='filled'>
                    <IconExternalLink size='1rem' />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label='Copy link to clipboard'>
                  <ActionIcon onClick={() => copy(idx)} variant='filled'>
                    <IconClipboardCopy size='1rem' />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>
          ))}
        </Stack>
        {files.length > 1 && (
          <Group justify='right'>
            <Tooltip label='Copy all links to clipboard (seperated by a new line)'>
              <Button
                onClick={() => {
                  clipboard.copy(files.map((file) => file.url).join('\n'));
                  notifications.show({
                    title: 'Copied URLs to clipboard',
                    message: 'Copied all URLs to clipboard seperated by a new line.',
                    color: 'blue',
                    icon: <IconClipboardCopy size='1rem' />,
                  });
                }}
                variant='filled'
                color='blue'
                size='compact-md'
                mt='sm'
                fullWidth
                leftSection={<IconClipboardCopy size='1rem' />}
              >
                Copy {files.length} URLs to clipboard
              </Button>
            </Tooltip>
          </Group>
        )}
      </>
    ),
  });

  clearEphemeral();
}

export function uploadFiles(
  files: File[],
  {
    setProgress,
    setLoading,
    setFiles,
    clipboard,
    clearEphemeral,
    options,
    ephemeral,
    folder,
  }: {
    setProgress: (o: { percent: number; remaining: number; speed: number }) => void;
    setLoading: (loading: boolean) => void;
    setFiles: (files: File[]) => void;
    clipboard: ReturnType<typeof useClipboard>;
    clearEphemeral: () => void;
    options: UploadOptionsStore['options'];
    ephemeral: UploadOptionsStore['ephemeral'];
    folder?: string;
  },
) {
  setLoading(true);
  setProgress({ percent: 0, remaining: 0, speed: 0 });
  const body = new FormData();

  for (let i = 0; i !== files.length; ++i) {
    body.append('file', files[i]);
  }

  notifications.show({
    id: 'upload',
    title: 'Uploading files',
    message: `Uploading ${files.length} file${files.length === 1 ? '' : 's'}`,
    loading: true,
    autoClose: false,
  });

  const tracker = progressTracker();
  let lastUpdate = 0;

  const req = new XMLHttpRequest();

  req.upload.addEventListener('progress', (e) => {
    if (!e.lengthComputable) return;

    const stats = tracker(e.loaded, e.total);

    const now = Date.now();
    if (now - lastUpdate > 250 || e.loaded === e.total) {
      setProgress(stats);
      lastUpdate = now;
    }
  });

  req.addEventListener(
    'load',
    () => {
      const { data: res, error } = handleResponse<Response['/api/upload']>(req);

      setLoading(false);
      setProgress({ percent: 0, remaining: 0, speed: 0 });

      if (error || !res) {
        notifications.update({
          id: 'upload',
          title: 'Error uploading files',
          message: error?.error ?? 'An unknown error occurred',
          color: 'red',
          icon: <IconFileXFilled size='1rem' />,
          autoClose: true,
          loading: false,
        });
        return;
      }

      notifications.update({
        id: 'upload',
        title: 'Uploaded files',
        message: `Uploaded ${files.length} file${files.length === 1 ? '' : 's'}`,
        color: 'green',
        icon: <IconFileUpload size='1rem' />,
        autoClose: true,
        loading: false,
      });

      setFiles([]);
      filesModal(res!.files, { clipboard, clearEphemeral });
    },
    false,
  );

  req.open('POST', '/api/upload');

  options.deletesAt !== 'default' && req.setRequestHeader('x-zipline-deletes-at', options.deletesAt);
  options.format !== 'default' && req.setRequestHeader('x-zipline-format', options.format);
  options.imageCompressionPercent &&
    req.setRequestHeader('x-zipline-image-compression-percent', options.imageCompressionPercent.toString());
  options.imageCompressionFormat !== 'default' &&
    req.setRequestHeader('x-zipline-image-compression-type', options.imageCompressionFormat);
  options.maxViews && req.setRequestHeader('x-zipline-max-views', options.maxViews.toString());
  options.addOriginalName && req.setRequestHeader('x-zipline-original-name', 'true');
  options.overrides_returnDomain && req.setRequestHeader('x-zipline-domain', options.overrides_returnDomain);

  ephemeral.password && req.setRequestHeader('x-zipline-password', ephemeral.password);
  ephemeral.filename && req.setRequestHeader('x-zipline-filename', encodeURIComponent(ephemeral.filename));

  if (folder) {
    req.setRequestHeader('x-zipline-folder', folder);
  } else if (ephemeral.folderId) {
    req.setRequestHeader('x-zipline-folder', ephemeral.folderId);
  }

  req.send(body);
}
