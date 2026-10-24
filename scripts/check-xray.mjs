// /build is "Ready & next" now; its end-to-end check lives in check-roadmap.mjs,
// and Behind the scenes (/xray) has its own in check-behind.mjs. This name is
// kept so existing check lists keep working.
//
//   npm run dev            (port 3240)
//   node scripts/check-xray.mjs

await import("./check-roadmap.mjs");
