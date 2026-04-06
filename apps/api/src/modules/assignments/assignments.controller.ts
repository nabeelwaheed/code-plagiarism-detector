import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { AssignmentsService } from "./assignments.service.js";
import { CreateAssignmentDto } from "./dto/create-assignment.dto.js";
import { UpdateAssignmentDueDateDto } from "./dto/update-assignment-due-date.dto.js";
import { CurrentUser, Roles } from "../auth/auth.decorators.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";

@Roles("professor")
@Controller("assignments")
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  createAssignment(
    @Body() payload: CreateAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentsService.createAssignment(payload, user);
  }

  @Get()
  listAssignments(@CurrentUser() user: AuthenticatedUser) {
    return this.assignmentsService.listAssignments(user);
  }

  @Get(":assignmentId")
  getAssignment(
    @Param("assignmentId") assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentsService.getAssignment(assignmentId, user);
  }

  @Delete(":assignmentId")
  deleteAssignment(
    @Param("assignmentId") assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentsService.deleteAssignment(assignmentId, user);
  }

  @Patch(":assignmentId/due-date")
  updateAssignmentDueDate(
    @Param("assignmentId") assignmentId: string,
    @Body() payload: UpdateAssignmentDueDateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.assignmentsService.updateAssignmentDueDate(assignmentId, payload, user);
  }
}
