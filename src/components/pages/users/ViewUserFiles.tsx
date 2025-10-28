import { type loader } from '@/client/pages/dashboard/admin/users/[id]/files';
import GridTableSwitcher from '@/components/GridTableSwitcher';
import { useViewStore } from '@/lib/store/view';
import { ActionIcon, Group, Title, Tooltip } from '@mantine/core';
import { IconArrowBackUp, IconGridPatternFilled, IconTableOptions } from '@tabler/icons-react';
import { Link, useLoaderData } from 'react-router-dom';
import FileTable from '../files/views/FileTable';
import Files from '../files/views/Files';
import { useState } from 'react';

export default function ViewUserFiles() {
  const data = useLoaderData<typeof loader>();
  if (!data) return null;

  const { user } = data;
  if (!user) return null;

  const view = useViewStore((state) => state.files);

  const [tableEditOpen, setTableEditOpen] = useState(false);
  const [idSearchOpen, setIdSearchOpen] = useState(false);

  return (
    <>
      <Group>
        <Title>{user.username}&apos;s files</Title>
        <Tooltip label='Back to users'>
          <ActionIcon variant='outline' component={Link} to='/dashboard/admin/users'>
            <IconArrowBackUp size='1rem' />
          </ActionIcon>
        </Tooltip>

        <Tooltip label='Table Options'>
          <ActionIcon variant='outline' onClick={() => setTableEditOpen((open) => !open)}>
            <IconTableOptions size='1rem' />
          </ActionIcon>
        </Tooltip>

        <Tooltip label='Search by ID'>
          <ActionIcon
            variant='outline'
            onClick={() => {
              setIdSearchOpen((open) => !open);
            }}
          >
            <IconGridPatternFilled size='1rem' />
          </ActionIcon>
        </Tooltip>

        <GridTableSwitcher type='files' />
      </Group>

      {view === 'grid' ? (
        <Files id={user.id} />
      ) : (
        <FileTable
          id={user.id}
          tableEdit={{
            open: tableEditOpen,
            setOpen: setTableEditOpen,
          }}
          idSearch={{
            open: idSearchOpen,
            setOpen: setIdSearchOpen,
          }}
        />
      )}
    </>
  );
}
