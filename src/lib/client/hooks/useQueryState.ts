import { useSearchParams } from 'react-router-dom';

function parseValue<T>(value: string | null, defaultValue: T): T {
  if (value === null) return defaultValue;

  if (typeof defaultValue === 'number') {
    const parsed = Number(value);
    return isNaN(parsed) ? defaultValue : (parsed as T);
  }

  if (typeof defaultValue === 'boolean') {
    return (value === 'true') as T;
  }

  return value as T;
}

export function useQueryState<T>(key: string, defaultValue: T): [T, (value: T | null) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawValue = searchParams.get(key);
  const value: T = parseValue(rawValue, defaultValue);

  const setValue = (newValue: T | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newValue === null) {
        next.delete(key);
      } else {
        next.set(key, String(newValue));
      }
      return next;
    });
  };

  return [value, setValue];
}
