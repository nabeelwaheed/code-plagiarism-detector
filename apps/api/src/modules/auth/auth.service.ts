import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  assertProfessorHasNoActiveAssignmentJobs,
  collectAssignmentObjectKeys,
  deleteAssignmentOwnedData,
  deleteObjectKeysBestEffort,
} from "../assignments/assignment-maintenance.js";
import { ChangePasswordDto } from "./dto/change-password.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { ProfessorSignupDto } from "./dto/professor-signup.dto.js";
import { hashPassword, verifyPassword } from "./password.service.js";
import { SessionService } from "./session.service.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  async login(payload: LoginDto) {
    const normalizedEmail = normalizeEmail(payload.email);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, passwordHash: true, role: true },
    });

    if (!user || !(await verifyPassword(payload.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const session = await this.sessionService.createSession(user.id);

    return {
      userId: user.id,
      email: user.email,
      role: user.role.toLowerCase(),
      session,
    };
  }

  async signupProfessor(payload: ProfessorSignupDto) {
    const normalizedEmail = normalizeEmail(payload.email);
    const password = payload.password.trim();

    if (!normalizedEmail) {
      throw new BadRequestException("Email is required");
    }

    if (password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters");
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException("An account with that email already exists");
    }

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: await hashPassword(password),
        role: "PROFESSOR",
      },
      select: { id: true, email: true, role: true },
    });

    const session = await this.sessionService.createSession(user.id);

    return {
      userId: user.id,
      email: user.email,
      role: user.role.toLowerCase(),
      session,
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    return {
      userId: user.id,
      email: user.email,
      role: user.role.toLowerCase(),
    };
  }

  async changePassword(userId: string, payload: ChangePasswordDto) {
    const currentPassword = payload.currentPassword.trim();
    const newPassword = payload.newPassword.trim();

    if (!currentPassword) {
      throw new BadRequestException("Current password is required");
    }

    if (newPassword.length < 8) {
      throw new BadRequestException("New password must be at least 8 characters");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new UnauthorizedException("That account is no longer available");
    }

    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new BadRequestException("Current password is incorrect");
    }

    if (await verifyPassword(newPassword, user.passwordHash)) {
      throw new BadRequestException("New password must be different from the current password");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(newPassword),
      },
    });
  }

  async deleteProfessorAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user || user.role !== "PROFESSOR") {
      throw new UnauthorizedException("That account is no longer available");
    }

    await assertProfessorHasNoActiveAssignmentJobs(this.prisma, userId);

    const assignments = await this.prisma.assignment.findMany({
      where: { professorId: userId },
      select: {
        id: true,
        uploadBatches: {
          select: {
            originalObjectKey: true,
          },
        },
        submissions: {
          select: {
            files: {
              select: {
                storageObjectKey: true,
              },
            },
          },
        },
        templateVersions: {
          select: {
            files: {
              select: {
                storageObjectKey: true,
              },
            },
          },
        },
      },
    });

    const objectKeys = collectAssignmentObjectKeys(assignments);

    await this.prisma.$transaction(async (tx) => {
      for (const assignment of assignments) {
        await deleteAssignmentOwnedData(tx, assignment.id);
      }

      await tx.user.delete({
        where: { id: userId },
      });
    });

    await deleteObjectKeysBestEffort(objectKeys);
  }
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}
