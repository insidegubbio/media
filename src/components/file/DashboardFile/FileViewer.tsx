import { bytes } from '@/lib/bytes';
import { useFileNavStore } from '@/lib/client/store/fileNav';
import { useSettingsStore } from '@/lib/client/store/settings';
import { File } from '@/lib/db/models/file';
import {
  ActionIcon,
  ActionIconProps,
  Box,
  Drawer,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import {
  Icon,
  IconBombFilled,
  IconChevronLeft,
  IconChevronRight,
  IconClipboardTypography,
  IconCopy,
  IconDeviceSdCard,
  IconDownload,
  IconExternalLink,
  IconEyeFilled,
  IconFileInfo,
  IconInfoCircle,
  IconPencil,
  IconRefresh,
  IconStar,
  IconStarFilled,
  IconTextRecognition,
  IconTrashFilled,
  IconUpload,
  IconUserQuestion,
  IconX,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/shallow';

import DashboardFileType from '../DashboardFileType';
import { copyFile, deleteFile, downloadFile, favoriteFile, viewFile } from '../actions';
import EditFileDetailsModal from './EditFileDetailsModal';
import FileStat from './FileStat';
import classes from './FileViewer.module.css';

function ActionButton({
  Icon,
  onClick,
  tooltip,
  color,
  ...props
}: {
  Icon: Icon;
  onClick: () => void;
  tooltip: string;
  color?: string;
} & ActionIconProps) {
  return (
    <Tooltip label={tooltip} zIndex='200'>
      <ActionIcon
        size='xl'
        variant='subtle'
        bd='1px solid var(--mantine-color-dark-4)'
        color={color ?? 'gray'}
        onClick={onClick}
        {...props}
      >
        <Icon size='1.15rem' />
      </ActionIcon>
    </Tooltip>
  );
}

export default function FileViewer({
  open,
  setOpen,
  file,
  reduce,
  user: _user,
  sequenced,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  file?: File | null;
  reduce?: boolean;
  user?: string;
  sequenced?: boolean;
}) {
  const clipboard = useClipboard();
  const warnDeletion = useSettingsStore((state) => state.settings.warnDeletion);
  const fileNavButtons = useSettingsStore((state) => state.settings.fileNavButtons);

  const [editFileOpen, setEditFileOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const [goPrev, goNext, hasPrev, hasNext] = useFileNavStore(
    useShallow((state) => {
      if (!state.current) return [state.goPrev, state.goNext, false, false];

      const idx = state.ids.indexOf(state.current);
      return [state.goPrev, state.goNext, idx > 0, idx >= 0 && idx < state.ids.length - 1];
    }),
  );

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();

      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (!sequenced) return;
      if (event.key === 'ArrowLeft' && hasPrev) {
        goPrev();
      } else if (event.key === 'ArrowRight' && hasNext) {
        goNext();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, sequenced, hasPrev, hasNext, goPrev, goNext, setOpen]);

  return (
    <>
      {file && (
        <EditFileDetailsModal open={editFileOpen} onClose={() => setEditFileOpen(false)} file={file} />
      )}

      <Drawer
        opened={infoOpen}
        onClose={() => setInfoOpen(false)}
        position='right'
        title={<Title order={2}>Details</Title>}
        radius='md'
        offset={20}
        overlayProps={{ blur: 6 }}
      >
        {file && (
          <Stack gap='md'>
            <FileStat Icon={IconFileInfo} title='Type' value={file.type} />
            <FileStat Icon={IconDeviceSdCard} title='Size' value={bytes(file.size)} />
            <FileStat
              Icon={IconUpload}
              title='Created at'
              value={new Date(file.createdAt).toLocaleString()}
            />
            <FileStat
              Icon={IconRefresh}
              title='Updated at'
              value={new Date(file.updatedAt).toLocaleString()}
            />
            {file.deletesAt && !reduce && (
              <FileStat
                Icon={IconBombFilled}
                title='Deletes at'
                value={new Date(file.deletesAt).toLocaleString()}
              />
            )}
            <FileStat
              Icon={IconEyeFilled}
              title='Views'
              value={file.maxViews ? `${file.views} / ${file.maxViews}` : file.views}
            />
            {file.originalName && (
              <FileStat Icon={IconTextRecognition} title='Original Name' value={file.originalName} />
            )}
            {file.anonymous && <FileStat Icon={IconUserQuestion} title='Anonymous' value='Yes' />}
          </Stack>
        )}
      </Drawer>

      <Box className={classes.overlay} data-open={open ? 'true' : 'false'} onClick={() => setOpen(false)}>
        <Paper m={0} p={0} withBorder bdrs={0} style={{ borderTop: 0, borderLeft: 0, borderRight: 0 }}>
          <Group
            justify='space-between'
            align='flex-start'
            wrap='nowrap'
            gap='md'
            px='lg'
            py='sm'
            onClick={(e) => e.stopPropagation()}
            style={{ alignItems: 'center' }}
          >
            <Box style={{ minWidth: 0, flex: 1 }}>
              <Text size='lg' fw={600} lineClamp={1} c='white'>
                {file?.name ?? ''}
              </Text>
              {file && (
                <Text size='sm' c='dimmed' lineClamp={1}>
                  {file.type} ({bytes(file.size)})
                </Text>
              )}
            </Box>

            <ActionIcon.Group style={{ alignSelf: 'center' }}>
              {!reduce && file && (
                <>
                  <ActionButton
                    Icon={IconPencil}
                    onClick={() => setEditFileOpen(true)}
                    tooltip='Edit file details'
                    color='orange'
                  />
                  <ActionButton
                    Icon={IconTrashFilled}
                    onClick={() => deleteFile(warnDeletion, file, setOpen)}
                    tooltip='Delete file'
                    color='red'
                  />
                  <ActionButton
                    Icon={file.favorite ? IconStarFilled : IconStar}
                    onClick={() => favoriteFile(file)}
                    tooltip={file.favorite ? 'Unfavorite file' : 'Favorite file'}
                    color={file.favorite ? 'gray' : 'yellow'}
                  />
                </>
              )}
              {file && (
                <>
                  <ActionButton
                    Icon={IconInfoCircle}
                    onClick={() => setInfoOpen((v) => !v)}
                    tooltip={infoOpen ? 'Hide details' : 'Show details'}
                    color={infoOpen ? 'cyan' : 'gray'}
                  />
                  <ActionButton
                    Icon={IconExternalLink}
                    onClick={() => viewFile(file)}
                    tooltip='Open in new tab'
                    color='blue'
                  />
                  <ActionButton
                    Icon={IconClipboardTypography}
                    onClick={() => copyFile(file, clipboard, true)}
                    tooltip='Copy raw file link'
                  />
                  <ActionButton
                    Icon={IconCopy}
                    onClick={() => copyFile(file, clipboard)}
                    tooltip='Copy file link'
                  />
                  <ActionButton Icon={IconDownload} onClick={() => downloadFile(file)} tooltip='Download' />
                </>
              )}
            </ActionIcon.Group>
            <ActionButton Icon={IconX} tooltip='Close' onClick={() => setOpen(false)} />
          </Group>
        </Paper>

        <Box className={classes.content}>
          {file ? (
            <Box onClick={(e) => e.stopPropagation()}>
              <DashboardFileType key={file.id} file={file} show fullscreen allowZoom={false} />

              {sequenced && fileNavButtons && file && (
                <>
                  <ActionButton
                    Icon={IconChevronLeft}
                    tooltip='Previous file'
                    onClick={() => goPrev()}
                    disabled={!hasPrev}
                    style={{
                      position: 'fixed',
                      left: '1rem',
                      top: '50%',
                      zIndex: 1000,
                    }}
                    variant='filled'
                  />

                  <ActionButton
                    Icon={IconChevronRight}
                    tooltip='Next file'
                    onClick={() => goNext()}
                    disabled={!hasNext}
                    visibleFrom='sm'
                    style={{
                      position: 'fixed',
                      right: '1rem',
                      top: '50%',
                      zIndex: 1000,
                    }}
                    variant='filled'
                  />
                </>
              )}
            </Box>
          ) : null}
        </Box>
      </Box>
    </>
  );
}
