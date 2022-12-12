import dotenv from "dotenv";
import logger from "./utils/logger";
import Twitter from "./twitter";
import waitPort from "wait-port";
import constants from "./utils/constants";

(async () => {
  try {
    // Setup env vars
    dotenv.config();

    // Check env vars
    const TWITTER_BEARER_TOKEN: string | undefined =
      process.env.TWITTER_BEARER_TOKEN;
    const RESERVOIR_API_KEY: string | undefined = process.env.RESERVOIR_API_KEY;
    const TRACKED_CONTRACTS: string[] | undefined = constants.TRACKED_CONTRACTS;
    const APPLICATION_ID: string | undefined = constants.APPLICATION_ID;
    const REDIS_PORT: number | undefined = constants.REDIS_PORT;
    const REDIS_HOST: string | undefined = constants.REDIS_HOST;

    if (
      !TWITTER_BEARER_TOKEN ||
      !RESERVOIR_API_KEY ||
      !TRACKED_CONTRACTS ||
      !APPLICATION_ID ||
      !REDIS_PORT ||
      !REDIS_HOST
    ) {
      logger.error("Missing env vars");
      throw new Error("Missing env vars");
    }

    const REDIS_URL = { port: REDIS_PORT, host: REDIS_HOST };

    // Setup Twitter
    const twitter = new Twitter(RESERVOIR_API_KEY, REDIS_URL);

    const params = {
      host: REDIS_HOST,
      port: REDIS_PORT,
    };

    waitPort(params).then(async ({ open, ipVersion }) => {
      if (open) {
        console.log(`The port is now open on IPv${ipVersion}!`);
        await twitter.init();
      } else console.log("The port did not open before the timeout...");
    });
  } catch (e) {
    if (e instanceof Error) {
      logger.error(e);
      throw new Error(e.message);
    } else {
      logger.error(e);
      throw new Error("Unexpected error");
    }
  }
})();
