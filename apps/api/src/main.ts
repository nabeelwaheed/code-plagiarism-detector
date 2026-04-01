import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { apiRuntimeConfig } from "./config/runtime-config.js";
import { AppModule } from "./modules/app.module.js";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  app.enableCors({
    origin: apiRuntimeConfig.corsAllowedOrigins,
    credentials: true,
  });
  await app.register(cookie as never);
  await app.register(multipart as never, {
    limits: {
      files: 1,
      fileSize: apiRuntimeConfig.uploadMaxFileSizeBytes,
    },
  });
  await app.listen(apiRuntimeConfig.port, apiRuntimeConfig.host);
}

void bootstrap();
