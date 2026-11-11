-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");
