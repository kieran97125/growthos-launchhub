"use client";

import {
  PUBLIC_ATTRIBUTION_PARAM_KEYS,
  attributionEvidenceScore,
  attributionStorageNamespace,
  mergeAttributionEnvelopes,
  mergeAttributionTouches,
  normalizeAttributionEnvelope,
  normalizeAttributionTouch,
  strongestAttributionTouch,
  type AttributionEnvelope,
} from "./core";
import { cleanAttributionText } from "./values";

type BrowserAttributionInput = {
  scopeKey: string;
  formToken: string;
  formId: string;
  brandSlug: string;
  sourceCaptureMethod: "public_landing_page" | "public_embed_form";
  initialQueryString?: string;
};

function safeJsonParse(value: string | null) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function readStorage(storage: Storage, key: string) {
  try {
    return normalizeAttributionTouch(safeJsonParse(storage.getItem(key)));
  } catch {
    return {};
  }
}

function writeStorage(storage: Storage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2)}`;
}

function readCookie(name: string) {
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
}

function pickTrackingParams(searchParams: URLSearchParams) {
  const output: Record<string, string> = {};
  PUBLIC_ATTRIBUTION_PARAM_KEYS.forEach((key) => {
    const value = cleanAttributionText(searchParams.get(key));
    if (value) output[key] = value;
  });

  const fbp = cleanAttributionText(readCookie("_fbp"));
  const fbc = cleanAttributionText(readCookie("_fbc"));
  if (fbp) output.fbp = fbp;
  if (fbc) output.fbc = fbc;
  return normalizeAttributionTouch(output);
}

function legacyTouchForForm(storage: Storage, key: string, formId: string) {
  const touch = readStorage(storage, key);
  return cleanAttributionText(touch.form_id) === formId ? touch : {};
}

function storageKeys(scopeKey: string) {
  const namespace = attributionStorageNamespace(scopeKey);
  return {
    first: `${namespace}:first`,
    latest: `${namespace}:latest`,
    locked: `${namespace}:locked`,
    visitor: `${namespace}:visitor`,
    session: `${namespace}:session`,
  };
}

export function persistBrowserAttributionEnvelope(
  scopeKey: string,
  envelopeValue: AttributionEnvelope
) {
  if (typeof window === "undefined") return;
  const keys = storageKeys(scopeKey);
  const envelope = normalizeAttributionEnvelope(envelopeValue);
  const existingFirst = readStorage(window.localStorage, keys.first);
  const first = strongestAttributionTouch([
    existingFirst,
    envelope.first_touch_json,
  ]);
  const locked = strongestAttributionTouch([
    readStorage(window.localStorage, keys.locked),
    readStorage(window.sessionStorage, keys.locked),
    envelope.locked_touch_json,
    first,
    envelope.latest_touch_json,
    envelope.submitted_touch_json,
  ]);

  if (attributionEvidenceScore(first) > 0) {
    writeStorage(window.localStorage, keys.first, first);
  }
  if (attributionEvidenceScore(envelope.latest_touch_json) > 0) {
    writeStorage(window.sessionStorage, keys.latest, envelope.latest_touch_json);
  }
  if (attributionEvidenceScore(locked) > 0) {
    writeStorage(window.localStorage, keys.locked, locked);
    writeStorage(window.sessionStorage, keys.locked, locked);
  }
}

export function captureBrowserAttribution({
  scopeKey,
  formToken,
  formId,
  brandSlug,
  sourceCaptureMethod,
  initialQueryString,
}: BrowserAttributionInput): AttributionEnvelope {
  if (typeof window === "undefined") return {};
  const keys = storageKeys(scopeKey);
  const query =
    initialQueryString === undefined
      ? window.location.search
      : initialQueryString;
  const params = pickTrackingParams(
    new URLSearchParams(query.startsWith("?") ? query.slice(1) : query)
  );
  const scopedFirst = readStorage(window.localStorage, keys.first);
  const scopedLatest = readStorage(window.sessionStorage, keys.latest);
  const scopedLocked = strongestAttributionTouch([
    readStorage(window.localStorage, keys.locked),
    readStorage(window.sessionStorage, keys.locked),
  ]);

  // One-time safe compatibility: only reuse old unscoped records when they
  // explicitly belong to this exact form. Never import a different form's data.
  const legacyFirst = legacyTouchForForm(
    window.localStorage,
    "launchhub_first_touch",
    formId
  );
  const legacyLatest = legacyTouchForForm(
    window.sessionStorage,
    "launchhub_latest_touch",
    formId
  );
  const storedFirst = strongestAttributionTouch([
    scopedLocked,
    scopedFirst,
    legacyFirst,
  ]);
  const storedLatest = mergeAttributionTouches(scopedLatest, legacyLatest);

  const visitorId =
    cleanAttributionText(safeJsonParse(window.localStorage.getItem(keys.visitor))) ||
    createId("vis");
  const sessionId =
    cleanAttributionText(safeJsonParse(window.sessionStorage.getItem(keys.session))) ||
    createId("ses");
  const hasCurrentAcquisition = attributionEvidenceScore(params) >= 150;
  const recovery =
    attributionEvidenceScore(storedLatest) > 0
      ? "session_storage_recovered"
      : attributionEvidenceScore(storedFirst) > 0
        ? "local_storage_recovered"
        : "no_tracking_signal";
  const captureMethod = hasCurrentAcquisition
    ? sourceCaptureMethod
    : `${sourceCaptureMethod}_${recovery}`;
  const now = new Date().toISOString();
  const base = normalizeAttributionTouch({
    source_capture_method: captureMethod,
    visitor_id: visitorId,
    session_id: sessionId,
    brand: brandSlug,
    form_id: formId,
    form_token: formToken,
    parent_origin: window.location.origin,
    referrer: document.referrer || "",
    landing_page_url:
      cleanAttributionText(storedFirst.landing_page_url, 2000) ||
      window.location.href,
    current_page_url: window.location.href,
    page_path: window.location.pathname,
    page_title: document.title || "",
    captured_at: now,
  });
  const currentTouch = mergeAttributionTouches(base, params);
  const firstTouch = strongestAttributionTouch([
    scopedLocked,
    storedFirst,
    currentTouch,
  ]);
  const latestTouch = mergeAttributionTouches(storedLatest, currentTouch);
  // A clean iframe follow-up should refresh page/session metadata without
  // rewriting the verified acquisition path supplied by the Wix parent.
  latestTouch.source_capture_method = hasCurrentAcquisition
    ? captureMethod
    : cleanAttributionText(storedLatest.source_capture_method, 120) ||
      captureMethod;
  const localSaved = writeStorage(window.localStorage, keys.first, firstTouch);
  const sessionSaved = writeStorage(
    window.sessionStorage,
    keys.latest,
    latestTouch
  );
  writeStorage(window.localStorage, keys.visitor, visitorId);
  writeStorage(window.sessionStorage, keys.session, sessionId);

  const envelope = mergeAttributionEnvelopes(
    {
      first_touch_json: firstTouch,
      latest_touch_json: latestTouch,
      submitted_touch_json: {
        ...latestTouch,
        storage_status:
          localSaved && sessionSaved
            ? "storage_available"
            : localSaved
              ? "session_storage_blocked"
              : sessionSaved
                ? "local_storage_blocked"
                : "storage_blocked",
      },
      locked_touch_json: scopedLocked,
    },
    null
  );
  persistBrowserAttributionEnvelope(scopeKey, envelope);
  return envelope;
}
