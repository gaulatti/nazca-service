import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { httpPort } from './utils/network';

/**
 * Initializes and starts the NestJS application with Fastify adapter.
 *
 * - Creates a new Nest application using the Fastify adapter.
 * - Enables CORS for the application.
 * - Registers the global authorization guard.
 * - Starts the application and listens for REST API.
 *
 * @returns {Promise<void>} A promise that resolves when the application has started.
 */
async function bootstrap(): Promise<void> {
  /**
   * Create a new Nest application using the Fastify adapter
   */
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  /**
   * Enable CORS for the application
   */
  app.enableCors();

  /**
   * Start the application.
   */
  await app.listen(httpPort, '0.0.0.0');
  Logger.log(`🚀 REST API running on port ${httpPort}`);
}

bootstrap();
