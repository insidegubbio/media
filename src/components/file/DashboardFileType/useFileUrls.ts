import { useUserStore } from '@/lib/client/store/user';
import type { File as DbFile } from '@/lib/db/models/file';
import { useEffect, useMemo, useState } from 'react';

export function appendPassword(url: string, password?: string | null) {
  return `${url}${password ? `?pw=${encodeURIComponent(password)}` : ''}`;
}

export function isDbFile(file: DbFile | File): file is DbFile {
  return typeof globalThis.File !== 'undefined' ? !(file instanceof globalThis.File) : 'thumbnail' in file;
}

export default function useFileUrls({ file, password }: { file: DbFile | File; password?: string | null }): {
  fileUrl: string;
  thumbnailUrl: string | null;
  viewUrl: string | null;
} {
  const user = useUserStore((state) => state.user);
  const dbFile = isDbFile(file);

  const [blobUrl, setBlobUrl] = useState('');

  useEffect(() => {
    if (dbFile) return setBlobUrl('');

    const objectUrl = URL.createObjectURL(file as File);
    setBlobUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [dbFile, file]);

  const fileUrl = useMemo(() => {
    if (!dbFile) return blobUrl;

    const fileRoute = user ? `/api/user/files/${file.id}/raw` : `/raw/${file.name}`;
    return appendPassword(fileRoute, password);
  }, [blobUrl, dbFile, file, password, user]);

  const thumbnailUrl = useMemo(() => {
    if (!dbFile) return null;
    if (!file.thumbnail?.path) return null;
    return user ? `/api/user/files/${file.thumbnail.path}/raw` : `/raw/${file.thumbnail.path}`;
  }, [dbFile, file, user]);

  const viewUrl = useMemo(() => {
    if (!dbFile) return null;
    return appendPassword(`/view/${file.name}`, password);
  }, [dbFile, file]);

  return { fileUrl, thumbnailUrl, viewUrl };
}
