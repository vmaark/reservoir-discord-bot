import { salePoll } from "./handlers/salesPoll";
import Redis from "ioredis";
import constants from "./utils/constants";

export default class Twitter {
  // Reservoir API Key
  private apiKey: string;
  // Redis connection url
  private redisURL: {};

  /**
   * Initialize new Twitter bot
   * @param {string} apiKey Reservoir API Key
   * @param {object} redisURL Redis connection url
   */
  constructor(apiKey: string, redisURL: {}) {
    this.apiKey = apiKey;
    this.redisURL = redisURL;
  }

  /**
   * Alert new listings, sales, floor price and top bid
   */
  async poll(redis: Redis): Promise<void> {
    // Call polling functions
    await Promise.allSettled([
      salePoll(constants.TRACKED_CONTRACTS, this.apiKey, redis),
    ]).then(() => {
      // Collecting new data in 60s
      setTimeout(() => this.poll(redis), 60000);
    });
  }

  async init(): Promise<void> {
    // Setting up Redis
    const redis = new Redis(this.redisURL);

    // Starting poll process
    this.poll(redis);
  }
}
