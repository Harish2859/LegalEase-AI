/*
  Warnings:

  - You are about to drop the column `metadata` on the `Chunk` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Document` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sha256Hash]` on the table `Document` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `chunkType` to the `Chunk` table without a default value. This is not possible if the table is not empty.
  - Added the required column `filename` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pageCount` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sha256Hash` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Chunk" DROP CONSTRAINT "Chunk_documentId_fkey";

-- AlterTable
ALTER TABLE "Chunk" DROP COLUMN "metadata",
ADD COLUMN     "chunkType" TEXT NOT NULL,
ADD COLUMN     "parentChunkId" TEXT,
ADD COLUMN     "sectionTitle" TEXT,
ALTER COLUMN "pageStart" DROP NOT NULL,
ALTER COLUMN "pageStart" DROP DEFAULT,
ALTER COLUMN "charOffsetStart" DROP NOT NULL,
ALTER COLUMN "charOffsetStart" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "name",
ADD COLUMN     "filename" TEXT NOT NULL,
ADD COLUMN     "pageCount" INTEGER NOT NULL,
ADD COLUMN     "sha256Hash" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Document_sha256Hash_key" ON "Document"("sha256Hash");

-- AddForeignKey
ALTER TABLE "Chunk" ADD CONSTRAINT "Chunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chunk" ADD CONSTRAINT "Chunk_parentChunkId_fkey" FOREIGN KEY ("parentChunkId") REFERENCES "Chunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
