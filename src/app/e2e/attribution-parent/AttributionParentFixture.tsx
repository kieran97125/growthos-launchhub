"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ATTRIBUTION_BRIDGE_SCHEMA_VERSION,
  ATTRIBUTION_PAYLOAD_MESSAGE_TYPE,
  WIX_ATTRIBUTION_READY_MESSAGE_TYPE,
} from "@/lib/attribution/core";

function escapeForInlineScript(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function AttributionParentFixture() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    queueMicrotask(() => setOrigin(window.location.origin));
  }, []);

  const envelope = useMemo(() => {
    if (!origin) return null;
    const query = new URLSearchParams(window.location.search);
    const touch: Record<string, string> = {
      source_capture_method: "wix_page_code",
      attribution_source_used: "wix_parent_bridge",
      parent_url: window.location.href,
      current_page_url: window.location.href,
      landing_page_url: window.location.href,
      parent_origin: origin,
      captured_at: new Date().toISOString(),
    };
    query.forEach((value, key) => {
      if (value) touch[key] = value;
    });
    return {
      first_touch_json: touch,
      latest_touch_json: touch,
      submitted_touch_json: touch,
    };
  }, [origin]);

  useEffect(() => {
    if (!envelope || !origin) return;
    function onMessage(event: MessageEvent) {
      if (event.origin !== origin || event.source !== frameRef.current?.contentWindow) {
        return;
      }
      if (event.data?.type !== WIX_ATTRIBUTION_READY_MESSAGE_TYPE) return;
      frameRef.current?.contentWindow?.postMessage(
        {
          type: ATTRIBUTION_PAYLOAD_MESSAGE_TYPE,
          schema_version: ATTRIBUTION_BRIDGE_SCHEMA_VERSION,
          payload: envelope,
        },
        origin
      );
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [envelope, origin]);

  if (!origin) return null;
  const embedUrl = `${origin}/embed/e2e-form-token?form_id=e2e-form-id&parent_origin=${encodeURIComponent(origin)}`;
  const safeOrigin = escapeForInlineScript(origin);
  const safeEmbedUrl = escapeForInlineScript(embedUrl);
  const srcDoc = `<!doctype html><html><body style="margin:0"><iframe id="form" title="Campaign registration form" src="${safeEmbedUrl}" style="width:100%;height:960px;border:0"></iframe><script>(function(){var origin='${safeOrigin}';var form=document.getElementById('form');window.addEventListener('message',function(event){var data=event.data||{};if(event.origin!==origin)return;if(event.source===form.contentWindow&&data.type==='launchhub_iframe_ready'){window.parent.postMessage({type:'launchhub_wix_attribution_ready',schema_version:1},origin);return;}if(event.source===window.parent&&data.type==='launchhub_attribution_payload'){form.contentWindow.postMessage(data,origin);}});})();</script></body></html>`;

  return (
    <main>
      <iframe
        ref={frameRef}
        title="Wix HTML Component"
        srcDoc={srcDoc}
        className="h-[980px] w-full border-0"
      />
    </main>
  );
}
