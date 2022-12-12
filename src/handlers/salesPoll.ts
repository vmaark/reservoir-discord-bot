import Redis from "ioredis";
import { paths } from "@reservoir0x/reservoir-kit-client";
import logger from "../utils/logger";
import getCollection from "./getCollection";
import constants from "../utils/constants";
import { TwitterApi } from "twitter-api-v2";

const sdk = require("api")("@reservoirprotocol/v1.0#6e6s1kl9rh5zqg");
const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN ?? "");

/**
 * Check sales to see if there are new ones since the last alert
 * @param {string[]} contractArray collections to check for new sales
 * @param {string} apiKey Reservoir API Key
 * @param {Redis} redis Redis instance to save order ids
 */
export async function salePoll(
  contractArray: string[],
  apiKey: string,
  redis: Redis
) {
  try {
    // Authorizing with Reservoir API Key
    await sdk.auth(apiKey);

    // Getting floor ask events from Reservoir
    const salesResponse: paths["/sales/v4"]["get"]["responses"]["200"]["schema"] =
      await sdk.getSalesV4({
        contract: contractArray,
        includeTokenMetadata: "true",
        limit: "100",
        accept: "*/*",
      });

    // Getting the most recent sales event
    const sales = salesResponse.sales;

    // Log failure + return if floor event couldn't be pulled
    if (!sales) {
      logger.error(`Could not pull sales for ${contractArray}`);
      return;
    }

    // Pull cached sales event id from Redis
    const cachedId: string | null = await redis.get("saleorderid");
    if (!sales[0].saleId) {
      logger.error("Couldn't set latest sales order id");
      return;
    }

    if (!cachedId) {
      await redis.set("saleorderid", sales[0].saleId);
      return;
    }

    // If most recent event matchs cached event exit function
    if (sales[0].saleId === cachedId) {
      return;
    }

    const cachedListingIndex =
      sales.findIndex((order) => {
        return order.saleId === cachedId;
      }) - 1;

    if (cachedListingIndex < 0) {
      await redis.del("saleorderid");
      logger.info("cached sale not found, resetting");
    }

    for (let i = cachedListingIndex; i >= 0; i--) {
      const name = sales[i].token?.name;
      const image = sales[i].token?.image;

      if (!sales[i].orderSource) {
        logger.error(
          `couldn't return sale order source for ${sales[i].txHash}`
        );
        continue;
      }

      if (!name || !image) {
        logger.error(
          `couldn't return sale order name and image for ${sales[i].txHash}`
        );
        continue;
      }

      const collection = await getCollection(
        undefined,
        sales[i].token?.contract,
        1,
        false
      );

      if (!collection?.[0].image || !collection?.[0].name) {
        logger.error(
          `couldn't return sale order collection data for ${sales[i].txHash}`
        );
        continue;
      }

      const mediaId = await twitterClient.v1.uploadMedia("./image.png");

      await twitterClient.v2.tweet(
        `(2017 NFT) Realms of Ether ${sales[i].token?.name} purchased for ${
          sales[i].price?.amount?.native
        }Ξ ($${
          sales[i].price?.amount?.usd
        }) ${`https://api.reservoir.tools/redirect/sources/${sales[i].orderSource}/logo/v2`}`,
        { media: { media_ids: [mediaId] } }
      );
    }
    await redis.set("saleorderid", sales[0].saleId);
  } catch (e) {
    logger.error(`Error ${e} updating new sales`);
  }
}
