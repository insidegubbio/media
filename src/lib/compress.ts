import sharp from 'sharp';

export function compressFile(filePath: string, quality: number) {
  const buffer = sharp(filePath).withMetadata().jpeg({ quality: quality }).toBuffer();

  return buffer.then((data) => {
    return sharp(data).toFile(filePath);
  });
}

export function replaceFileNameJpg(original: string, when?: boolean) {
  return when ? original.replace(/\.[a-zA-Z0-9]+$/, '.jpg') : original;
}
