import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { AssignmentsService } from "./assignments.service.js";
import { CreateAssignmentDto } from "./dto/create-assignment.dto.js";
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
}
