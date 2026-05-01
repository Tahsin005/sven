-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'COMPLETED');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "sources" JSONB,
ADD COLUMN     "status" "MessageStatus" NOT NULL DEFAULT 'COMPLETED';
