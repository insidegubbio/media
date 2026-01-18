import { type Response } from '@/lib/api/response';
import { useTitle } from '@/lib/hooks/useTitle';
import { ActionIcon, Container, Group, SimpleGrid, Skeleton, Title } from '@mantine/core';
import { IconUpload } from '@tabler/icons-react';
import { lazy, Suspense } from 'react';
import { Link, Params, useLoaderData } from 'react-router-dom';

const DashboardFile = lazy(() => import('@/components/file/DashboardFile'));

export async function loader({ params }: { params: Params<string> }) {
  const res = await fetch(`/api/server/folder/${params.id}`);
  if (!res.ok) {
    throw new Response('Folder not found', { status: 404 });
  }
  return {
    folder: (await res.json()) as Response['/api/server/folder/[id]'],
  };
}

export function Component() {
  const { folder } = useLoaderData<typeof loader>();

  useTitle(folder.name ?? '');

  return (
    <>
      <Container my='lg'>
        <Group>
          <Title order={1}>{folder.name}</Title>

          {folder.allowUploads && (
            <Link to={`/folder/${folder.id}/upload`}>
              <ActionIcon variant='outline'>
                <IconUpload size='1rem' />
              </ActionIcon>
            </Link>
          )}
        </Group>

        <SimpleGrid
          my='sm'
          cols={{
            base: 1,
            lg: 3,
            md: 2,
          }}
          spacing='md'
        >
          {folder.files?.map((file: any) => (
            <Suspense fallback={<Skeleton height={350} animate />} key={file.id}>
              <DashboardFile file={file} reduce />
            </Suspense>
          ))}
        </SimpleGrid>
      </Container>
    </>
  );
}

Component.displayName = 'ViewFolderId';
