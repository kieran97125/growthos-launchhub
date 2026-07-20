(function () {
  var ATTRIBUTION_KEYS = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_id",
    "utm_content",
    "utm_term",
    "fbclid",
    "fbp",
    "fbc",
    "gclid",
    "ttclid",
    "msclkid",
    "wbraid",
    "gbraid",
    "campaign_id",
    "adset_id",
    "ad_id",
    "ctwa_id",
    "ctwa_clid",
    "meta_ad_id",
    "meta_adset_id",
    "meta_campaign_id",
    "placement",
    "whatsapp_referral_source_id"
  ];
  var BACKUP_PARAM_MAP = {
    lh_source: "utm_source",
    lh_medium: "utm_medium",
    lh_campaign: "utm_campaign",
    lh_content: "utm_content",
    lh_term: "utm_term",
    lh_campaign_id: "campaign_id",
    lh_adset_id: "adset_id",
    lh_ad_id: "ad_id",
    lh_placement: "placement",
    lh_channel: "utm_source",
    lh_brand: "brand"
  };
  var ALL_ATTRIBUTION_KEYS = ATTRIBUTION_KEYS.concat(Object.keys(BACKUP_PARAM_MAP));
  var INVALID_VALUES = { undefined: true, null: true, nan: true, none: true };

  function cleanText(value) {
    if (value === null || value === undefined) return "";
    var cleaned = String(value).trim();
    return cleaned && !INVALID_VALUES[cleaned.toLowerCase()] ? cleaned : "";
  }

  function safeJsonParse(value) {
    try {
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  function createId(prefix) {
    var random = Math.random().toString(36).slice(2);
    return prefix + "_" + Date.now().toString(36) + "_" + random;
  }

  function readStorage(key, storage) {
    try {
      return safeJsonParse(storage.getItem(key));
    } catch {
      return null;
    }
  }

  function writeStorage(key, value, storage) {
    try {
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function normalizeAttributionFields(input) {
    var output = {};
    Object.keys(input || {}).forEach(function (key) {
      var value = input[key];
      if (typeof value === "string") {
        var cleaned = cleanText(value);
        if (cleaned) output[key] = cleaned;
      } else if (typeof value === "number" || typeof value === "boolean") {
        output[key] = value;
      }
    });

    Object.keys(BACKUP_PARAM_MAP).forEach(function (backupKey) {
      var canonicalKey = BACKUP_PARAM_MAP[backupKey];
      var value = output[backupKey];
      if (!value) return;
      if (!output[canonicalKey]) output[canonicalKey] = value;
    });

    if (!output.meta_campaign_id) {
      output.meta_campaign_id = output.campaign_id || output.lh_campaign_id || output.meta_campaign_id;
    }
    if (!output.meta_adset_id) {
      output.meta_adset_id = output.adset_id || output.lh_adset_id || output.meta_adset_id;
    }
    if (!output.meta_ad_id) {
      output.meta_ad_id = output.ad_id || output.lh_ad_id || output.meta_ad_id;
    }

    return output;
  }

  function mergeTouch(base, incoming) {
    return normalizeAttributionFields(
      Object.assign({}, normalizeAttributionFields(base), normalizeAttributionFields(incoming))
    );
  }

  function hasExplicitCtwa(touch) {
    var medium = cleanText(touch && (touch.utm_medium || touch.lh_medium)).toLowerCase();
    var referralType = cleanText(touch && touch.whatsapp_referral_source_type).toLowerCase();
    return Boolean(
      medium === "ctwa" ||
      referralType === "ctwa" ||
      cleanText(touch && touch.ctwa_id) ||
      cleanText(touch && touch.ctwa_clid) ||
      cleanText(touch && touch.whatsapp_referral_source_id)
    );
  }

  function evidenceScore(value) {
    var touch = normalizeAttributionFields(value);
    if (hasExplicitCtwa(touch)) return 500;
    var utmCount = ["utm_source", "utm_medium", "utm_campaign", "utm_id", "utm_content", "utm_term"]
      .filter(function (key) { return cleanText(touch[key]); }).length;
    if (utmCount >= 3) return 400 + utmCount;
    if (utmCount > 0) return 300 + utmCount;
    var clickCount = ["fbclid", "gclid", "ttclid", "msclkid", "wbraid", "gbraid"]
      .filter(function (key) { return cleanText(touch[key]); }).length;
    if (clickCount > 0) return 200 + clickCount;
    var campaignCount = [
      cleanText(touch.campaign_id || touch.meta_campaign_id),
      cleanText(touch.adset_id || touch.meta_adset_id),
      cleanText(touch.ad_id || touch.meta_ad_id),
      cleanText(touch.placement)
    ].filter(Boolean).length;
    if (campaignCount > 0) return 150 + campaignCount;
    var browserCount = ["fbp", "fbc"].filter(function (key) { return cleanText(touch[key]); }).length;
    if (cleanText(touch.referrer) || cleanText(touch.parent_url)) return 50 + browserCount;
    if (browserCount > 0) return 10 + browserCount;
    return 0;
  }

  function strongestTouch(candidates) {
    return candidates.reduce(function (best, candidate) {
      var next = normalizeAttributionFields(candidate);
      return evidenceScore(next) > evidenceScore(best) ? next : best;
    }, {});
  }

  function normalizeEnvelope(value) {
    var envelope = value && typeof value === "object" ? value : {};
    return {
      first_touch_json: normalizeAttributionFields(envelope.first_touch_json),
      latest_touch_json: normalizeAttributionFields(envelope.latest_touch_json),
      submitted_touch_json: normalizeAttributionFields(envelope.submitted_touch_json),
      locked_touch_json: normalizeAttributionFields(envelope.locked_touch_json)
    };
  }

  function pickParams(searchParams) {
    var output = {};
    ALL_ATTRIBUTION_KEYS.forEach(function (key) {
      var value = cleanText(searchParams.get(key));
      if (value) output[key] = value;
    });
    var cookieMap = { _fbp: "fbp", _fbc: "fbc" };
    document.cookie.split(";").forEach(function (item) {
      var pair = item.trim().split("=");
      var key = cookieMap[decodeURIComponent(pair.shift() || "")];
      var value = cleanText(decodeURIComponent(pair.join("=") || ""));
      if (key && value) output[key] = value;
    });
    return normalizeAttributionFields(output);
  }

  function getOrigin(value) {
    try {
      return value ? new URL(value).origin : "";
    } catch {
      return "";
    }
  }

  function getPathname(value) {
    try {
      return value ? new URL(value).pathname : window.location.pathname;
    } catch {
      return window.location.pathname;
    }
  }

  function isWixHtmlIframe() {
    return (window.location.hostname || "").indexOf("filesusr.com") !== -1;
  }

  function getRealParentPageUrl() {
    var referrer = document.referrer || "";

    if (isWixHtmlIframe() && referrer) {
      try {
        var referrerUrl = new URL(referrer);

        if (
          referrerUrl.protocol === "https:" &&
          referrerUrl.hostname.indexOf("filesusr.com") === -1
        ) {
          return referrerUrl.toString();
        }
      } catch {
      }
    }

    return window.location.href;
  }

  function mergeSearchParams(primaryUrl, fallbackSearch) {
    var output = new URLSearchParams();

    try {
      new URL(primaryUrl).searchParams.forEach(function (value, key) {
        if (value) output.set(key, value);
      });
    } catch {
    }

    try {
      new URLSearchParams(fallbackSearch || "").forEach(function (value, key) {
        if (value && !output.has(key)) output.set(key, value);
      });
    } catch {
    }

    return output;
  }

  function isLazyLoadEnabled(value) {
    return value === "true" || value === "1";
  }

  function getLazyRootMargin(value) {
    var cleaned = typeof value === "string" ? value.trim() : "";
    return cleaned || "600px";
  }

  function clampEmbedHeight(value) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) return 500;
    return Math.max(480, Math.min(Math.ceil(parsed), 2200));
  }

  function createPlaceholder() {
    var placeholder = document.createElement("div");
    placeholder.setAttribute("aria-live", "polite");
    placeholder.style.boxSizing = "border-box";
    placeholder.style.width = "100%";
    placeholder.style.minHeight = "96px";
    placeholder.style.display = "flex";
    placeholder.style.alignItems = "center";
    placeholder.style.justifyContent = "center";
    placeholder.style.border = "1px solid rgba(148, 163, 184, 0.28)";
    placeholder.style.borderRadius = "18px";
    placeholder.style.background = "rgba(248, 250, 252, 0.86)";
    placeholder.style.color = "#475569";
    placeholder.style.font = "600 13px/1.5 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    placeholder.style.margin = "0";
    placeholder.style.padding = "16px";
    placeholder.textContent = "LaunchHub form loading...";
    return placeholder;
  }

  function classifyStorageStatus(localSaved, sessionSaved) {
    if (localSaved && sessionSaved) return "storage_available";
    if (localSaved) return "session_storage_blocked";
    if (sessionSaved) return "local_storage_blocked";
    return "storage_blocked";
  }

  function classifyDebugPayload(payload) {
    var utmCount = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_id",
      "utm_content",
      "utm_term"
    ].filter(function (key) {
      return payload[key];
    }).length;
    var hasClickId = Boolean(
      payload.fbclid ||
      payload.gclid ||
      payload.ttclid ||
      payload.msclkid ||
      payload.wbraid ||
      payload.gbraid
    );
    var hasMetaIds = Boolean(
      payload.meta_campaign_id ||
      payload.meta_adset_id ||
      payload.meta_ad_id
    );
    var hasReferrer = Boolean(payload.referrer || payload.current_page_url || payload.landing_page_url);

    if (utmCount >= 3) {
      return { tracking_status: "complete_utm", audit_reason: "utm_found_on_parent_url" };
    }

    if (utmCount > 0) {
      return { tracking_status: "partial_utm", audit_reason: "iframe_received_parent_payload" };
    }

    if (hasClickId || hasMetaIds) {
      return { tracking_status: "click_id_only", audit_reason: "click_or_meta_id_found_without_utm" };
    }

    if (payload.source_capture_method === "parent_embed_script_local_storage_recovered") {
      return { tracking_status: "storage_recovered", audit_reason: "recovered_from_local_storage" };
    }

    if (payload.source_capture_method === "parent_embed_script_session_storage_recovered") {
      return { tracking_status: "storage_recovered", audit_reason: "recovered_from_session_storage" };
    }

    if (hasReferrer) {
      return { tracking_status: "referrer_only", audit_reason: "organic_assigned_due_to_no_tracking_signal" };
    }

    return { tracking_status: "organic_unknown", audit_reason: "no_url_params_no_storage" };
  }

  try {
    var script = document.currentScript;
    if (!script) return;

    var formToken = script.getAttribute("data-form-token") || "";
    var brand = script.getAttribute("data-brand") || "";
    var formId = script.getAttribute("data-form-id") || "";
    if (!formToken) {
      console.error("[LaunchHub] Missing required data-form-token on embed script.");
      return;
    }
    var targetId = script.getAttribute("data-target-id") || "";
    var targetSelector = script.getAttribute("data-target") || "";
    var lazyLoad = isLazyLoadEnabled(script.getAttribute("data-lazy-load"));
    var lazyRootMargin = getLazyRootMargin(script.getAttribute("data-lazy-root-margin"));
    var iframeLoaded = false;
    var height = clampEmbedHeight(script.getAttribute("data-height") || "500");
    var scriptOrigin = new URL(script.src).origin;
    var embedOrigin = scriptOrigin;
    var parentPageUrl = getRealParentPageUrl();
    var parentOrigin = getOrigin(parentPageUrl) || window.location.origin;
    var wixParentOrigin = getOrigin(document.referrer);
    var rawScope = script.getAttribute("data-attribution-scope") || formId || "unscoped";
    var safeScope = rawScope.replace(/[^a-zA-Z0-9_-]+/g, "-");
    var storageNamespace = "launchhub:attribution:v1:" + safeScope;
    var localKey = storageNamespace + ":first";
    var sessionKey = storageNamespace + ":latest";
    var lockedKey = storageNamespace + ":locked";
    var visitorKey = storageNamespace + ":visitor";
    var sessionIdKey = storageNamespace + ":session";
    var searchParams = mergeSearchParams(parentPageUrl, window.location.search);
    var visitorId = readStorage(visitorKey, window.localStorage) || createId("vis");
    var sessionId = readStorage(sessionIdKey, window.sessionStorage) || createId("ses");

    var paramPayload = pickParams(searchParams);
    var legacyFirst = readStorage("launchhub_first_touch", window.localStorage);
    var legacyLatest = readStorage("launchhub_latest_touch", window.sessionStorage);
    if (!legacyFirst || cleanText(legacyFirst.form_id) !== formId) legacyFirst = {};
    if (!legacyLatest || cleanText(legacyLatest.form_id) !== formId) legacyLatest = {};
    var firstStored = strongestTouch([
      readStorage(lockedKey, window.localStorage),
      readStorage(lockedKey, window.sessionStorage),
      readStorage(localKey, window.localStorage),
      legacyFirst
    ]);
    var latestStored = mergeTouch(
      readStorage(sessionKey, window.sessionStorage),
      legacyLatest
    );
    var hasCurrentParams = evidenceScore(paramPayload) >= 150;
    var captureMethod = hasCurrentParams
      ? "parent_embed_script"
      : evidenceScore(latestStored) > 0
        ? "parent_embed_script_session_storage_recovered"
        : evidenceScore(firstStored) > 0
          ? "parent_embed_script_local_storage_recovered"
          : "parent_embed_script_no_tracking_signal";

    var basePayload = {
      source_capture_method: captureMethod,
      visitor_id: visitorId,
      session_id: sessionId,
      brand: brand,
      form_id: formId,
      parent_origin: parentOrigin,
      referrer: document.referrer || "",
      landing_page_url: firstStored && firstStored.landing_page_url ? firstStored.landing_page_url : parentPageUrl,
      current_page_url: parentPageUrl,
      page_path: getPathname(parentPageUrl),
      page_title: document.title || "",
      captured_at: new Date().toISOString()
    };
    var currentTouch = mergeTouch(basePayload, paramPayload);
    currentTouch.source_capture_method = captureMethod;
    var latestTouch = mergeTouch(latestStored, currentTouch);
    var firstTouch = strongestTouch([firstStored, currentTouch]);
    var localSaved = writeStorage(localKey, firstTouch, window.localStorage);
    var sessionSaved = writeStorage(sessionKey, latestTouch, window.sessionStorage);
    writeStorage(visitorKey, visitorId, window.localStorage);
    writeStorage(sessionIdKey, sessionId, window.sessionStorage);

    var debugClassification = classifyDebugPayload(latestTouch);
    var submittedTouch = Object.assign({}, latestTouch, {
      source_capture_method: captureMethod,
      storage_status: classifyStorageStatus(localSaved, sessionSaved),
      tracking_status: debugClassification.tracking_status,
      audit_reason: debugClassification.audit_reason
    });
    var lockedTouch = strongestTouch([
      readStorage(lockedKey, window.localStorage),
      readStorage(lockedKey, window.sessionStorage),
      firstTouch,
      submittedTouch
    ]);
    writeStorage(lockedKey, lockedTouch, window.localStorage);
    writeStorage(lockedKey, lockedTouch, window.sessionStorage);

    function applyParentAttributionEnvelope(envelopeValue) {
      var envelope = normalizeEnvelope(envelopeValue);
      var incomingScore = Math.max(
        evidenceScore(envelope.first_touch_json),
        evidenceScore(envelope.latest_touch_json),
        evidenceScore(envelope.submitted_touch_json)
      );
      if (incomingScore <= 0) return false;

      firstTouch = strongestTouch([
        lockedTouch,
        firstTouch,
        envelope.locked_touch_json,
        envelope.first_touch_json,
        envelope.latest_touch_json,
        envelope.submitted_touch_json
      ]);
      latestTouch = mergeTouch(latestTouch, envelope.latest_touch_json);
      submittedTouch = mergeTouch(
        mergeTouch(submittedTouch, envelope.latest_touch_json),
        envelope.submitted_touch_json
      );
      latestTouch.source_capture_method =
        cleanText(envelope.latest_touch_json.source_capture_method) ||
        "wix_page_code";
      submittedTouch.source_capture_method =
        cleanText(envelope.submitted_touch_json.source_capture_method) ||
        latestTouch.source_capture_method;
      parentPageUrl =
        cleanText(submittedTouch.parent_url) ||
        cleanText(submittedTouch.current_page_url) ||
        parentPageUrl;
      parentOrigin =
        cleanText(submittedTouch.parent_origin) ||
        getOrigin(parentPageUrl) ||
        parentOrigin;
      lockedTouch = strongestTouch([
        lockedTouch,
        firstTouch,
        envelope.locked_touch_json,
        envelope.first_touch_json,
        envelope.latest_touch_json,
        envelope.submitted_touch_json
      ]);
      writeStorage(localKey, firstTouch, window.localStorage);
      writeStorage(sessionKey, latestTouch, window.sessionStorage);
      writeStorage(lockedKey, lockedTouch, window.localStorage);
      writeStorage(lockedKey, lockedTouch, window.sessionStorage);

      debugClassification = classifyDebugPayload(submittedTouch);
      submittedTouch.tracking_status = debugClassification.tracking_status;
      submittedTouch.audit_reason = debugClassification.audit_reason;
      if (typeof iframeUrl !== "undefined" && iframeUrl) {
        Object.keys(submittedTouch).forEach(function (key) {
          if (ATTRIBUTION_KEYS.indexOf(key) !== -1 && cleanText(submittedTouch[key])) {
            iframeUrl.searchParams.set(key, submittedTouch[key]);
          }
        });
        iframeUrl.searchParams.set("parent_url", parentPageUrl);
        iframeUrl.searchParams.set("parent_origin", parentOrigin);
      }
      sendAttribution();
      return true;
    }

    function requestWixParentAttribution() {
      if (!window.parent || window.parent === window || !wixParentOrigin) return;
      window.parent.postMessage(
        {
          type: "launchhub_wix_attribution_ready",
          schema_version: 1,
          form_token: formToken
        },
        wixParentOrigin
      );
    }
    var debugPayload = {
      submitted_touch_json: submittedTouch,
      tracking_status: debugClassification.tracking_status,
      audit_reason: debugClassification.audit_reason
    };

    window.__LAUNCHHUB_LEAD_CAPTURE_DEBUG__ = debugPayload;

    try {
      window.dispatchEvent(new CustomEvent("launchhub:attribution-captured", { detail: debugPayload }));
    } catch {
    }

    var iframeUrl = new URL(embedOrigin + "/embed/" + encodeURIComponent(formToken));
    if (brand) iframeUrl.searchParams.set("brand", brand);
    if (formId) iframeUrl.searchParams.set("form_id", formId);
    Object.keys(paramPayload).forEach(function (key) {
      iframeUrl.searchParams.set(key, paramPayload[key]);
    });
    iframeUrl.searchParams.set("parent_url", parentPageUrl);
    iframeUrl.searchParams.set("parent_origin", parentOrigin);

    var iframe = document.createElement("iframe");
    iframe.width = "100%";
    iframe.height = String(height);
    iframe.style.border = "0";
    iframe.style.width = "100%";
    iframe.style.maxWidth = "100%";
    iframe.style.minHeight = "480px";
    iframe.style.height = height + "px";
    iframe.style.overflow = "hidden";
    iframe.style.display = "block";
    iframe.style.margin = "0";
    iframe.style.padding = "0";
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute("title", "Campaign registration form");

    function loadIframe(container, placeholder) {
      if (iframeLoaded) return;
      iframeLoaded = true;
      iframe.src = iframeUrl.toString();

      if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.replaceChild(iframe, placeholder);
      } else if (container && !iframe.parentNode) {
        container.appendChild(iframe);
      } else if (script.parentNode && !iframe.parentNode) {
        script.parentNode.insertBefore(iframe, script.nextSibling);
      }
    }

    function setupLazyLoad(container, placeholder) {
      if (!("IntersectionObserver" in window)) {
        loadIframe(container, placeholder);
        return;
      }

      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            observer.disconnect();
            loadIframe(container, placeholder);
          });
        },
        { rootMargin: lazyRootMargin }
      );

      observer.observe(placeholder || container);
    }

    function sendAttribution() {
      if (!iframe.contentWindow) return;
      var payload = {
        first_touch_json: firstTouch,
        latest_touch_json: latestTouch,
        submitted_touch_json: submittedTouch,
        locked_touch_json: lockedTouch
      };
      iframe.contentWindow.postMessage(
        {
          type: "launchhub_attribution_payload",
          schema_version: 1,
          payload: payload
        },
        embedOrigin
      );
    }

    iframe.addEventListener("load", sendAttribution);
    window.addEventListener("message", function (event) {
      var data = event.data || {};
      var isWixAttributionMessage =
        event.source === window.parent &&
        data.type === "launchhub_attribution_payload";

      if (isWixAttributionMessage) {
        if (!wixParentOrigin || event.origin !== wixParentOrigin) return;
        if (data.schema_version !== undefined && data.schema_version !== 1) return;
        applyParentAttributionEnvelope(data.payload || {});
        return;
      }

      if (event.origin !== embedOrigin || event.source !== iframe.contentWindow) return;
      if (
        data.type === "launchhub:resize" &&
        data.source === "launchhub-form" &&
        (!data.formToken || data.formToken === formToken)
      ) {
        var nextHeight = clampEmbedHeight(data.height);
        iframe.height = String(nextHeight);
        iframe.style.height = nextHeight + "px";
      }
      if (data.type === "launchhub_iframe_ready") {
        sendAttribution();
      }
      if (
        data.type === "launchhub:form-submitted" &&
        data.event === "CompleteRegistration"
      ) {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(data, wixParentOrigin || window.location.origin);
        }
      }
    });
    requestWixParentAttribution();
    [250, 1000, 2500].forEach(function (delay) {
      window.setTimeout(requestWixParentAttribution, delay);
    });

    var target = targetId ? document.getElementById(targetId) : null;
    if (!target && targetSelector) {
      try {
        target = document.querySelector(targetSelector);
      } catch {
        target = null;
      }
    }
    if (target) {
      target.innerHTML = "";
      if (lazyLoad) {
        var targetPlaceholder = createPlaceholder();
        target.appendChild(targetPlaceholder);
        setupLazyLoad(target, targetPlaceholder);
      } else {
        target.appendChild(iframe);
        loadIframe(target);
      }
    } else if (script.parentNode) {
      if (lazyLoad) {
        var inlinePlaceholder = createPlaceholder();
        script.parentNode.insertBefore(inlinePlaceholder, script.nextSibling);
        setupLazyLoad(null, inlinePlaceholder);
      } else {
        script.parentNode.insertBefore(iframe, script.nextSibling);
        loadIframe(null);
      }
    }
  } catch (error) {
    console.error("[LaunchHub] Embed failed:", error);
  }
})();
