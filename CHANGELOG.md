# Changelog

## Unreleased

- **Breaking:** Virtual Machine → Create and Reinstall no longer offer the **User Data** and
  **Saved Cloud-Init User Data** access methods. The NodeRings API now rejects cloud-init user
  data (`Cloud-init user data is no longer accepted. Provide SSH keys or a password.`). Workflows
  saved with either option now stop with a clear error before calling the API; switch them to
  SSH Keys or Password.
- The **Cloud-Init User Data** resource is marked deprecated. It is kept so existing profiles can
  still be listed and deleted.

## 0.1.1

- Publish via npm trusted publishing.
- CI build-before-test fix.
- publishConfig access public.

## 0.1.0

- NodeRings node: virtual machines (create, get, list, start, stop, restart, reinstall, delete,
  tags, firewall attach and detach), SSH keys, DNS zones and records, firewall rulesets,
  snapshots, backups, saved cloud-init user data, tags and marketplace lookups.
- NodeRings Trigger: new virtual machine, IP address assigned, status changed.
