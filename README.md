# Update time on edit plugin

This plugins update on save the metadata of the file with the time it was updated, and the time of creation if there is none (useful for new files).
The keys can be configured (by default `updated` and `created`).

**This is still an early version of the plugin, here is the current limitations :**

The supported input date format are :
* timestamp number (ex: 628021800000)
* year only (ex: "2010")
* year and month only (ex: "2010-06")
* year, month and day (ex: "2010-06-09")
* ISO RFC 2822 format (ex : "2010-06-09T15:20:00Z", "2010-06-09T15:20:00-07:00")
* Non iso format (ex: "June 9, 2010", "2010 June 9", "6/9/2010 3:20 pm")

The only supported output is the [RFC 3339](https://tools.ietf.org/html/rfc3339) format (ex : "2019-09-18T19:00:52Z")

