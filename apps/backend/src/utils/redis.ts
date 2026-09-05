import { Redis } from 'ioredis';
import { config } from '../config';


class RedisService {
  private client: Redis | null = null;
  private isConnected = false;

  constructor() {
    if (config.REDIS_URL) {
      this.client = new Redis(config.REDIS_URL, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 5) {
            console.error('Redis max retries reached. Stopping reconnection attempts.');
            return null; // Stop retrying
          }
          return Math.min(times * 200, 2000);
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log('Connected to Redis');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        console.error('Redis connection error', err);
      });

      this.client.on('end', () => {
        this.isConnected = false;
        console.warn('Redis connection closed');
      });
    } else {
      console.warn('REDIS_URL not configured. RedisService will fail open (bypass).');
    }
  }

  get isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  getClient(): Redis | null {
    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable || !this.client) {
      return null;
    }
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      console.error('Redis get error', error, key);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.isAvailable || !this.client) {
      return;
    }
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      console.error('Redis set error', error, key);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isAvailable || !this.client) {
      return;
    }
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Redis del error', error, key);
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }
}

export const redisService = new RedisService();
