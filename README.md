# n8n-nodes-noderings

[![ci](https://github.com/noderings/n8n-nodes-noderings/actions/workflows/ci.yml/badge.svg)](https://github.com/noderings/n8n-nodes-noderings/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/n8n-nodes-noderings)](https://www.npmjs.com/package/n8n-nodes-noderings)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE.md)

[n8n](https://n8n.io) community nodes for [NodeRings](https://noderings.com). Create and manage
virtual machines, DNS, SSH keys, firewall rulesets, snapshots and backups from a workflow, and
start workflows when a virtual machine is created, gets its IP address or changes state.

- **NodeRings** node: 10 resources, 47 operations, usable as an AI agent tool
- **NodeRings Trigger** node: new virtual machine, IP address assigned, status changed

## Installation

**Self-hosted n8n:** go to **Settings → Community Nodes → Install**, enter `n8n-nodes-noderings`,
and confirm. See n8n's [community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

**n8n Cloud:** available once n8n has verified the package.

## Credentials

Create a **NodeRings API** credential:

| Field | Value |
|---|---|
| API Token | A service account token. In the NodeRings console: **Organization → Access Control → Service accounts**. Give it only the permissions your workflows need. |
| Organization ID | Optional. Sent as the `X-Organization-ID` header; leave empty to use the token's organization. |
| Base URL | Keep `https://api.noderings.com`. |

**Test** in the credential dialog calls `GET /v1/organization` to check the token.

## Operations

| Resource | Operations |
|---|---|
| Virtual Machine | Create, Get, Get Many, Delete, Start, Stop, Restart, Reinstall, Update Tags, Attach Firewall, Detach Firewall |
| SSH Key | Create, Get, Get Many, Delete |
| DNS Zone | Create, Get, Get Many, Delete |
| DNS Record | Create or Update, Get Many, Delete |
| Firewall Ruleset | Create, Get, Get Many, Rename, Delete |
| Snapshot | Create, Get, Get Many, Restore, Delete |
| Backup | Get, Get Many, Restore, Delete |
| Cloud-Init User Data (deprecated) | Create, Get, Get Many, Update, Delete |
| Tag | Get Many |
| Marketplace | Get Many Regions, Get Many Plan Codes, Get Many Offers, Get Plan, Get Distros |

Notes:

- **Creating a virtual machine** orders a server that is billed from that moment. You need a
  `planId` and `regionId`: use **Marketplace → Get Many Offers** (plan code, country and city)
  and take `planId` and `planRegions[].regionId` from the offer you want.
- **One access method** per create or reinstall: SSH keys saved in NodeRings, or a password.
  The node only sends the one you choose.
- **Cloud-init user data is no longer accepted** by the API on create or reinstall (it answers
  `Cloud-init user data is no longer accepted. Provide SSH keys or a password.`). The
  node no longer offers User Data or Saved Cloud-Init User Data; workflows saved with those
  options stop with a clear error. Create the server with SSH keys, then run your setup over SSH
  (for example with n8n's SSH node). The **Cloud-Init User Data** resource is kept only to list and
  delete profiles you saved before.
- **Idempotency key:** every create sends one (a UUID). Leave it empty to generate a new one, or
  set it yourself and reuse it when you retry a create that may already have gone through.
- **Simplify** (on by default for virtual machines) returns 10 fields: `id`, `hostname`,
  `operationStatus`, `ipv4`, `ipv6`, `distro`, `regionCity`, `tags`, `planCode`, `providerName`.
- **Get Many** pages through the API 100 rows at a time; **Return All** reads every page.
- **Delete** operations return `{ "deleted": true }`.
- **DNS Record → Create or Update** sets every value of a name and type, replacing what was there.
  Put several values on separate lines.

## Trigger

**NodeRings Trigger** polls the API on the schedule you set (every minute by default). NodeRings has
no webhooks for these events.

| Event | Fires when |
|---|---|
| New Virtual Machine | A virtual machine exists that was not there on the previous check |
| IP Address Assigned | A virtual machine has its first public IPv4 or IPv6 address |
| Status Changed | A virtual machine's `operationStatus` changes, including when it is deleted. Output has `previousStatus`. Optionally watch one virtual machine only. |

The first check after you activate a workflow only records what exists, so you are not flooded with
events for virtual machines you already have. **Test step** in the editor returns the newest virtual
machine so you can see the output.

## Example: a DNS name for every new server

[`examples/dns-for-new-vms.json`](examples/dns-for-new-vms.json): **NodeRings Trigger** (IP Address
Assigned) → **NodeRings** (DNS Record → Create or Update, name `{{ $json.hostname }}`, value
`{{ $json.ipv4 }}`). Import it with **Workflows → Import from File**, then pick your credential and
DNS zone.

## Limits

The NodeRings API cannot resize a virtual machine, boot from a custom image, attach block volumes,
or create load balancers, so the node does not offer those. Snapshot and backup restores overwrite
the same virtual machine.

## Compatibility

Tested with n8n 2.49 against the production NodeRings API.

## Development

```bash
npm install
npm run lint
npm run build
npm test        # unit tests, no token needed
npm run dev     # n8n with the node loaded, at http://localhost:5678
```

Releases are published to npm by [`.github/workflows/publish.yml`](.github/workflows/publish.yml)
with a provenance statement when a version tag such as `0.1.0` is pushed.

## Resources

- [NodeRings](https://noderings.com)
- [NodeRings API description](https://api.noderings.com/v1/openapi.json)
- [n8n community nodes](https://docs.n8n.io/integrations/community-nodes/)
- [Go SDK](https://github.com/noderings/noderings-go) for using the NodeRings API from Go

## License

[MIT](LICENSE.md)
