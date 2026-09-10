# APEx360 — foundation acceptance

| Item | State | Evidence / acceptance |
| --- | --- | --- |
| Prototype baseline inspected | Recorded | README/package/root at `3d6ec904e66f2ec02c443da85fb3ad5f2981e323` |
| Compatible toolchain and frozen install | Pending | No root lockfile at inspected baseline; validate Expo/native compatibility before committing one |
| Behavioral smoke and deliberate-failure proof | Pending | Manifest has start/platform/type/lint commands, not test/smoke commands |
| Evaluation/taskbook end-to-end path | Not verified | Synthetic save/reload/reconnect plus role/subject isolation |
| Public-client credential boundary | Not verified | No privileged secret in bundle; authorized server-side boundary |
| Physical-device and signed release evidence | Not verified | Separate from simulator, profiles, or source presence |
| Fresh-agent loading and fail-closed CI routing | Not run | Executed discovery and positive/negative routing evidence |

This policy change does not alter prior product implementation or claim release readiness.
