"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ATTRIBUTION_BRIDGE_SCHEMA_VERSION,
  ATTRIBUTION_PAYLOAD_MESSAGE_TYPE,
  ATTRIBUTION_READY_MESSAGE_TYPE,
  attributionMessageHasSupportedSchema,
  hasAttributionEnvelopeTracking,
  mergeAttributionEnvelopes,
  normalizeAttributionEnvelope,
  type AttributionEnvelope,
} from "./core";
import {
  captureBrowserAttribution,
  persistBrowserAttributionEnvelope,
} from "./browser";

type Input = {
  enabled?: boolean;
  scopeKey: string;
  formToken: string;
  formId: string;
  brandSlug: string;
  expectedParentOrigin?: string;
  mode: "inline" | "embed";
  sourceCaptureMethod: "public_landing_page" | "public_embed_form";
  initialQueryString?: string;
  onParentAttribution?: (
    envelope: AttributionEnvelope,
    message: MessageEvent
  ) => void;
};

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function immediateParentOrigin(expectedParentOrigin?: string) {
  if (typeof document === "undefined") return "";
  return normalizeOrigin(document.referrer) || normalizeOrigin(expectedParentOrigin);
}

export function useAttributionBridge({
  enabled = true,
  scopeKey,
  formToken,
  formId,
  brandSlug,
  expectedParentOrigin,
  mode,
  sourceCaptureMethod,
  initialQueryString,
  onParentAttribution,
}: Input) {
  const [attribution, setAttribution] = useState<AttributionEnvelope>({});
  const attributionRef = useRef<AttributionEnvelope>({});
  const parentAttributionRef = useRef<AttributionEnvelope | null>(null);
  const waitersRef = useRef<
    Array<(value: AttributionEnvelope | null) => void>
  >([]);
  const parentCallbackRef = useRef(onParentAttribution);

  useEffect(() => {
    parentCallbackRef.current = onParentAttribution;
  }, [onParentAttribution]);

  const captureNow = useCallback(() => {
    if (!enabled) return attributionRef.current;
    const captured = captureBrowserAttribution({
      scopeKey,
      formToken,
      formId,
      brandSlug,
      sourceCaptureMethod,
      initialQueryString,
    });
    const merged = mergeAttributionEnvelopes(
      attributionRef.current,
      captured
    );
    attributionRef.current = merged;
    persistBrowserAttributionEnvelope(scopeKey, merged);
    setAttribution(merged);
    return merged;
  }, [
    brandSlug,
    enabled,
    formId,
    formToken,
    initialQueryString,
    scopeKey,
    sourceCaptureMethod,
  ]);

  const postReady = useCallback(() => {
    if (
      !enabled ||
      mode !== "embed" ||
      typeof window === "undefined" ||
      !window.parent ||
      window.parent === window
    ) {
      return;
    }
    const targetOrigin = immediateParentOrigin(expectedParentOrigin);
    if (!targetOrigin) return;
    window.parent.postMessage(
      {
        type: ATTRIBUTION_READY_MESSAGE_TYPE,
        schema_version: ATTRIBUTION_BRIDGE_SCHEMA_VERSION,
        form_token: formToken,
      },
      targetOrigin
    );
  }, [enabled, expectedParentOrigin, formToken, mode]);

  useLayoutEffect(() => {
    captureNow();
  }, [captureNow]);

  useEffect(() => {
    const waiters = waitersRef.current;
    function onMessage(event: MessageEvent) {
      if (
        !enabled ||
        mode !== "embed" ||
        !window.parent ||
        window.parent === window ||
        event.source !== window.parent
      ) {
        return;
      }
      const allowedOrigin = immediateParentOrigin(expectedParentOrigin);
      if (!allowedOrigin || normalizeOrigin(event.origin) !== allowedOrigin) return;
      if (event.data?.type !== ATTRIBUTION_PAYLOAD_MESSAGE_TYPE) return;
      if (!attributionMessageHasSupportedSchema(event.data)) return;

      const incoming = normalizeAttributionEnvelope(event.data?.payload);
      if (!hasAttributionEnvelopeTracking(incoming)) return;
      const merged = mergeAttributionEnvelopes(
        attributionRef.current,
        incoming
      );
      attributionRef.current = merged;
      parentAttributionRef.current = incoming;
      persistBrowserAttributionEnvelope(scopeKey, merged);
      setAttribution(merged);
      waitersRef.current.splice(0).forEach((resolve) => resolve(incoming));
      parentCallbackRef.current?.(merged, event);
    }

    window.addEventListener("message", onMessage);
    postReady();
    const timers = [250, 1000].map((delay) =>
      window.setTimeout(postReady, delay)
    );
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("message", onMessage);
      waiters.splice(0).forEach((resolve) => resolve(null));
    };
  }, [enabled, expectedParentOrigin, mode, postReady, scopeKey]);

  const attributionForSubmit = useCallback(async () => {
    let live = captureNow();
    if (
      mode !== "embed" ||
      typeof window === "undefined" ||
      !window.parent ||
      window.parent === window ||
      parentAttributionRef.current
    ) {
      return live;
    }

    const incoming = await new Promise<AttributionEnvelope | null>((resolve) => {
      let settled = false;
      const finish = (value: AttributionEnvelope | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      waitersRef.current.push(finish);
      postReady();
      window.setTimeout(() => finish(parentAttributionRef.current), 700);
    });
    live = mergeAttributionEnvelopes(live, incoming);
    attributionRef.current = live;
    persistBrowserAttributionEnvelope(scopeKey, live);
    setAttribution(live);
    return live;
  }, [captureNow, mode, postReady, scopeKey]);

  return { attribution, captureNow, attributionForSubmit };
}
