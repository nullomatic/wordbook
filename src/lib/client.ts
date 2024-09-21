import pg from 'pg';
import * as redis from 'redis';
import { logger } from './util';

declare global {
  var _pgClient: pg.Client;
  var _redisClient: redis.RedisClientType;
}

export class DatabaseClient {
  private static client: pg.Client;
  private static options: pg.ClientConfig = {
    user: 'postgres',
    password: 'password', // TODO: Make environment variable
    host: '127.0.0.1',
    port: 5432,
  };

  private constructor() {}

  public static async getClient(): Promise<pg.Client> {
    if (process.env.NODE_ENV !== 'production') {
      if (!global._pgClient) {
        global._pgClient = new pg.Client(this.options);
        await global._pgClient.connect();
      }
      return global._pgClient;
    } else {
      if (!this.client) {
        this.client = new pg.Client(this.options);
        await this.client.connect();
      }
      return this.client;
    }
  }
}

export class RedisClient {
  private static client: redis.RedisClientType;

  private constructor() {}

  public static async getClient(): Promise<redis.RedisClientType> {
    if (process.env.NODE_ENV !== 'production') {
      if (!global._redisClient) {
        global._redisClient = await redis.createClient();
        global._redisClient.on('error', (error) => logger.error(error));
        await global._redisClient.connect();
      }
      return global._redisClient;
    } else {
      if (!this.client) {
        this.client = await redis.createClient();
        this.client.on('error', (error) => logger.error(error));
        await this.client.connect();
      }
      return this.client;
    }
  }
}
