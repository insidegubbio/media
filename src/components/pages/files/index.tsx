import GridTableSwitcher from '@/components/GridTableSwitcher';
import useObjectState from '@/lib/client/hooks/useObjectState';
import { useViewStore } from '@/lib/client/store/view';
import { ActionIcon, Group, Menu, Title, Tooltip } from '@mantine/core';
import {
  IconDots,
  IconFileDots,
  IconFileUpload,
  IconGridPatternFilled,
  IconTableOptions,
  IconTags,
} from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import PendingFilesModal from './PendingFilesModal';
import TagsModal from './tags/TagsModal';
import FavoriteFiles from './views/FavoriteFiles';
import Files from './views/FilesGridView';
import FileTable from './views/FilesTableView';

export type DashboardFilesModals = {
  table: boolean;
  idSearch: boolean;
  tags: boolean;
  pending: boolean;
};

export default function DashboardFiles() {
  const view = useViewStore((state) => state.files);

  const [modals, setModals] = useObjectState<DashboardFilesModals>({
    table: false,
    idSearch: false,
    tags: false,
    pending: false,
  });

  return (
    <>
      <TagsModal modals={modals} setModals={setModals} />
      <PendingFilesModal modals={modals} setModals={setModals} />

      <Group>
        <Title>Files</Title>

        <Tooltip label='Upload a file'>
          <Link to='/dashboard/upload/file'>
            <ActionIcon variant='outline'>
              <IconFileUpload size='1rem' />
            </ActionIcon>
          </Link>
        </Tooltip>

        <Menu>
          <Menu.Target>
            <Tooltip label='More actions'>
              <ActionIcon variant='outline'>
                <IconDots size='1rem' />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconTags size='1rem' />} onClick={() => setModals('tags', !modals.tags)}>
              Manage Tags
            </Menu.Item>
            <Menu.Item
              leftSection={<IconFileDots size='1rem' />}
              onClick={() => setModals('pending', !modals.pending)}
            >
              View Pending Files
            </Menu.Item>
            {view === 'table' && (
              <>
                <Menu.Label>Table Options</Menu.Label>
                <Menu.Item
                  leftSection={<IconGridPatternFilled size='1rem' />}
                  onClick={() => setModals('idSearch', !modals.idSearch)}
                >
                  Search by ID
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconTableOptions size='1rem' />}
                  onClick={() => setModals('table', !modals.table)}
                >
                  Table Options
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>

        <GridTableSwitcher type='files' />
      </Group>

      {view === 'grid' ? (
        <>
          <FavoriteFiles />

          <Files />
        </>
      ) : (
        <FileTable modals={modals} setModals={setModals} />
      )}
    </>
  );
}
