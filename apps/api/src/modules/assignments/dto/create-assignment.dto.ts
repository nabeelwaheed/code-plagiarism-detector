import type { AssignmentLanguage } from "@similarity/shared";

export class CreateAssignmentDto {
  title!: string;
  language!: AssignmentLanguage;
}
