// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { ReceiverImpl } from "../../src/receivers/receiver";
import { createClientEntityContextForTests, getPromiseResolverForTest } from "./unittestUtils";
import { ClientEntityContext } from "../../src/clientEntityContext";
import { ReceiveOptions } from "../../src/core/messageReceiver";
import { OperationOptions, MessageHandlers } from "../../src";
import { StreamingReceiver } from "../../src/core/streamingReceiver";
import { AbortController, AbortSignalLike } from "@azure/abort-controller";
import { ReceiverEvents } from "rhea-promise";
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
        _messageHandlers: MessageHandlers<unknown>,
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

      await StreamingReceiver.create(
        createClientEntityContextForTests(),
        {
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          processError: async () => {},
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          processMessage: async () => {}
        },
        {
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
        }
      );

      assert.isTrue(wasCalled);
    });
  });

  describe.only("process* handlers", () => {
    let events: string[];
    let clientEntityContext: ClientEntityContext;

    beforeEach(() => {
      events = [];

      clientEntityContext = createClientEntityContextForTests({
        onCreateReceiverCalled: (receiver) => {
          receiver["addCredit"] = (_credit) => {
            if (receiver.drain === true) {
              receiver.emit(ReceiverEvents.receiverDrained);
            }
          };

          receiver["close"] = async () => {
            events.push("receiver itself is closed");
          };
        }
      });
    });

    it.only("streamingReceiver.close() handles the proper process* calling sequence.", async () => {
      const streamingReceiver = await StreamingReceiver.create(clientEntityContext, {
        processMessage: async (_msg: any) => {
          events.push("processMessage");
        },
        processError: async (err: Error) => {
          events.push(`processError: ${err.message}`);
        },
        processClose: async () => {
          events.push("processClose");
        },
        processOpen: async () => {
          events.push("processOpen");
        }
      });

      await streamingReceiver.close();
      assert.deepEqual(events, ["processOpen", "processClose", "receiver itself is closed"]);

      // sanity check - closing again doesnt cause everything to get called again.
      events.length = 0;
      await streamingReceiver.close();
      assert.isEmpty(events);
    });

    it.only("errors thrown in processClose() and processOpen() are routed to processError", async () => {
      const streamingReceiver = await StreamingReceiver.create(clientEntityContext, {
        processMessage: async (_msg: any) => {
          events.push("processMessage");
        },
        processError: async (err: Error) => {
          events.push(`processError: ${err.message}`);
          throw new Error("processError threw an error"); // NOTE: this just gets logged, we don't send it back into processError.
        },
        processClose: async () => {
          events.push("processClose");
          throw new Error("processClose threw an error");
        },
        processOpen: async () => {
          events.push("processOpen");
          throw new Error("processOpen threw an error");
        }
      });

      await streamingReceiver.close();
      assert.deepEqual(events, [
        "processOpen",
        "processError: processOpen threw an error",
        "processClose",
        "processError: processClose threw an error",
        "receiver itself is closed"
      ]);
    });

    it.only("we don't close the receiver until in-flight message handlers are stopped", () => {
      // if the user's message handler is still running we don't want to close.
      assert.fail("Not implemented yet");
    });
  });
});
