import { type Response } from '@/lib/api/response';
import { useQueryState } from '@/lib/client/hooks/useQueryState';
import { useTitle } from '@/lib/client/hooks/useTitle';
import { useFileNavStore } from '@/lib/client/store/fileNav';
import { Folder } from '@/lib/db/models/folder';
import { FolderBreadcrumb } from '@/lib/folderHierarchy';
import {
  ActionIcon,
  Anchor,
  Breadcrumbs,
  Card,
  Container,
  Group,
  Pagination,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconFolder, IconUpload } from '@tabler/icons-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, Params, useLoaderData, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';

const DashboardFile = lazy(() => import('@/components/file/DashboardFile'));
const DashboardFileModal = lazy(() => import('@/components/file/DashboardFile/DashboardFileModal'));

export async function loader({ params }: { params: Params<string> }) {
  const res = await fetch(`/api/server/folder/${params.id}`);
  if (!res.ok) {
    throw new Response('Folder not found', { status: 404 });
  }
  return {
    folder: (await res.json()) as Response['/api/server/folder/[id]'],
  };
}

function PublicFolderCard({ folder }: { folder: Partial<Folder> }) {
  return (
    <Link to={`/folder/${folder.id}`} style={{ textDecoration: 'none' }}>
      <Card withBorder shadow='sm' radius='sm' style={{ cursor: 'pointer' }}>
        <Card.Section withBorder inheritPadding py='xs'>
          <Group gap='xs'>
            <IconFolder size='1.2rem' />
            <Text fw={500}>{folder.name}</Text>
          </Group>
        </Card.Section>
        <Card.Section inheritPadding py='xs'>
          <Stack gap={2}>
            <Text size='xs' c='dimmed'>
              {folder._count?.files ?? 0} files
            </Text>
            {(folder._count?.children ?? 0) > 0 && (
              <Text size='xs' c='dimmed'>
                {folder._count?.children} subfolders
              </Text>
            )}
          </Stack>
        </Card.Section>
      </Card>
    </Link>
  );
}

const PER_PAGE_OPTIONS = [9, 12, 15, 30, 45];

export function Component() {
  const { folder } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  useTitle(folder.name);

  const buildBreadcrumbs = () => {
    const items: FolderBreadcrumb[] = [];

    let current = folder.parent as Partial<Folder> | undefined;
    while (current && current.public) {
      items.unshift({ id: current.id!, name: current.name!, public: true });
      current = current.parent as Partial<Folder> | undefined;
    }

    items.push({ id: folder.id!, name: folder.name!, public: true });

    return items;
  };

  const breadcrumbs = buildBreadcrumbs();
  const children = (folder.children ?? []) as Partial<Folder>[];

  const [perpage, setPerpage] = useState(15);
  const [page, setPage] = useQueryState('page', 1);

  const from = (page - 1) * perpage + 1;
  const to = Math.min(page * perpage, folder.files?.length ?? 0);
  const totalRecords = folder.files?.length ?? 0;
  const cachedPages = Math.ceil(totalRecords / perpage);

  const visible = useMemo(() => {
    if (!folder.files) return [];

    const start = (page - 1) * perpage;
    return folder.files.slice(start, start + perpage);
  }, [folder.files, page, perpage]);

  const [current, setCurrent, setFiles] = useFileNavStore(
    useShallow((state) => [state.current, state.setCurrent, state.setFiles]),
  );
  const currentFile = current ? (visible.find((file) => file.id === current) ?? null) : null;
  const ids = useMemo(() => visible.map((file) => file.id), [visible]);

  useEffect(() => {
    setFiles(ids);
  }, [ids]);

  return (
    <>
      <Container my='lg'>
        <DashboardFileModal
          open={!!currentFile}
          setOpen={(open) => setCurrent(open ? (currentFile?.id ?? null) : null)}
          file={currentFile}
          reduce
          sequenced
        />

        {breadcrumbs.length > 1 && (
          <Breadcrumbs mb='md'>
            {breadcrumbs.map((item, index) => (
              <Anchor
                key={item.id}
                onClick={() => navigate(`/folder/${item.id}`)}
                style={{ cursor: 'pointer' }}
                fw={index === breadcrumbs.length - 1 ? 600 : 400}
              >
                {item.name}
              </Anchor>
            ))}
          </Breadcrumbs>
        )}

        <Group>
          <Title order={1}>{folder.name}</Title>

          {folder.allowUploads && (
            <Link to={`/folder/${folder.id}/upload`} reloadDocument>
              <ActionIcon variant='outline'>
                <IconUpload size='1rem' />
              </ActionIcon>
            </Link>
          )}
        </Group>

        {children.length > 0 && (
          <>
            <Title order={3} mt='md' mb='sm'>
              Subfolders
            </Title>
            <SimpleGrid
              cols={{
                base: 1,
                lg: 4,
                md: 3,
                sm: 2,
              }}
              spacing='md'
            >
              {children.map((child) => (
                <PublicFolderCard key={child.id} folder={child} />
              ))}
            </SimpleGrid>
          </>
        )}

        {(visible.length ?? 0) > 0 && (
          <>
            <Title order={3} mt='md' mb='sm'>
              Files
            </Title>
            <SimpleGrid
              cols={{
                base: 1,
                lg: 3,
                md: 2,
              }}
              spacing='md'
            >
              {visible.map((file: any) => (
                <Suspense fallback={<Skeleton height={350} animate />} key={file.id}>
                  <DashboardFile file={file} reduce onOpen={(fileId) => setCurrent(fileId)} />
                </Suspense>
              ))}
            </SimpleGrid>
          </>
        )}

        {children.length === 0 && (folder.files?.length ?? 0) === 0 && (
          <Text c='dimmed' mt='md'>
            This folder is empty.
          </Text>
        )}

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

            <Pagination
              value={page}
              onChange={setPage}
              total={cachedPages}
              size='sm'
              withControls
              withEdges
            />
          </Group>
        </Group>
      </Container>
    </>
  );
}

Component.displayName = 'ViewFolderId';
