import fs from "fs";
import got from "got";
import _ from "lodash";

const API_KEY = process.env["WBA_API_KEY"];
async function fetchAll() {
    const storeResponse = (await got.post('https://services.walgreens.com/api/util/storenumber/v1', {
        json: {
            "apiKey": API_KEY,
            "act": "CDCCOVID"
        },
        responseType: "json"
    })).body as {store: string[]};
    const storeDetails: any[] = [];
    for (const storeId of storeResponse.store) {
        const deets = (await got.post('https://services.walgreens.com/api/stores/details/v1', {
            json: {
                "apiKey": API_KEY,
                "affId":"CDCCOVID",
                "storeNo": storeId
             },
             responseType: "json"
        }));
        storeDetails.push(deets.body)
        console.log(storeDetails.length, "of", storeResponse.store.length)
    }
    fs.writeFileSync("src/vendor/storeDetails.json", JSON.stringify(storeDetails.map(remapDetails), null, 2))
}

function remapDetails(deets: any[]): any[] {
    let mapped = deets.filter((d: any) => true || (d?.serviceIndicators?.pharmacy || []).includes("Immunizations")).map((d: any) => ({
        npiCode: d.npiCode,
        storeNumber: d.storeNumber,
        latitude: d.latitude,
        longitude: d.longitude,
        address: d.address,
        pharmacyPhoneNumber: d.pharmacyPhoneNumber,
        timeZone: d.timeZone,
        phone: d.phone,
        storeBrand: d.storeBrand,
    }))
    console.log("Remapping", deets.length, mapped.length)
    return mapped
}

// let deets = JSON.parse(fs.readFileSync("src/vendor/storeDetailsRaw.json").toString());
// let mapped = remapDetails(deets)
// fs.writeFileSync("src/vendor/storeDetails.json", JSON.stringify(mapped, null, 2))
fetchAll()