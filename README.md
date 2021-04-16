## SMART Scheduling Links Aggregator for WBA

This is a proof of concept to:

* Query Walgreens COVID-19 Appointment API
* Generate SMART Scheduling Links data outputs in FHIR

### Notes and limitations

This approach is a best-effort translation from WBA's current API. The only information is "availability in the next 5 days" per location, so note that:

* All slots are represented as 5 days long, because no more granular information is available. This isn't compliant with the SMART Schedulink Links spec, so please consider it an early MVP

* All slots include a fixed small capacity estimate of 5, helping to convey that these are stores rather than mass vaccination sites.

* `transactionTime` in the `$bulk-publish` manifest reflects the time of the *oldest data* in the payload; this is relevant because API rate limiting on the underlying source information means that fetching a full data set takes ~1 hour, which gives us a rolling window of fresh data