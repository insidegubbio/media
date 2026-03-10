import { useConfig } from '@/components/ConfigProvider';
import { Response } from '@/lib/api/response';
import { bytes } from '@/lib/bytes';
import { UploadOptionsStore } from '@/lib/store/uploadOptions';
import { ActionIcon, Anchor, Group, Stack, Text, Tooltip } from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { hideNotification, notifications } from '@mantine/notifications';
import { IconClipboardCopy, IconExternalLink, IconFileUpload, IconFileXFilled } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { handleResponse } from './uploadFiles';

export function progressTracker(size: number) {
  const alpha = 0.2;
  let totalBytes = 0;
  let resSpeed = 0;

  const startTime = Date.now();

  return {
    update: (loaded: number) => {
      const now = Date.now();
      const lastLoaded = totalBytes + loaded;

      const timeDiff = (now - startTime) / 1000;

      // exponential moving average
      if (timeDiff > 0) {
        const speed = lastLoaded / timeDiff;

        resSpeed = resSpeed === 0 ? speed : speed * alpha + resSpeed * (1 - alpha);
      }

      const percent = Math.round((lastLoaded / size) * 100);

      const remainingBytes = size - lastLoaded;
      const remaining = resSpeed > 0 ? remainingBytes / resSpeed : 0;

      return {
        percent: Math.min(percent, 99),
        speed: resSpeed,
        remaining: Math.max(remaining, 0),
      };
    },

    finish: (chunkSize: number) => {
      totalBytes += chunkSize;
    },
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
                <ActionIcon onClick={() => open(idx)} variant='filled' color='primary'>
                  <IconExternalLink size='1rem' />
                </ActionIcon>
              </Tooltip>
              <Tooltip label='Copy link to clipboard'>
                <ActionIcon onClick={() => copy(idx)} variant='filled' color='primary'>
                  <IconClipboardCopy size='1rem' />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        ))}
      </Stack>
    ),
  });

  clearEphemeral();
}

export async function uploadPartialFiles(
  files: File[],
  {
    setProgress,
    setLoading,
    setFiles,
    clipboard,
    options,
    ephemeral,
    config,
    folder,
  }: {
    setProgress: (o: { percent: number; remaining: number; speed: number }) => void;
    setLoading: (loading: boolean) => void;
    setFiles: (files: File[]) => void;
    clipboard: ReturnType<typeof useClipboard>;
    clearEphemeral: () => void;
    options: UploadOptionsStore['options'];
    ephemeral: UploadOptionsStore['ephemeral'];
    config: ReturnType<typeof useConfig>;
    folder?: string;
  },
) {
  setLoading(true);
  setProgress({ percent: 0, remaining: 0, speed: 0 });

  const chunkSize = bytes(config.chunks.size);

  for (let i = 0; i !== files.length; ++i) {
    const file = files[i];

    const tracker = progressTracker(file.size);
    let lastUpdate = 0;

    const nChunks = Math.ceil(file.size / chunkSize);
    const chunks: {
      blob: Blob;
      start: number;
      end: number;
    }[] = [];

    for (let j = 0; j !== nChunks; ++j) {
      const start = j * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      chunks.push({
        blob: file.slice(start, end),
        start,
        end,
      });
    }

    notifications.show({
      id: 'upload-partial',
      title: 'Uploading partial file',
      message: `Uploading partial ${i + 1}/${chunks.length}`,
      loading: true,
      autoClose: false,
    });

    let ready = true;
    let identifier: string | undefined;

    for (let j = 0; j !== nChunks; ++j) {
      while (!ready) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const body = new FormData();
      body.append('file', chunks[j].blob);

      setLoading(true);
      const req = new XMLHttpRequest();

      req.upload.addEventListener('progress', (e) => {
        if (!e.lengthComputable) return;

        const stats = tracker.update(e.loaded);

        const now = Date.now();
        if (now - lastUpdate > 250) {
          setProgress(stats);
          lastUpdate = now;
        }
      });

      req.addEventListener(
        'load',
        () => {
          const { data: res, error } = handleResponse<Response['/api/upload/partial']>(req);

          if (error || !res) {
            notifications.update({
              id: 'upload-partial',
              title: 'Error uploading files',
              message: error?.error ?? 'An unknown error occurred',
              color: 'red',
              icon: <IconFileXFilled size='1rem' />,
              autoClose: false,
              loading: false,
            });
            ready = false;
            setFiles([]);
            setProgress({ percent: 0, remaining: 0, speed: 0 });
            setLoading(false);
            return;
          }

          notifications.update({
            id: 'upload-partial',
            title: 'Uploading partial file',
            message: `Uploading partial ${j + 1}/${nChunks} successful`,
            loading: false,
            autoClose: false,
          });

          if (j === 0) {
            identifier = res.partialIdentifier;
          }

          if (j === chunks.length - 1) {
            notifications.update({
              id: 'upload-partial',
              title: 'Finalizing partial upload',
              message: (
                <Text>
                  The upload has been offloaded and will complete in the background.
                  <br />
                  <Anchor
                    component='span'
                    onClick={() => {
                      hideNotification('upload-partial');
                      clipboard.copy(res.files[0].url);
                      notifications.show({
                        title: 'Copied URL to clipboard',
                        message: (
                          <Anchor component={Link} to={res.files[0].url} target='_blank'>
                            {res.files[0].url}
                          </Anchor>
                        ),
                      });
                    }}
                  >
                    Click here to copy the URL to clipboard while it&apos;s being processed.
                  </Anchor>
                  <br />
                  <Anchor component={Link} to='/dashboard/files?popen=true'>
                    View processing files
                  </Anchor>
                </Text>
              ),
              color: 'green',
              icon: <IconFileUpload size='1rem' />,
              autoClose: true,
              loading: false,
            });

            setFiles([]);
            setProgress({ percent: 100, remaining: 0, speed: 0 });
            setLoading(false);

            setTimeout(() => setProgress({ percent: 0, remaining: 0, speed: 0 }), 1000);
          }

          tracker.finish(chunks[j].blob.size);

          ready = true;
        },
        false,
      );

      req.open('POST', '/api/upload/partial');
      options.deletesAt !== 'default' && req.setRequestHeader('x-zipline-deletes-at', options.deletesAt);
      options.format !== 'default' && req.setRequestHeader('x-zipline-format', options.format);
      options.imageCompressionPercent &&
        req.setRequestHeader(
          'x-zipline-image-compression-percent',
          options.imageCompressionPercent.toString(),
        );
      options.imageCompressionFormat !== 'default' &&
        req.setRequestHeader('x-zipline-image-compression-type', options.imageCompressionFormat);
      options.maxViews && req.setRequestHeader('x-zipline-max-views', options.maxViews.toString());
      options.addOriginalName && req.setRequestHeader('x-zipline-original-name', 'true');
      options.overrides_returnDomain &&
        req.setRequestHeader('x-zipline-domain', options.overrides_returnDomain);

      ephemeral.password && req.setRequestHeader('x-zipline-password', ephemeral.password);
      ephemeral.filename &&
        req.setRequestHeader('x-zipline-filename', encodeURIComponent(ephemeral.filename));

      if (folder) {
        req.setRequestHeader('x-zipline-folder', folder);
      } else if (ephemeral.folderId) {
        req.setRequestHeader('x-zipline-folder', ephemeral.folderId);
      }

      identifier && req.setRequestHeader('x-zipline-p-identifier', identifier);
      req.setRequestHeader('x-zipline-p-filename', encodeURIComponent(file.name));
      req.setRequestHeader('x-zipline-p-lastchunk', j === chunks.length - 1 ? 'true' : 'false');
      req.setRequestHeader('x-zipline-p-content-type', file.type);
      req.setRequestHeader('x-zipline-p-content-length', file.size.toString());
      req.setRequestHeader('content-range', `bytes ${chunks[j].start}-${chunks[j].end}/${file.size}`);

      req.send(body);

      ready = false;
    }
  }
}
