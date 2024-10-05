import pg from "pg";
import * as redis from "redis";
import { logger } from "./util";

declare global {
  var _pgClient: pg.Client;
  var _redisClient: redis.RedisClientType;
}

export class DatabaseClient {
  private static client: pg.Client;
  private static options: pg.ClientConfig = {
    user: "postgres",
    password: "password", // TODO: Make environment variables
    host: "127.0.0.1",
    port: 5432,
    query_timeout: 2000,
  };
  private static isConnected: boolean;

  private constructor() {}

  private static async connect() {
    if (this.isConnected) {
      logger.info("Postgres client already connected");
      return;
    }

    try {
      // Create new PG client for every connection attempt.
      // (If an existing client loses its connection, a new connection cannot be made on that client.)
      this.client = new pg.Client(this.options);
      this.setupEventListeners();

      await this.client.connect();
      this.isConnected = true;

      logger.info("Created new Postgres client");
    } catch (error) {
      this.isConnected = false;
      logger.error("Error connecting to Postgres:", error);
    }
  }

  private static setupEventListeners() {
    this.client.on("error", (error: unknown) => {
      logger.error(
        `Postgres client: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      this.isConnected = false;
    });
    this.client.on("end", () => {
      this.isConnected = false;
    });
  }

  public static async query(queryText: string, params?: any[]) {
    if (!this.isConnected || !this.client) {
      await this.connect();
    }

    try {
      return await this.client.query(queryText, params);
    } catch (error) {
      logger.error("Error executing Postgres query:", error);
      throw error;
    }
  }
}

export class RedisClient {
  private static client: redis.RedisClientType;
  private static options: redis.RedisClientOptions = {
    // Disabling reconnectStrategy causes client connection attempts to be driven by incoming requests.
    // Otherwise, the client will reattempt to connect forever and cause requests to hang indefinitely.
    socket: { reconnectStrategy: false },
  };
  private static errorLogged: boolean;

  private constructor() {}

  public static async getClient(): Promise<redis.RedisClientType> {
    this.errorLogged = false;

    if (!this.client) {
      this.client = await redis.createClient(this.options as any); // The RedisClientOptions type doesn't work for some reason.
      this.client.on("error", (error: unknown) => {
        if (!this.errorLogged) {
          logger.error(
            `Redis client: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
          this.errorLogged = true;
        }
      });
    }

    if (!this.client.isReady) {
      await this.client.connect();
    }

    return this.client;
  }

  // TODO: remember why I wrote this (I don't remember)

  // public static async getClient(): Promise<redis.RedisClientType> {
  //   return this.setup(process.env.NODE_ENV === "production" ? this : global);
  // }

  // private static async setup(context: RedisClient | typeof global) {
  //   if (!context._redisClient) {
  //     context._redisClient = await redis.createClient();
  //     context._redisClient.on("error", (error: unknown) => {
  //       this.isConnected = false;
  //       logger.error((error as any).message);
  //     });
  //     await context._redisClient.connect();
  //     this.isConnected = true;
  //   }
  //   return context._redisClient;
  // }
}
