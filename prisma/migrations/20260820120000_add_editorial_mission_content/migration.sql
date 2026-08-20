-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'REVIEW_NEEDED', 'APPROVED');

-- CreateTable
CREATE TABLE "BookEditorial" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "hook" TEXT,
    "teaser" TEXT,
    "question" TEXT,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookEditorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionContent" (
    "id" TEXT NOT NULL,
    "questStepId" TEXT NOT NULL,
    "missionTitle" TEXT,
    "missionNarrative" TEXT,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookEditorial_bookId_key" ON "BookEditorial"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "MissionContent_questStepId_key" ON "MissionContent"("questStepId");

-- AddForeignKey
ALTER TABLE "BookEditorial" ADD CONSTRAINT "BookEditorial_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionContent" ADD CONSTRAINT "MissionContent_questStepId_fkey" FOREIGN KEY ("questStepId") REFERENCES "QuestStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

