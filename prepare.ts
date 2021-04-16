import { Command } from "commander";
import { createHash } from "crypto";
import fs from "fs";
import _, { last } from "lodash";


const tx = JSON.parse(fs.readFileSync("zips/tx.json").toString())

const queries = _.chunk(tx, 50).map(c => ({
    state: 'TX', 
    zipcodes: c
}))

console.log(JSON.stringify(queries, null, 2))