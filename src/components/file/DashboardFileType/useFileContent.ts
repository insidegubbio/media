import type { File as DbFile } from '@/lib/db/models/file';
import { useCallback, useEffect, useState } from 'react';
import { isDbFile } from './useFileUrls';

const MAX_BYTES = 1 * 1024 * 1024;
const FILE_BIG = '\n...\nThe file is too big to display click the download icon to view/download it.';

export default function useFileContent({
  enabled,
  file,
  fileUrl,
}: {
  enabled: boolean;
  file: DbFile | File;
  fileUrl: string;
}) {
  const [content, setContent] = useState('');

  const loadText = useCallback(async () => {
    try {
      if (!isDbFile(file)) {
        const reader = new FileReader();
        reader.onload = () => {
          const raw = reader.result as string;
          setContent(raw.length > MAX_BYTES ? raw.slice(0, MAX_BYTES) + FILE_BIG : raw);
        };
        reader.readAsText(file as File);
        return;
      }

      if (file.size > MAX_BYTES) {
        const res = await fetch(fileUrl, { headers: { Range: `bytes=0-${MAX_BYTES}` } });
        if (!res.ok) throw new Error('Failed to fetch file');
        const text = await res.text();
        setContent(text + FILE_BIG);
        return;
      }

      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error('Failed to fetch file');
      const text = await res.text();
      setContent(text);
    } catch {
      setContent('Error loading file.');
    }
  }, [file, fileUrl]);

  useEffect(() => {
    if (!enabled) return;
    loadText();
  }, [enabled, loadText]);

  return content;
}

