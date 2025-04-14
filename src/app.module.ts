import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule, SequelizeModuleOptions } from '@nestjs/sequelize';
import { join } from 'path';
import { DalModule } from './dal/dal.module';
import { EarthquakeController } from './earthquake/earthquake.controller';
import { EarthquakeService } from './earthquake/earthquake.service';
import { ScheduleModule } from '@nestjs/schedule';

/**
 * The AWS Secrets Manager client.
 */
const secretsManager = new SecretsManagerClient();

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const defaultConfig: SequelizeModuleOptions = {
          dialect: 'mysql',
          port: +3306,
          models: [join(__dirname, '**/*.model.ts')],
          autoLoadModels: true,
          logging: false,
        };

        if (configService.get('USE_LOCAL_DATABASE') === 'true') {
          return {
            ...defaultConfig,
            host: configService.get('DB_HOST'),
            port: +configService.get('DB_PORT'),
            username: configService.get('DB_USERNAME'),
            password: configService.get('DB_PASSWORD'),
            database: configService.get('DB_DATABASE'),
            logging: true,
          };
        }

        /**
         * Retrieve the secret from AWS Secrets Manager.
         */
        const secretResponse = await secretsManager.send(
          new GetSecretValueCommand({
            SecretId: configService.get('DB_CREDENTIALS'),
          }),
        );

        /**
         * If the secret response contains a secret string, parse it and return the database configuration.
         */
        if (secretResponse.SecretString) {
          const { host, port, username, password } = JSON.parse(
            secretResponse.SecretString,
          );

          const remoteConfig = {
            ...defaultConfig,
            host: host,
            port: +port,
            username,
            password,
            database: configService.get('DB_DATABASE'),
          };

          return {
            ...remoteConfig,
          };
        }

        throw new Error(
          'Failed to retrieve database credentials from AWS Secrets Manager.',
        );
      },
      inject: [ConfigService],
    }),
    DalModule,
  ],
  controllers: [EarthquakeController],
  providers: [EarthquakeService],
})
export class AppModule {}
