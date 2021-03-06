// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// TODO: this code is a straight-copy from EventHubs. Need to merge.

import { SpanStatusCode, Span, SpanContext } from "@opentelemetry/api";
import { OperationOptions } from "@azure/core-http";
import { OperationTracingOptions } from "@azure/core-tracing";

/**
 * NOTE: This type is intended to mirror the relevant fields and structure from `@azure/core-http` OperationOptions
 *
 * Options for configuring tracing and the abortSignal.
 */
export type OperationOptionsBase = Pick<OperationOptions, "abortSignal" | "tracingOptions">;

/**
 * The set of options to manually propagate `Span` context for distributed tracing.
 */
export interface TryAddOptions {
  /**
   * The options to use when creating Spans for tracing.
   */
  tracingOptions?: OperationTracingOptions;

  /**
   * @deprecated Tracing options have been moved to the `tracingOptions` property.
   */
  parentSpan?: Span | SpanContext;
}

/**
 * Runs the `fn` passed in and marks the span as completed with an error (and the
 * corresponding message) or as OK.
 *
 * @hidden
 * @internal
 */
export async function trace<T>(fn: () => Promise<T>, span: Span): Promise<T> {
  try {
    const ret = await fn();
    span.setStatus({ code: SpanStatusCode.OK });
    return ret;
  } catch (err) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: err.message
    });
    throw err;
  } finally {
    span.end();
  }
}
