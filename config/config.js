/* eslint-disable @typescript-eslint/no-require-imports */
const dotenv = require('dotenv');
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require('@aws-sdk/client-secrets-manager');

/**
 * Retrieves the database credentials from AWS Secrets Manager.
 */
dotenv.config();

async function getDatabaseCredentials() {
  if (!process.env.DB_CREDENTIALS) {
    throw new Error('DB_CREDENTIALS environment variable is not set.');
  }

  const secretsManager = new SecretsManagerClient({
    region: process.env.AWS_REGION,
  });

  try {
    const secretResponse = await secretsManager.send(
      new GetSecretValueCommand({
        SecretId: process.env.DB_CREDENTIALS,
      }),
    );

    if (secretResponse.SecretString) {
      return JSON.parse(secretResponse.SecretString);
    }

    throw new Error('SecretString not found in the response.');
  } catch (error) {
    console.error('Failed to retrieve database credentials:', error);
    throw error;
  }
}

module.exports = (async () => {
  const defaultConfig = {
    dialect: 'mysql',
    port: +3306,
  };

  /**
   * If the USE_LOCAL_DATABASE environment variable is set to true, use the
   * local database credentials.
   */
  if (process.env.USE_LOCAL_DATABASE === 'true') {
    return {
      ...defaultConfig,
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      logging: true,
    };
  }

  const credentials = await getDatabaseCredentials();

  /**
   * The database credentials are retrieved from AWS Secrets Manager.
   */
  return {
    ...defaultConfig,
    username: credentials.username,
    password: credentials.password,
    database: process.env.DB_DATABASE,
    host: credentials.host,
    port: credentials.port || 3306,
    dialect: 'mysql',
  };
})();
