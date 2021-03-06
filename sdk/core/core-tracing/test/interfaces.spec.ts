// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as assert from "assert";
import { SpanContext, TraceFlags, SpanOptions } from "../src";
import { SpanContext as OTSpanContext, SpanKind, SpanOptions as OTSpanOptions } from "@opentelemetry/api";

describe("interface compatibility", () => {
  it("SpanContext is assignable", () => {
    const context: SpanContext = {
      spanId: "",
      traceId: "",
      traceFlags: TraceFlags.NONE
    };

    const OTContext: OTSpanContext = context;
    const context2: SpanContext = OTContext;

    assert.ok(context2);
  });

  it("SpanOptions can be passed to OT", () => {
    const spanOptions: SpanOptions = {
      attributes: {
        "hello": "world"
      },
      kind: SpanKind.INTERNAL,
      links: [{
        context: {
          spanId: "",
          traceId: ""
        }
      }]
    };

    const oTSpanOptions: OTSpanOptions = spanOptions;
    assert.ok(oTSpanOptions);
  });
});
