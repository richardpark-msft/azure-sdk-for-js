// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { SpanKind } from "@opentelemetry/api";

/**
 * Shorthand enum for common traceFlags values inside SpanContext
 */
export const enum TraceFlags {
  /** No flag set. */
  NONE = 0x0,
  /** Caller is collecting trace information. */
  SAMPLED = 0x1
}

/**
 * A light interface that tries to be structurally compatible with OpenTelemetry
 */
export interface SpanContext {
  /**
   * UUID of a trace.
   */
  traceId: string;
  /**
   * UUID of a Span.
   */
  spanId: string;
  /**
   * https://www.w3.org/TR/trace-context/#trace-flags
   */
  traceFlags: number;
}

/**
 * Context for the linked span.
 */
export type LinkContext = {
  traceId: string;
  spanId: string;
};

/**
 * Used to specify a span that is linked to another.
 */
export interface Link {
  /** The {@link LinkContext} of a linked span. */
  context: LinkContext;
}

/**
 * Attributes for a Span.
 */
export interface SpanAttributes {
  [attributeKey: string]: SpanAttributeValue | undefined;
}
/**
 * Attribute values may be any non-nullish primitive value except an object.
 *
 * null or undefined attribute values are invalid and will result in undefined behavior.
 */
export declare type SpanAttributeValue =
  | string
  | number
  | boolean
  | Array<null | undefined | string>
  | Array<null | undefined | number>
  | Array<null | undefined | boolean>;

/**
 * An interface that enables manual propagation of Spans
 */
export interface SpanOptions {
  /**
   * The SpanContext that refers to a parent span, if any.
   * A null value indicates that this should be a new root span,
   * rather than potentially detecting a span via a context manager.
   */
  parent?: SpanContext | null;
  /**
   * Attributes to set on the Span
   */
  attributes?: SpanAttributes;

  /** {@link Link}s span to other spans */
  links?: Link[];

  /**
   * The type of Span. Default to SpanKind.INTERNAL
   */
  kind?: SpanKind;
}

/**
 * Tracing options to set on an operation.
 */
export interface OperationTracingOptions {
  /**
   * OpenTelemetry SpanOptions used to create a span when tracing is enabled.
   */
  spanOptions?: SpanOptions;
}
