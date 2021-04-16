export interface Query {
  state: string;
  zipcodes: string[];
  lastUpdated?: string;
}

export interface QueryWithResult extends Query {
  result: { zipcode: string; stores: { storeNumber: string }[] }[];
}

export interface QueryDB {
  [k: string]: Query;
}

