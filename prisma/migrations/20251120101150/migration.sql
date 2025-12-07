/*
  Warnings:

  - You are about to drop the column `discordId` on the `member_roles` table. All the data in the column will be lost.
  - You are about to drop the column `discordId` on the `project_members` table. All the data in the column will be lost.
  - You are about to alter the column `permissionLevel` on the `projects` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(1))`.
  - You are about to drop the column `hierarchyLevel` on the `roles` table. All the data in the column will be lost.
  - Added the required column `position` to the `roles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `member_roles` DROP COLUMN `discordId`;

-- AlterTable
ALTER TABLE `project_members` DROP COLUMN `discordId`;

-- AlterTable
ALTER TABLE `projects` MODIFY `permissionLevel` ENUM('LOW', 'MEDIUM', 'HIGH', 'ADMIN') NOT NULL;

-- AlterTable
ALTER TABLE `roles` DROP COLUMN `hierarchyLevel`,
    ADD COLUMN `position` INTEGER NOT NULL;
