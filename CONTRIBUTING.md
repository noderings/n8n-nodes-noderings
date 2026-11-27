# Contributing

1. Open an issue before large changes.
2. `npm install`, then `npm run lint`, `npm run build` and `npm test` must pass.
3. Do not add runtime `dependencies`; n8n does not verify packages that have any.
4. Follow n8n's [UX guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/ux-guidelines)
   for names, descriptions and errors.
5. Test changes against a real NodeRings organization with `npm run dev`. Clean up anything you
   create.

Report security problems privately as described in [SECURITY.md](SECURITY.md).
