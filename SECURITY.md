# Security policy

Please do not open a public issue for security problems. Email **partners@noderings.com** with a
description, steps to reproduce and the package version. We acknowledge reports within three
working days.

The node only sends your API token to the Base URL in the credential (by default
`https://api.noderings.com`). It reads no environment variables or files. Use a service account
token with only the permissions your workflows need.
