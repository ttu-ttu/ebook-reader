<!-- Title: a conventional commit message (fix: …, feat(vn): …); it becomes the squashed commit. -->

## What and why


## Checks

- [ ] `pnpm test`, `npx eslint .` and `pnpm check` (still 13 errors) pass, or the change is Python/docs only
- [ ] Python tests pass if `scripts/` changed
- [ ] Tried on the test stack / in a browser (both view modes for reader changes), or not needed
- [ ] `CHANGELOG.md` line for anything a user or the server would notice
- [ ] No secrets, addresses or deployment details
