-- AlterTable: add s3Key to store the actual S3 object path (may differ from name when folder prefixes are used)
ALTER TABLE "public"."File" ADD COLUMN "s3Key" TEXT;
