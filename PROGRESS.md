# APEx360 — current handoff

2026-09-10 baseline: `3d6ec904e66f2ec02c443da85fb3ad5f2981e323`, default branch `claude/apex360-mobile-app-CBlb4`.
Read README, package manifest, root tree and branch metadata. Added shared agent guidance and evidence-based tracking; no application, Expo/EAS, credential, backend, or platform changes.

Concrete gaps: no committed root lockfile and no manifest test/smoke script. Existing type/lint commands were not executed here. Runtime, physical-device, fresh-agent, intentional-failure, and hosted checks NOT_RUN; local cloning was unavailable due to DNS resolution.

Next smallest task: establish a compatible frozen install and synthetic evaluation/taskbook smoke path, then demonstrate role isolation and offline/reconnect behavior. Privileged Bubble credentials must never be bundled through EXPO_PUBLIC variables. Store/signing release remains separate from this policy work.
