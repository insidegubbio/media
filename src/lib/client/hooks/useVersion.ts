import useSWR from 'swr';
import { Response } from '../../api/response';
const f = async () => {
  const res = await fetch('/api/version');
  if (!res.ok) throw new Error('Failed to fetch version');

  const r = await res.json();
  return r;
};

export default function useVersion() {
  const { isLoading, data } = useSWR<Response['/api/version'], Error>('/api/version', f, {
    refreshInterval: undefined,
    revalidateOnFocus: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
    revalidateOnReconnect: false,
  });

  return { version: data?.data, isLoading };
}
