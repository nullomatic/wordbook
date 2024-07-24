import * as pg from 'pg';
import * as redis from 'redis';

export class DatabaseClient {
  private static client: pg.Client;
  private constructor() {}
  public static async getClient(): Promise<pg.Client> {
    if (!DatabaseClient.client) {
      DatabaseClient.client = new pg.Client({
        user: 'postgres',
        password: 'password', // TODO: Make environment variable
        host: '127.0.0.1',
        port: 5432,
      });
      await DatabaseClient.client.connect();
    }
    return DatabaseClient.client;
  }
}

export class RedisClient {
  private static client: redis.RedisClientType;
  private constructor() {}
  public static async getClient(): Promise<redis.RedisClientType> {
    if (!RedisClient.client) {
      RedisClient.client = await redis.createClient();
      RedisClient.client.on('error', (error) => {
        if (error.code === 'ECONNREFUSED') {
          console.error(
            `Redis client connection error. Start Redis on port ${error.port} before running.`
          );
        } else {
          console.error('Redis client:', error);
        }
      });
      await RedisClient.client.connect();
    }
    return RedisClient.client;
  }
}
