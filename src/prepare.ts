import _ from "lodash";
import storesRaw from "./vendor/CDCData/_stores_4_16_2021.json";

type Store = typeof storesRaw[number]
type StoreDB = Record<string, Store>

const ZIPCODES_PER_QUERY = 50;
const SKIP_BROKEN_JURISDICTIONS = ["VI"];

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
  name: `${store.name || "Walgreens"} #${store.storeNumber}`,
  telecom: [
    ...(store.phone ? [{ system: "phone", value: store.phone }] : []),
    {
      system: "url",
      value: `https://www.walgreens.com/locator/store/id=${store.storeNumber}`,
    },
  ],
  address: {
    line: [store.address.line1],
    city: store.address.city,
    state: store.address.state,
    postalCode: store.address.zipcode,
  },
  identifier: [
    {
      system: URLs.vtrcks,
      value: `unknown VTrckS pin for ${store.storeNumber}`,
    },
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
  .groupBy((s) => s.address.state)
  .flatMap((s) =>
    _.chain(s)
      .uniq()
      .sortBy()
      .chunk(ZIPCODES_PER_QUERY).map((chunk) => ({
        state: chunk[0].address.state,
        zipcodes: chunk.map((s) => s.address.zipcode),
    }))
    .value()
  )
  .value();

export const locations = stores.map(storeToLocation);
export const schedules = locations.map(locationToSchedule);

export const storesByNumber: StoreDB = stores.reduce((acc: StoreDB, store) => ({
  ...acc,
  [store.storeNumber]: store
}), {});

export default {
  queries,
  locations,
  schedules,
  storesByNumber,
  URLs
};
