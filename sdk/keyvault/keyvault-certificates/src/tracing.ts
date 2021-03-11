// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { createSpanFunction, OperationTracingOptions } from "@azure/core-tracing";
import { Span } from "@azure/core-tracing";

/*
 * @internal
 */
export const createSpan: <T extends {
  tracingOptions?: OperationTracingOptions | undefined;
}>(
  operationName: string,
  operationOptions: T | undefined
) => {
  span: Span;
  updatedOptions: T;
} = createSpanFunction({
  packagePrefix: "CertificateClient",
  namespace: "Microsoft.KeyVault"
});
