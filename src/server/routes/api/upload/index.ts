import { bytes } from '@/lib/bytes';
import { compressFile } from '@/lib/compress';
import { config } from '@/lib/config';
import { hashPassword } from '@/lib/crypto';
import { datasource } from '@/lib/datasource';
import { prisma } from '@/lib/db';
import { fileSelect } from '@/lib/db/models/file';
import { removeGps } from '@/lib/gps';
import { log } from '@/lib/logger';
import { guess } from '@/lib/mimes';
import { formatFileName } from '@/lib/uploader/formatFileName';
import { UploadHeaders, parseHeaders } from '@/lib/uploader/parseHeaders';
import { onUpload } from '@/lib/webhooks';
import { userMiddleware } from '@/server/middleware/user';
import fastifyPlugin from 'fastify-plugin';
import { stat } from 'fs/promises';
import { extname } from 'path';

const commonDoubleExts = [
  '.tar.gz',
  '.tar.xz',
  '.tar.bz2',
  '.tar.lz',
  '.tar.lzma',
  '.tar.Z',
  '.tar.7z',
  '.zip.gz',
  '.zip.xz',
  '.rar.gz',
  '.log.gz',
  '.csv.gz',
  '.pdf.gz',
  // feel free to PR more
];

export const getExtension = (filename: string, override?: string): string => {
  return override ?? commonDoubleExts.find((ext) => filename.endsWith(ext)) ?? extname(filename);
};

export type ApiUploadResponse = {
  files: {
    id: string;
    type: string;
    url: string;
    pending?: boolean;
  }[];

  deletesAt?: string;
  assumedMimetypes?: boolean[];
};

const logger = log('api').c('upload');

export const PATH = '/api/upload';
export default fastifyPlugin(
  (server, _, done) => {
    const rateLimit = server.rateLimit
      ? server.rateLimit()
      : (_req: any, _res: any, next: () => any) => next();

    server.post<{
      Headers: UploadHeaders;
    }>(PATH, { preHandler: [userMiddleware, rateLimit] }, async (req, res) => {
      const options = parseHeaders(req.headers, config.files);
      if (options.header) return res.badRequest('bad options, receieved: ' + JSON.stringify(options));

      if (options.folder) {
        const folder = await prisma.folder.findFirst({
          where: {
            id: options.folder,
          },
        });
        if (!folder) return res.badRequest('folder not found');
        if (!req.user && !folder.allowUploads) return res.forbidden('folder is not open');
      }

      const files = await req.saveRequestFiles({ tmpdir: config.core.tempDirectory });

      if (req.user?.quota) {
        const totalFileSize = files.reduce((acc, x) => acc + x.file.bytesRead, 0);

        const userAggregateStats = await prisma.file.aggregate({
          where: {
            userId: req.user.id,
          },
          _sum: {
            size: true,
          },
          _count: {
            _all: true,
          },
        });
        const aggSize: bigint =
          userAggregateStats!._sum?.size === null
            ? 0n
            : (userAggregateStats!._sum?.size as unknown as bigint);
        if (
          req.user.quota.filesQuota === 'BY_BYTES' &&
          Number(aggSize) + totalFileSize > bytes(req.user.quota.maxBytes!)
        )
          return res.payloadTooLarge(
            `uploading will exceed your storage quota of ${bytes(req.user.quota.maxBytes!)} bytes`,
          );

        if (
          req.user.quota.filesQuota === 'BY_FILES' &&
          userAggregateStats!._count?._all + req.files.length > req.user.quota.maxFiles!
        )
          return res.payloadTooLarge(
            `uploading will exceed your file count quota of ${req.user.quota.maxFiles} files`,
          );
      }

      const response: ApiUploadResponse = {
        files: [],
        ...(options.deletesAt && {
          deletesAt: options.deletesAt === 'never' ? 'never' : options.deletesAt.toISOString(),
        }),
        ...(config.files.assumeMimetypes && { assumedMimetypes: Array(req.files.length) }),
      };

      let domain;
      if (options.overrides?.returnDomain) {
        domain = `${config.core.returnHttpsUrls ? 'https' : 'http'}://${options.overrides.returnDomain}`;
      } else if (config.core.defaultDomain) {
        domain = `${config.core.returnHttpsUrls ? 'https' : 'http'}://${config.core.defaultDomain}`;
      } else {
        domain = `${config.core.returnHttpsUrls ? 'https' : 'http'}://${req.headers.host}`;
      }

      console.log(files);

      logger.debug('uploading files', { files: files.map((x) => x.filename) });

      for (let i = 0; i !== files.length; ++i) {
        const file = files[i];
        const extension = getExtension(file.filename, options.overrides?.extension);

        if (config.files.disabledExtensions.includes(extension))
          return res.badRequest(`File extension ${extension} is not allowed`);

        if (file.file.bytesRead > bytes(config.files.maxFileSize))
          return res.payloadTooLarge(
            `File size is too large. Maximum file size is ${bytes(config.files.maxFileSize)} bytes`,
          );

        // determine filename
        const format = options.format || config.files.defaultFormat;
        let fileName = formatFileName(format, file.filename);

        if (options.overrides?.filename || format === 'name') {
          if (options.overrides?.filename) fileName = decodeURIComponent(options.overrides!.filename!);
          const fullFileName = `${fileName}${extension}`;

          const existing = await prisma.file.findFirst({
            where: {
              name: fullFileName,
            },
          });
          if (existing) return res.badRequest(`A file with the name "${fullFileName}" already exists`);
        }

        // determine mimetype
        let mimetype = file.mimetype;
        if (mimetype === 'application/octet-stream' && config.files.assumeMimetypes) {
          const mime = await guess(extension.substring(1));

          if (!mime) response.assumedMimetypes![i] = false;
          else {
            response.assumedMimetypes![i] = true;
            mimetype = mime;
          }
        }

        // determine folder
        let folder = null;
        if (options.folder) {
          folder = await prisma.folder.findFirst({
            where: {
              id: options.folder,
            },
          });

          if (!folder) return res.badRequest('Folder does not exist');
          if (!req.user && !folder.allowUploads) return res.forbidden('Folder is not open');
        }

        // compress the image if requested
        let compressed = false;
        if (mimetype.startsWith('image/') && options.imageCompressionPercent) {
          await compressFile(file.filepath, options.imageCompressionPercent);

          logger.c('jpg').debug(`compressed file ${file.filename}`);

          compressed = true;
        }

        // remove gps metadata if requested
        let removedGps = false;
        if (mimetype.startsWith('image/') && config.files.removeGpsMetadata) {
          const removed = removeGps(file.filepath);

          if (removed) {
            logger.c('gps').debug(`removed gps metadata from ${file.filename}`, {
              nsize: bytes(file.file.bytesRead),
            });
          }

          removedGps = true;
        }

        const tempFileStats = await stat(file.filepath);

        const fileUpload = await prisma.file.create({
          data: {
            name: `${fileName}${compressed ? '.jpg' : extension}`,
            size: tempFileStats.size,
            type: compressed ? 'image/jpeg' : mimetype,
            User: {
              connect: {
                id: req.user ? req.user.id : options.folder ? folder?.userId : undefined,
              },
            },
            ...(options.maxViews && { maxViews: options.maxViews }),
            ...(options.password && { password: await hashPassword(options.password) }),
            ...(options.deletesAt && options.deletesAt !== 'never'
              ? { deletesAt: options.deletesAt }
              : { deletesAt: null }),
            ...(options.folder && { Folder: { connect: { id: options.folder } } }),
            ...(options.addOriginalName && { originalName: file.filename }),
          },
          select: fileSelect,
        });

        await datasource.put(fileUpload.name, file.filepath, {
          mimetype: fileUpload.type,
        });

        const responseUrl = `${domain}${
          config.files.route === '/' || config.files.route === '' ? '' : `${config.files.route}`
        }/${fileUpload.name}`;

        response.files.push({
          id: fileUpload.id,
          type: fileUpload.type,
          url: encodeURI(responseUrl),

          ...(removedGps && { removedGps: true }),
          ...(compressed && { compressed: true }),
        });

        logger.info(
          `${req.user ? req.user.username : '[anonymous folder upload]'} uploaded ${fileUpload.name}`,
          {
            size: bytes(fileUpload.size),
            ip: req.ip,
          },
        );

        await onUpload({
          user: req.user ?? {
            id: 'anonymous',
            username: 'anonymous',
            createdAt: new Date(),
            updatedAt: new Date(),
            role: 'USER',
          },
          file: fileUpload,
          link: {
            raw: `${domain}/raw/${encodeURIComponent(fileUpload.name)}`,
            returned: encodeURI(responseUrl),
          },
        });
      }

      if (options.noJson)
        return res
          .status(200)
          .type('text/plain')
          .send(response.files.map((x) => x.url).join(','));

      return res.send(response);
    });

    done();
  },
  { name: PATH },
);
