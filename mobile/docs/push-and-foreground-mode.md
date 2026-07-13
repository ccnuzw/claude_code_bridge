# Android push and foreground-mode contract

## Decisions

Android push is an opt-in, feature-flagged delivery hint. The app uses the
official FlutterFire `firebase_core` and `firebase_messaging` packages only
when `CCB_MOBILE_PUSH_ENABLED=true`; the default build neither initializes
Firebase nor registers an FCM token. Firebase auto-initialization is disabled
in the Android manifest, so a token is never generated before the paired
profile has opted in.

Firebase configuration is deployment-owned and is intentionally absent from
this repository: no `google-services.json`, generated `firebase_options.dart`,
service-account credential, or sender credential is committed. If private
Android configuration is absent or Firebase initialization fails, push stays
disabled for that process. Pairing, terminal, snapshots, and foreground UI
continue normally.

The client requests notification permission only after it has a paired host
with the existing `notify` scope. A denial is a normal result: it disables
push registration and does not affect foreground notification reconciliation.
Once allowed, the FCM token and every refresh are registered at
`POST /v1/devices/me/push` with the bearer token from that exact paired host
and its `device_id`. The gateway must derive the identity from the bearer
token and reject a mismatched body identity; it must never accept a token as
authority for another paired device. Re-pairing creates a new binding; the app
does not revoke or mutate an old binding automatically.

The registration protocol is deliberately small:

```json
{"platform":"android","device_id":"paired-device-id","token":"fcm-token"}
```

The gateway stores the FCM token encrypted and owner-readable only. Sender
payloads contain only a versioned route (`route_project_id`, `route_agent`,
optional `cursor` and dedupe key) and a short generic notification label. They
must not include prompts, terminal output, paths, errors, credentials, or a
device token. FCM is not an authorization channel: opening a route always
uses the stored paired profile and normal gateway authorization.

On a foreground/background notification click, the app first restores its
stored paired profile and resumes the existing cursor-based notification
catch-up, then loads the requested project and selects its agent. Invalid,
unpaired, stale, or cross-profile routes stop at the project list. Handling a
push never submits a prompt, replays terminal input, retries a mutation, or
writes project files. The notification route is a view-selection request only.

Only the device whose visible target exactly matches the event's project and
agent may be suppressed. Visibility is sent to the gateway as paired-device
presence; it is not a global notification acknowledgement and does not
suppress other devices. Push does not start or retain background SSE/polling.
The current foreground SSE remains a foreground reconciliation aid and is
stopped on backgrounding.

## Threat and dependency review

`firebase_messaging 16.4.1` (Firebase/FlutterFire, BSD-3-Clause) is the
official FCM Flutter client and brings `firebase_core`; `firebase_core
4.11.0` is declared directly so initialization is explicit. Versions are
pinned through `pubspec.lock`. Firebase's Flutter setup requires a
deployment-specific configuration file, while the FCM guide specifies
`getToken`, `onTokenRefresh`, and Android auto-init controls. Those facts are
why configuration and sender credentials stay outside source control and why
the app enables token generation only after paired opt-in.

The remaining external requirements are: a private Firebase Android app
configuration matching `io.ccb.mobile.ccb_mobile`, a server-side FCM v1 sender
credential, gateway support for the route-only registration endpoint, and a
physical Android device or Google Play emulator test. Until those are supplied,
real delivery is blocked; local tests cover the app protocol and fail-closed
paths only.

## Foreground service decision

No Android foreground service is implemented in this change. The app has no
single native owner for an active terminal or large transfer connection, so a
notification-only service would be misleading and would not make SSE/polling a
valid background delivery mechanism. A future service may be considered only
behind a feature flag after it owns a user-visible active terminal or transfer,
declares an Android-supported service type, has stop/cancel semantics, and is
covered by emulator/device tests. It must not be used for push, idle polling,
or mutation replay.
