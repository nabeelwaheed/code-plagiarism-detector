import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ComparisonsService } from "./comparisons.service.js";
import { CreateComparisonRunDto } from "./dto/create-comparison-run.dto.js";
import { CurrentUser, Roles } from "../auth/auth.decorators.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";

@Roles("professor")
@Controller("comparison-runs")
export class ComparisonsController {
  constructor(private readonly comparisonsService: ComparisonsService) {}

  @Get(":comparisonRunId")
  getComparisonRun(
    @Param("comparisonRunId") comparisonRunId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.comparisonsService.getComparisonRun(comparisonRunId, user);
  }

  @Get("pair/:pairResultId")
  getPairResult(
    @Param("pairResultId") pairResultId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.comparisonsService.getPairResult(pairResultId, user);
  }

  @Post()
  createComparisonRun(
    @Body() payload: CreateComparisonRunDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.comparisonsService.createComparisonRun(payload, user);
  }
}
