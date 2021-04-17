## SMART Scheduling Links Aggregator for WBA

**Data published at: https://raw.githubusercontent.com/jmandel/wba-appointment-fetch/gh-pages/$bulk-publish**

This is a proof of concept to:

* Query Walgreens COVID-19 Appointment API continuously (subject to rate limits)
* Generate [SMART Scheduling Links](https://github.com/smart-on-fhir/smart-scheduling-links) data outputs in FHIR

### Notes and limitations

This approach is a best-effort translation from WBA's current API. The only information is "availability in the next 5 days" per location, so note that:

* All slots are represented as 5 days long, because no more granular information is available. This isn't compliant with the SMART Schedulink Links spec, so please consider it an early MVP

* All slots include a fixed small capacity estimate of 5, helping to convey that these are stores rather than mass vaccination sites.

* `transactionTime` in the `$bulk-publish` manifest reflects the time of the *oldest data* in the payload; this is relevant because API rate limiting on the underlying source information means that fetching a full data set takes ~1 hour, which gives us a rolling window of fresh data

* Booking links are generic (https://www.walgreens.com/findcare/vaccination/covid-19) because there is not way to provide context about location or dates as URL parameters into the booking portal
