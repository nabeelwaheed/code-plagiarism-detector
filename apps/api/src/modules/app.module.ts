import { Module } from "@nestjs/common";
import { AssignmentsModule } from "./assignments/assignments.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { ComparisonsModule } from "./comparisons/comparisons.module.js";
import { HealthModule } from "./health/health.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { QueueModule } from "./queue/queue.module.js";
import { SubmissionsModule } from "./submissions/submissions.module.js";

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    QueueModule,
    AuthModule,
    AssignmentsModule,
    SubmissionsModule,
    ComparisonsModule,
  ],
})
export class AppModule {}
