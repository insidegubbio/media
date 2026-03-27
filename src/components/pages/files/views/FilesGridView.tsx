import { useQueryState } from '@/lib/client/hooks/useQueryState';
import {
  Button,
  Center,
  Group,
  Pagination,
  Paper,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconFilesOff, IconFileUpload } from '@tabler/icons-react';
import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiPagination } from '../useApiPagination';

const DashboardFile = lazy(() => import('@/components/file/DashboardFile'));

const PER_PAGE_OPTIONS = [9, 12, 15, 30, 45];

export default function Files({ id, folderId }: { id?: string; folderId?: string }) {
  const [page, setPage] = useQueryState('page', 1);
  const [perpage, setPerpage] = useState(15);

  const { data, isLoading } = useApiPagination({
    page,
    perpage,
    id,
    folderId,
  });

  const from = (page - 1) * perpage + 1;
  const to = Math.min(page * perpage, data?.total ?? 0);
  const totalRecords = data?.total ?? 0;
  const cachedPages = data?.pages ?? 1;

  return (
    <>
      <SimpleGrid
        my='sm'
        cols={{
          base: 1,
          md: 2,
          lg: (data?.page.length ?? 0 > 0) || isLoading ? 3 : 1,
        }}
        spacing='md'
        pos='relative'
      >
        {isLoading ? (
          [...Array(9)].map((_, i) => <Skeleton key={i} height={350} animate />)
        ) : (data?.page?.length ?? 0 > 0) ? (
          data?.page.map((file) => (
            <Suspense fallback={<Skeleton height={350} animate />} key={file.id}>
              <DashboardFile file={file} id={id} />
            </Suspense>
          ))
        ) : (
          <Paper withBorder p='sm'>
            <Center>
              <Stack>
                <Group>
                  <IconFilesOff size='2rem' />
                  <Title order={2}>No files found</Title>
                </Group>
                {!id && (
                  <Button
                    variant='outline'
                    size='compact-sm'
                    leftSection={<IconFileUpload size='1rem' />}
                    component={Link}
                    to='/dashboard/upload/file'
                  >
                    Upload a file
                  </Button>
                )}
              </Stack>
            </Center>
          </Paper>
        )}
      </SimpleGrid>

      <Group justify='space-between' align='center' mt='md'>
        <Text size='sm'>{`${from} - ${to} / ${totalRecords} files`}</Text>

        <Group gap='sm'>
          <Select
            value={perpage.toString()}
            data={PER_PAGE_OPTIONS.map((val) => ({ value: val.toString(), label: `${val}` }))}
            onChange={(value) => {
              setPerpage(Number(value));
              setPage(1);
            }}
            w={80}
            size='xs'
            variant='filled'
          />

          <Pagination value={page} onChange={setPage} total={cachedPages} size='sm' withControls withEdges />
        </Group>
      </Group>
    </>
  );
}
