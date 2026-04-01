import type { UploadPurpose } from "@similarity/shared";

export class CreateUploadBatchDto {
  assignmentId!: string;
  purpose!: UploadPurpose;
  objectKey!: string;
}
