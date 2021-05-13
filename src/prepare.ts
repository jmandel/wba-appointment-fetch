import _ from "lodash";
import fs from "fs";
//import storesRaw from "./vendor/CDCData/_stores_4_16_2021.json";

type Store = {
    "npiCode"?: string,
    "storeNumber": string,
    "latitude": string,
    "longitude": string,
    "address": {
      "zip": string,
      "city": "Elmwood Park",
      "street": "2828 N HARLEM AVE",
      "county": string,
      "state": string
    },
    "pharmacyPhoneNumber": {
      "number": string,
      "areaCode": string,
    },
    "timeZone": string,
    "phone": {
      "number": string,
      "areaCode": string,
    },
    "storeBrand": string
  }; 
type StoreDB = Record<string, Store>

const ZIPCODES_PER_QUERY = 50;
const SKIP_BROKEN_JURISDICTIONS = ["VI"];

const storesRaw: Store[] = JSON.parse(fs.readFileSync("./src/vendor/storeDetails.json").toString());
const stores = storesRaw.filter(s => !SKIP_BROKEN_JURISDICTIONS.includes(s.address.state))

interface Resource {
  resourceType: string;
  id: string;
  [key: string]: unknown;
}

export const URLs = {
  bookingLink: "http://fhir-registry.smarthealthit.org/StructureDefinition/booking-deep-link",
  bookingPhone: "http://fhir-registry.smarthealthit.org/StructureDefinition/booking-phone",
  slotCapacity: "http://fhir-registry.smarthealthit.org/StructureDefinition/slot-capacity",
  serviceTypeDetailed: "http://fhir-registry.smarthealthit.org/CodeSystem/service-type",
  serviceType: "http://terminology.hl7.org/CodeSystem/service-type",
  vtrcks: "https://cdc.gov/vaccines/programs/vtrcks",
};

const storeToLocation = (store: Store): Resource => ({
  resourceType: "Location",
  id: store.storeNumber,
  name: `${store.storeBrand || "Walgreens"} #${store.storeNumber}`,
  telecom: [
    ...(store.pharmacyPhoneNumber ? [{ system: "phone", value: `${store.pharmacyPhoneNumber.areaCode}-${store.pharmacyPhoneNumber.number}` }] : []),
    {
      system: "url",
      value: `https://www.walgreens.com/locator/store/id=${store.storeNumber}`,
    },
  ],
  address: {
    line: [store.address.street],
    city: store.address.city,
    state: store.address.state,
    postalCode: store.address.zip,
    district: store.address.county
  },
  position: {
    longitude: parseFloat(store.longitude),
    latitude: parseFloat(store.latitude),
  },
  identifier: [
    {
      system: URLs.vtrcks,
      value: `unknown VTrckS pin for ${store.storeNumber}`,
    },
    ...(store.npiCode ? [{
      system: "http://hl7.org/fhir/sid/us-npi",
      value: store.npiCode
    }] : []),
    {
      system: "https://walgreens.com",
      value: `${store.storeNumber}`,
    },
  ],
});

const locationToSchedule = (location: Resource): Resource => ({
  resourceType: "Schedule",
  id: location.id,
  serviceType: [
    {
      coding: [
        { system: URLs.serviceType, code: "57", display: "Immunization" },
        {
          system: URLs.serviceTypeDetailed,
          code: "covid19-immunization",
          display: "COVID-19 Immunization Appointment",
        },
      ],
    },
  ],
  actor: [{ reference: `Location/${location.id}` }],
});

export const queries = _.chain(stores)
  .sortBy((s) => s.address.state, (s) => s.address.zip)
  .groupBy((s) => s.address.state)
  .flatMap((stores, state) =>
    _.chain(stores)
      .map((s) => s.address.zip)
      .uniq()
      .chunk(ZIPCODES_PER_QUERY).map((zipcodes) => ({
        state,
        zipcodes,
    }))
    .value()
  )
  .value();

export const locations = stores.map(storeToLocation);
export const schedules = locations.map(locationToSchedule);

export const storesByNumber: StoreDB = Object.fromEntries(stores.map(s => [s.storeNumber, s]));

export default {
  queries,
  locations,
  schedules,
  storesByNumber,
  URLs
};