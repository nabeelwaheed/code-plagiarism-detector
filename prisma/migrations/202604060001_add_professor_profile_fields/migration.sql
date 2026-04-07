-- AlterTable: add optional profile fields to User
ALTER TABLE "User" ADD COLUMN "firstName"  TEXT;
ALTER TABLE "User" ADD COLUMN "lastName"   TEXT;
ALTER TABLE "User" ADD COLUMN "title"      TEXT;
ALTER TABLE "User" ADD COLUMN "department" TEXT;
