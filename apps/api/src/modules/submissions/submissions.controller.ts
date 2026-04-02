import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { CurrentUser, Roles } from "../auth/auth.decorators.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { SubmissionsService } from "./submissions.service.js";
import { CreateUploadBatchDto } from "./dto/create-upload-batch.dto.js";
import { CreateStudentSubmissionDto } from "./dto/create-student-submission.dto.js";

@Controller("uploads")
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Roles("professor")
  @Post()
  createUploadBatch(
    @Body() payload: CreateUploadBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.submissionsService.createUploadBatch(payload, user);
  }

  @Roles("professor")
  @Post("archive")
  async createProfessorArchiveUpload(
    @Req() request: FastifyRequest,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { archiveBuffer, fields, fileName } = await readMultipartArchiveRequest(request, [
      "assignmentId",
      "purpose",
    ]);

    return this.submissionsService.createProfessorArchiveUpload({
      assignmentId: fields.assignmentId,
      purpose: fields.purpose as CreateUploadBatchDto["purpose"],
      fileName,
      archiveBuffer,
      user,
    });
  }

  @Roles("student")
  @Post("student")
  createStudentSubmission(
    @Body() payload: CreateStudentSubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.submissionsService.createStudentSubmission(payload, user);
  }

  @Roles("student")
  @Post("student/archive")
  async createStudentSubmissionArchive(
    @Req() request: FastifyRequest,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { archiveBuffer, fields, fileName } = await readMultipartArchiveRequest(request, [
      "assignmentKey",
    ]);

    return this.submissionsService.createStudentSubmissionFromArchive({
      assignmentKey: fields.assignmentKey,
      fileName,
      archiveBuffer,
      user,
    });
  }

  @Roles("professor")
  @Get("assignment/:assignmentId/submissions/:submissionId/download")
  async downloadSubmissionArchive(
    @Param("assignmentId") assignmentId: string,
    @Param("submissionId") submissionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() reply: FastifyReply,
  ) {
    const result = await this.submissionsService.downloadSubmissionArchive(
      assignmentId,
      submissionId,
      user,
    );

    reply.header("Content-Type", "application/zip");
    reply.header("Content-Disposition", `attachment; filename="${result.fileName}"`);
    return reply.send(result.buffer);
  }

  @Roles("professor")
  @Get("assignment/:assignmentId/templates/:templateId/download")
  async downloadTemplateArchive(
    @Param("assignmentId") assignmentId: string,
    @Param("templateId") templateId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() reply: FastifyReply,
  ) {
    const result = await this.submissionsService.downloadTemplateArchive(
      assignmentId,
      templateId,
      user,
    );

    reply.header("Content-Type", "application/zip");
    reply.header("Content-Disposition", `attachment; filename="${result.fileName}"`);
    return reply.send(result.buffer);
  }

  @Roles("professor")
  @Get("assignment/:assignmentId/download")
  async downloadAllAssignmentSubmissionsArchive(
    @Param("assignmentId") assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() reply: FastifyReply,
  ) {
    const result = await this.submissionsService.downloadAllAssignmentSubmissionsArchive(
      assignmentId,
      user,
    );

    reply.header("Content-Type", "application/zip");
    reply.header("Content-Disposition", `attachment; filename="${result.fileName}"`);
    return reply.send(result.buffer);
  }

  @Roles("professor")
  @Get("assignment/:assignmentId/submissions/:submissionId")
  getSubmissionDetail(
    @Param("assignmentId") assignmentId: string,
    @Param("submissionId") submissionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.submissionsService.getSubmissionDetail(assignmentId, submissionId, user);
  }

  @Roles("professor")
  @Get("assignment/:assignmentId/templates/:templateId")
  getTemplateDetail(
    @Param("assignmentId") assignmentId: string,
    @Param("templateId") templateId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.submissionsService.getTemplateDetail(assignmentId, templateId, user);
  }

  @Get(":uploadBatchId")
  getUploadBatch(
    @Param("uploadBatchId") uploadBatchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.submissionsService.getUploadBatch(uploadBatchId, user);
  }
}

async function readMultipartArchiveRequest(
  request: FastifyRequest,
  requiredFieldNames: string[],
) {
  const fields: Record<string, string> = {};
  let archiveBuffer: Buffer | undefined;
  let fileName = "upload.zip";

  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (archiveBuffer) {
        throw new BadRequestException("only one archive file is allowed per request");
      }

      archiveBuffer = await part.toBuffer();
      fileName = part.filename || fileName;
      continue;
    }

    fields[part.fieldname] = String(part.value ?? "");
  }

  if (!archiveBuffer) {
    throw new BadRequestException("zip archive file is required");
  }

  return {
    archiveBuffer,
    fileName,
    fields: validateRequiredFields(fields, requiredFieldNames),
  };
}

function validateRequiredFields(fields: Record<string, string>, requiredFieldNames: string[]) {
  for (const fieldName of requiredFieldNames) {
    if (!fields[fieldName]) {
      throw new BadRequestException(`multipart field "${fieldName}" is required`);
    }
  }

  return fields as Record<string, string> & {
    assignmentId: string;
    purpose: string;
    assignmentKey: string;
  };
}
