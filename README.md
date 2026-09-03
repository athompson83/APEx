<div align="center">

# APEx360

**A mobile field-evaluation, taskbook, and competency-progress application.**

![Stage](https://img.shields.io/badge/stage-prototype-1B3A6B?style=flat-square)
![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-1B3A6B?style=flat-square)
![Expo](https://img.shields.io/badge/Expo-SDK%2051-1B3A6B?style=flat-square&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-1B3A6B?style=flat-square&logo=typescript&logoColor=white)

</div>

> [!NOTE]
> This repository is an Expo/React Native prototype. It is not evidence of a store-ready or production-certified release.

## Overview

APEx360 provides a native application foundation for structured field development and evaluation workflows. The current codebase includes navigation and application surfaces for authentication, dashboards, evaluations, taskbooks, progress, and user profiles.

## Implemented foundation

| Area | Repository evidence |
| --- | --- |
| Native shell | Expo and React Native application configuration |
| Navigation | Native stack and bottom-tab navigation |
| Workflow surfaces | Dashboard, evaluations, taskbook, progress, and profile screens |
| State and data | TanStack Query, Zustand, Axios, and AsyncStorage |
| Device security | Expo Secure Store dependency for protected local values |
| Distribution setup | EAS profiles and iOS/Android identifiers |
| Backend adapter | Configurable Bubble API endpoint used by the prototype |

## Security boundary

The current environment example uses `EXPO_PUBLIC_*` values. Anything under that prefix is bundled into the client and must be treated as public. Never place an administrative Bubble token, service credential, or other privileged secret in the mobile application. Production integration should use a server-side API boundary with short-lived user authorization.

## Local development

```bash
npm install
cp .env.example .env
npm start
```

Platform commands:

```bash
npm run android
npm run ios
npm run type-check
npm run lint
```

## Configuration

The prototype expects:

```text
EXPO_PUBLIC_BUBBLE_API_URL=
EXPO_PUBLIC_BUBBLE_API_KEY=
EXPO_PUBLIC_APP_ENV=
```

Only a deliberately public, least-privilege client credential is acceptable in `EXPO_PUBLIC_BUBBLE_API_KEY`. A privileged API key requires a backend-for-frontend before release.

## Release path

1. **MVP:** verify navigation, authentication, evaluation, taskbook, and progress workflows against a governed backend.
2. **Beta:** complete physical-device QA, offline/reconnect behavior, accessibility, error handling, and role isolation.
3. **Production:** replace placeholder EAS configuration, complete store/privacy requirements, certify the backend boundary, and verify signed builds on both platforms.