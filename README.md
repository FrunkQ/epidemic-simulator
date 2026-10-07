# Epidemic simulator

A simple what-if tool for curious people: watch how a disease spreads between towns, and what vaccination, lockdowns, flight bans and testing do about it. It is illustrative, not a forecast. The numbers behind each disease come from published research, listed with their sources in `src/lib/config/citations.ts`.

The design and build plan live in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Running it

```sh
npm install
npm run dev        # the app at http://localhost:5173
npm test           # engine tests (determinism, speed, lesson tests)
npm run lint
npm run check      # type check
npm run calibrate  # re-fit each disease's spread chance to its research R0
npm run build      # static site in build/, ready for Cloudflare Pages
```
