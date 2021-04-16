import { createHash } from "crypto";
import fs from "fs";
import got from "got";
import _ from "lodash";
import touch from "touch";
import StoreDetails from "./prepare";

const URLs = StoreDetails.URLs;

const API_ENDPOINT = process.env["WBA_API_ENDPOINT"];
const API_KEY = process.env["WBA_API_KEY"];
const API_LIMIT = parseInt(process.env["WBA_API_LIMIT"] || "10");
const DEFAULT_SLOT_CAPACITY = parseInt(process.env["WBA_DEFAULT_SLOT_CAPACITY"] || "5");
const BULK_BASE_URL = process.env["WBA_BULK_BASE_URL"];

const epoch = new Date(0).toISOString();

const sha256 = (v: string): string => createHash("sha256").update(v, "utf-8").digest().toString("hex");
const queryOutputFilename = (q: Query): string => `Slot-${sha256(canonical(q))}.ndjson`;

interface Query {
  state: string;
  zipcodes: string[];
  lastUpdated?: string;
}

interface QueryWithResult extends Query {
  result: { zipcode: string; stores: { storeNumber: string }[] }[];
}

const canonical = (q: Query): string => `state=${q.state}&zipcodes=${q.zipcodes.join(",")}`;

interface QueryLog {
  [k: string]: Query;
}

const indexQueries = (qs: Query[]): QueryLog =>
  qs.reduce((acc: QueryLog, q) => {
    acc[canonical(q)] = JSON.parse(JSON.stringify(q));
    return acc;
  }, {});

async function getHistoricalQueries() {
  let queried: Query[] = [];
  try {
    queried = JSON.parse(fs.readFileSync("./dist/queries.json").toString());
  } catch (e) {
    console.log("No previous queries to work from");
  }
  return indexQueries(queried);
}

async function getFutureQueries(queries: Query[], historicalQueryLog: QueryLog) {
  return _.chain(queries)
    .map((q) => ({
      ...q,
      lastUpdated: historicalQueryLog[canonical(q)]?.lastUpdated || epoch,
    }))
    .sortBy(
      (v) => v.lastUpdated,
      (v) => canonical(v)
    )
    .value();
}

async function runQueries(nextQueries: Query[]): Promise<QueryWithResult[]> {
  let results = JSON.parse(JSON.stringify(nextQueries)) as QueryWithResult[];
  for (const [i, q] of nextQueries.entries()) {
    try {
      const qResult = (await got(`${API_ENDPOINT}?${canonical(q)}`, {
        timeout: 5000,
        headers: {
          apiKey: API_KEY,
        },
      }).json()) as QueryWithResult["result"];

      console.log("Got", qResult);
      results[i].result = qResult;
      results[i].lastUpdated = new Date().toISOString();
    } catch (ex) {
      console.log("Query failed", ex);
    }
  }

  return results;
}

function daysFromNow(n: number) {
  let d = new Date().getTime() + 1000 * 60 * 60 * 25 * n;
  let ret = new Date(d);
  return `${ret.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

async function tick() {
  const historicalQueryLog = await getHistoricalQueries();
  const allFutureQueries = await getFutureQueries(StoreDetails.queries, historicalQueryLog);
  const queriesThisTick = allFutureQueries.slice(0, API_LIMIT);
  const qResults = await runQueries(queriesThisTick);

  const nextQueryLog = indexQueries(allFutureQueries);
  for (const r of qResults) {
    if (r.result) {
      console.log("Result", r.result);
      fs.writeFileSync(
        `./dist/${queryOutputFilename(r)}`,
        r.result
          .flatMap((r) =>
            r.stores.map((s) => ({
              resourceType: "Slot",
              status: "free",
              id: s.storeNumber,
              schedule: {
                reference: `Schedule/${s.storeNumber}`,
              },
              start: daysFromNow(0),
              end: daysFromNow(5),
              extension: [
                {
                  url: URLs.slotCapacity,
                  valueInteger: DEFAULT_SLOT_CAPACITY,
                },
              ],
            }))
          )
          .map((store) => JSON.stringify(store))
          .join("\n")
      );

      nextQueryLog[canonical(r)].lastUpdated = r.lastUpdated;
    }
  }

  const nextQueryArray = _.sortBy(
    Object.values(nextQueryLog),
    (q) => q.lastUpdated,
    (q) => canonical(q)
  );

  nextQueryArray.forEach((q) => {
    touch.sync(`./dist/${queryOutputFilename(q)}`);
  });

  fs.writeFileSync("./dist/queries.json", JSON.stringify(nextQueryArray, null, 2));

  const manifest = {
    transactionTime: nextQueryArray[0].lastUpdated, // we're only as current as our least current query
    request: `${BULK_BASE_URL}$bulk-publish`,
    output: [
      {
        type: "Location",
        url: `${BULK_BASE_URL}locations.ndjson`,
      },
      {
        type: "Schedule",
        url: `${BULK_BASE_URL}schedules.ndjson`,
      },
      ..._.sortBy(nextQueryArray, (q) => canonical(q)).map((q) => ({
        type: "Slot",
        url: `${BULK_BASE_URL}${queryOutputFilename(q)}`,
        extension: {
          state: [q.state],
          currentAsOf: q.lastUpdated,
        },
      })),
    ],
    error: [],
  };

  fs.writeFileSync(`./dist/$bulk-publish`, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(`./dist/locations.ndjson`, StoreDetails.locations.map((l) => JSON.stringify(l)).join("\n"));
  fs.writeFileSync(`./dist/schedules.ndjson`, StoreDetails.schedules.map((l) => JSON.stringify(l)).join("\n"));
}

tick();
