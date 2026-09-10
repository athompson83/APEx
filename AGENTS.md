# APEx360 — shared native-app guidance

## Context and boundaries

- Read `README.md`, `PROJECT_CHECKLIST.md`, `PROGRESS.md`, and applicable directory guidance. This is an Expo/React Native field-evaluation, taskbook, and competency prototype—not a certified store release.
- Preserve current app identity, navigation/state boundaries, and the configurable Bubble adapter. Do not import another project's auth, database, or deployment model by assumption.
- All `EXPO_PUBLIC_*` values are client-bundled/public. Never place a privileged Bubble token or service credential there; privileged integration requires a server-side API boundary with short-lived user authorization.
- Preserve role/evaluator/subject isolation, protected local storage, logout behavior, and truthful save/synchronization status. Use synthetic staff/evaluation data in tests.
- Current explicit owner directions and approved controls govern scope/release authority; retain any adopted canonical control standard rather than adding a competing constitution. Native signing/store submission and provider/platform changes are separate from editing source.

## Real development foundation

- Choose one end-to-end evaluation or taskbook journey and explicit non-goals. Prove input, save, reload/reconnect, and unauthorized access—not just the presence of screens.
- Existing scripts: `npm start`, `npm run android`, `npm run ios`, `npm run type-check`, and `npm run lint`. Native run commands require the corresponding platform toolchain.
- The inspected root has no committed lockfile and the manifest has no test/smoke script. Reproducible installation and behavioral verification are open foundation work, not passing checks.
- Reconcile the Expo SDK/React Native/Node/package-manager compatibility; generate and commit one appropriate lockfile in a real isolated install, then use frozen installation. Do not invent pins, silently upgrade Expo, or add fake success scripts.
- Before a large feature, prove clean-checkout install/start, a meaningful synthetic smoke path, and deliberate-failure detection without Production access or paid-provider calls.
- Test loading/error states, offline/reconnect behavior, duplicate submission protection, accessibility, and role isolation. Distinguish simulator/browser evidence from physical-device evidence and signed builds.
- Record variable names, consumers, environment, public/server-only classification, and validation methods—not secrets. Keep live Bubble/EAS/Production checks separately authorized and scoped.

## Economical delivery

- Run the narrowest meaningful local checks before coherent pushes; broaden for auth, contracts, data/storage, dependencies, toolchains, workflows, and agent policy. Diagnose complete failing logs before reruns.
- Avoid speculative pushes, duplicate CI jobs, repeated matrices, unnecessary native builds, and unrelated hosted tasks. Ordinary prose-only routing needs an explicit allowlist; policy/executable Markdown needs relevant validation.
- Preserve required checks. When CI is introduced/changed, test routing and an always-evaluated gate rejecting failed/cancelled/missing required work. Cancel superseded PR validation, not blindly deployment/build-release/migration work.
- Use least privilege, immutable action references, and untrusted/privileged separation. Verify actual branch rules, canonical backend/EAS identities, environment scopes, release triggers, and authority before merging or distributing.
- Reuse approved projects and native isolation; do not create duplicate backend/EAS projects or overwrite signing identity as a recovery step.

## Handoff

- Track implemented, wired, locally verified, hosted verified, and released separately with exact SHA, commands/results, target/device, and evidence. A Bubble adapter or EAS profile is not live integration/store readiness.
- Keep `PROJECT_CHECKLIST.md` evidence-linked and `PROGRESS.md` concise; archive history without deleting evidence. Fix relevant blockers/invariants and record unrelated cleanup without expanding the milestone.
- Report actual verification, genuine owner-only actions, blockers, and next smallest task. Use existing skills selectively and confirm fresh Codex/Claude guidance loading.
