-- CreateTable
CREATE TABLE "MonthlyMock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "solved" INTEGER NOT NULL,
    "hinted" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,

    CONSTRAINT "MonthlyMock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyMock_sessionId_key" ON "MonthlyMock"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyMock_userId_period_key" ON "MonthlyMock"("userId", "period");

-- AddForeignKey
ALTER TABLE "MonthlyMock" ADD CONSTRAINT "MonthlyMock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

