// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { ReceiverImpl } from "../../src/receivers/receiver";
import { createClientEntityContextForTests, getPromiseResolverForTest } from "./unittestUtils";
import { ClientEntityContext } from "../../src/clientEntityContext";
import { ReceiveOptions } from "../../src/core/messageReceiver";
import { OperationOptions } from "../../src";
import { StreamingReceiver } from "../../src/core/streamingReceiver";
import { AbortController, AbortSignalLike } from "@azure/abort-controller";
chai.use(chaiAsPromised);
const assert = chai.assert;

describe("StreamingReceiver unit tests", () => {
  describe("AbortSignal", () => {
    it("sanity check - abortSignal is propagated", async () => {
      const receiverImpl = new ReceiverImpl(createClientEntityContextForTests(), "peekLock");

      const abortController = new AbortController();
      const abortSignal = abortController.signal;

      const { resolve, promise } = getPromiseResolverForTest();

      receiverImpl["_createStreamingReceiver"] = async (
        _context: ClientEntityContext,
        options?: ReceiveOptions &
          Pick<OperationOptions, "abortSignal"> & {
            createStreamingReceiver?: (
              context: ClientEntityContext,
              options?: ReceiveOptions
            ) => StreamingReceiver;
          }
      ) => {
        assert.equal(abortSignal, options?.abortSignal, "abortSignal is properly passed through");
        resolve();
        return {} as StreamingReceiver;
      };

      const errors: string[] = [];

      receiverImpl.subscribe(
        {
          processMessage: async () => {},
          processError: async (err) => {
            errors.push(err.message);
          }
        },
        {
          abortSignal
        }
      );

      await promise;
      assert.isEmpty(errors);
    }).timeout(2000); // just for safety

    it("sanity check - abortSignal is propagated to _init()", async () => {
      let wasCalled = false;
      const abortController = new AbortController();

      await StreamingReceiver.create(createClientEntityContextForTests(), {
        _createStreamingReceiver: (_context, _options) => {
          wasCalled = true;
          return ({
            _init: (_ignoredOptions: any, abortSignal?: AbortSignalLike) => {
              wasCalled = true;
              assert.equal(
                abortSignal,
                abortController.signal,
                "abortSignal passed in when created should propagate to _init()"
              );
              return;
            }
          } as any) as StreamingReceiver;
        },
        abortSignal: abortController.signal
      });

      assert.isTrue(wasCalled);
    });
  });

  describe("process* handlers", () => {
    it("processClose() is called if the entire receiver is shut down", () => {
      assert.fail("Not implemented");
    });
    it("processClose() is not called multiple times if the receiver is closed and it was manually stopped.", () => {
      assert.fail("Not implemented");
    });
    it("processOpen and processClose are called for sessions", async () => {
      assert.fail("Not implemented");
    });

    // TODO: this is a `MessageSession` test. (same for all tests applies above)
    it("processOpen and processClose are called for non-sessions", async () => {
      assert.fail("Not implemented");
    });
  });
});
