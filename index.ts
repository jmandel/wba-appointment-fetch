import { createHash } from "crypto";
import fs from "fs";
import got from "got";
import _, { reduce } from "lodash";
import queryFile from "./queries/tx.json";

const API_ENDPOINT = process.env["WBA_API_ENDPOINT"];
const API_KEY = process.env["WBA_API_KEY"];
const QUERIES_PER_RUN = parseInt(process.env["WBA_API_LIMIT"] || "25")

const epoch = new Date(0).toISOString();

const sha256 = (v: string): string =>
  createHash("sha256").update(v, "utf-8").digest().toString("base64url");

interface Query {
  state: string;
  zipcodes: string[];
  lastUpdated?: string;
}

interface QueryWithResult extends Query {
  result: { zipcode: string; stores: { storeNumber: string }[] }[];
}


const canonical = (q: Query): string =>
  `state=${q.state}&zipcodes=${q.zipcodes.join(",")}`;

interface QueryLog {
  [k: string]: Query;
}

const indexQueries = (qs: Query[]): QueryLog =>
  qs.reduce((acc: QueryLog, q) => {
    acc[canonical(q)] = q;
    return acc;
  }, {});

async function getLastQueryes() {
  let queried: Query[] = [];
  try {
    queried = JSON.parse(fs.readFileSync("./dist/queries.json").toString());
  } catch (e) {
    console.log("No previous queries to work from");
  }
  return indexQueries(queried);
}
async function getNextQueries(lastQueryLog: QueryLog) {
  const nextQueries = _.chain(queryFile)
    .map((q) => ({
      ...q,
      lastUpdated: lastQueryLog[canonical(q)]?.lastUpdated || epoch,
    }))
    .sortBy(
      (v) => v.lastUpdated,
      (v) => canonical(v)
    )
    .take(QUERIES_PER_RUN)
    .value();

  return nextQueries;
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
    } catch (ex) {}
  }

  return results;
}

function daysFromNow(n: number) {
  let d =  new Date().getTime() + 1000 * 60 * 60 * 25 * n
  let ret = new Date(d);
  ret.setHours(0);
  ret.setMinutes(0);
  ret.setSeconds(0);
  ret.setMilliseconds(0);
  return ret.toISOString();
}

async function tick() {
  const lastQueryLog = await getLastQueryes();
  const nextQueries = await getNextQueries(lastQueryLog);

  console.log("Next Queries", nextQueries);
  const qResults = await runQueries(nextQueries);

  for (const r of qResults) {
    if (r.result) {
      console.log("Result", r.result);
      fs.writeFileSync(
        `./dist/Slot-${sha256(canonical(r))}.ndjson`,
        r.result
          .flatMap((r) =>
            r.stores.map((s) => ({resourceType: "Slot", id: s.storeNumber, start: daysFromNow(0), end: daysFromNow(5), deetsToFix: s }))
          )
          .map((store) => JSON.stringify(store))
          .join("\n")
      );

      lastQueryLog[canonical(r)] = {
        ...r,
        result: undefined,
      } as Query;
    }
  }

  fs.writeFileSync(
    "./dist/queries.json",
    JSON.stringify(
      _.sortBy(
        Object.values(lastQueryLog),
        (q) => q.lastUpdated,
        (q) => canonical(q)
      ),
      null,
      2
    )
  );
}

tick();
