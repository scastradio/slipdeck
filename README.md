# slipdeck

UI monorepo for the slyce protocol family.

| App | URL | Description |
|-----|-----|-------------|
| slyce-web | https://slyce-web-seven.vercel.app | Split payments frontend |
| slyce-admin | https://slyce-admin.vercel.app | Admin panel |
| ante-web | https://ante-web.vercel.app | Group contribution vaults |
| drop-web | coming soon | Airdrop infrastructure |

## Dev

```bash
pnpm install
pnpm dev:slyce     # run slyce-web
pnpm dev:ante      # run ante-web
pnpm dev:admin     # run slyce-admin
```

## Structure

```
apps/
  slyce-web/     Next.js — split payments UI
  slyce-admin/   Next.js — protocol admin panel
  ante-web/      Next.js — group vaults UI
  drop-web/      Next.js — airdrop UI (coming soon)
packages/
  ui/            Shared components (FamilyBar, theme tokens)
```
