import { createReadStream, existsSync } from 'fs';
import { access, constants, readdir, rename, rm, stat, writeFile } from 'fs/promises';
import { join } from 'path';
import { Readable } from 'stream';
import { Datasource } from './Datasource';

async function existsAndCanRW(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK | constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export class LocalDatasource extends Datasource {
  name = 'local';

  constructor(public dir: string) {
    super();
  }

  public get(file: string): Readable | null {
    const path = join(this.dir, file);
    if (!existsSync(path)) return null;

    const readStream = createReadStream(path);

    return readStream;
  }

  public async put(file: string, data: Buffer | string): Promise<void> {
    const path = join(this.dir, file);

    // handles if given a path to a file, it will just move it instead of doing unecessary writes
    if (typeof data === 'string') {
      const exists = await existsAndCanRW(data);
      if (!exists)
        throw new Error(
          "Something went very wrong! the temporary directory wasn't readable or the file doesn't exist.",
        );

      console.log(`Moving file from ${data} to ${path}`);
      return rename(data, path);
    }

    return writeFile(path, data);
  }

  public async delete(file: string): Promise<void> {
    const path = join(this.dir, file);
    if (!existsSync(path)) return Promise.resolve();

    return rm(path);
  }

  public async size(file: string): Promise<number> {
    const path = join(this.dir, file);
    if (!existsSync(path)) return 0;

    const { size } = await stat(path);

    return size;
  }

  public async totalSize(): Promise<number> {
    const files = await readdir(this.dir);
    const sizes = await Promise.all(files.map((file) => this.size(file)));

    return sizes.reduce((a, b) => a + b, 0);
  }

  public async clear(): Promise<void> {
    for (const file of await readdir(this.dir)) {
      await rm(join(this.dir, file));
    }
  }

  public async range(file: string, start: number, end: number): Promise<Readable> {
    const path = join(this.dir, file);
    const readStream = createReadStream(path, { start, end });

    return readStream;
  }
}
