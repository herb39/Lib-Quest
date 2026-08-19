-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Library" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "isbn13" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "classNo" TEXT,
    "className" TEXT,
    "callNumber" TEXT,
    "shelfLocation" TEXT,
    "registeredAt" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "theme" TEXT,
    "estimatedMinutes" INTEGER,
    "difficulty" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestStep" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hint" TEXT,

    CONSTRAINT "QuestStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestCandidate" (
    "id" TEXT NOT NULL,
    "questStepId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "QuestCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestSession" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Library_code_key" ON "Library"("code");

-- CreateIndex
CREATE INDEX "Book_libraryId_idx" ON "Book"("libraryId");

-- CreateIndex
CREATE UNIQUE INDEX "Book_libraryId_isbn13_key" ON "Book"("libraryId", "isbn13");

-- CreateIndex
CREATE INDEX "Quest_libraryId_idx" ON "Quest"("libraryId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestStep_questId_order_key" ON "QuestStep"("questId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "QuestCandidate_questStepId_bookId_key" ON "QuestCandidate"("questStepId", "bookId");

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestStep" ADD CONSTRAINT "QuestStep_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestCandidate" ADD CONSTRAINT "QuestCandidate_questStepId_fkey" FOREIGN KEY ("questStepId") REFERENCES "QuestStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestCandidate" ADD CONSTRAINT "QuestCandidate_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestSession" ADD CONSTRAINT "QuestSession_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

