// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import {
  MessageReceiver,
  OnError,
  OnMessage,
  ReceiveOptions,
  ReceiverType
} from "./messageReceiver";

import { ClientEntityContext } from "../clientEntityContext";

import * as log from "../log";
import { throwErrorIfConnectionClosed } from "../util/errors";
import { RetryOperationType, RetryConfig, retry } from "@azure/core-amqp";
import { OperationOptions } from "../modelsToBeSharedWithEventHubs";
import { AbortSignalLike } from "@azure/abort-controller";
import { Receiver, ReceiverEvents } from "rhea-promise";
import { waitForTimeoutOrAbortOrResolve } from "../util/utils";

/**
 * @internal
 * Describes the streaming receiver where the user can receive the message
 * by providing handler functions.
 * @class StreamingReceiver
 * @extends MessageReceiver
 */
export class StreamingReceiver extends MessageReceiver {
  /**
   * Instantiate a new Streaming receiver for receiving messages with handlers.
   *
   * @constructor
   * @param {ClientEntityContext} context                      The client entity context.
   * @param {ReceiveOptions} [options]                         Options for how you'd like to connect.
   */
  constructor(context: ClientEntityContext, options?: ReceiveOptions) {
    super(context, ReceiverType.streaming, options);

    this.resetTimerOnNewMessageReceived = () => {
      if (this._newMessageReceivedTimer) clearTimeout(this._newMessageReceivedTimer);
      if (this.newMessageWaitTimeoutInMs) {
        this._newMessageReceivedTimer = setTimeout(async () => {
          const msg =
            `StreamingReceiver '${this.name}' did not receive any messages in ` +
            `the last ${this.newMessageWaitTimeoutInMs} milliseconds. ` +
            `Hence ending this receive operation.`;
          log.error("[%s] %s", this._context.namespace.connectionId, msg);

          await this.close();
        }, this.newMessageWaitTimeoutInMs);
      }
    };
  }

  /**
   * Starts the receiver by establishing an AMQP session and an AMQP receiver link on the session.
   *
   * @param {OnMessage} onMessage The message handler to receive servicebus messages.
   * @param {OnError} onError The error handler to receive an error that occurs while receivin messages.
   */
  receive(onMessage: OnMessage, onError: OnError): void {
    throwErrorIfConnectionClosed(this._context.namespace);
    this._onMessage = onMessage;
    this._onError = onError;

    if (this._receiver) {
      this._receiver.addCredit(this.maxConcurrentCalls);
    }
  }

  /**
   * Stops the streaming receiver from receiving more messages
   * but does not close it.
   *
   * Returns when:
   * 1) all outstanding message handlers have resolved.
   * 2) the receiver has been drained.
   *
   * @param abortSignal
   */
  async stop(abortSignal?: AbortSignalLike): Promise<void> {
    if (this._receiver) {
      //
      //
      //
      // TODO: do we have a reasonable retry timeout I can snag?
      // TODO: also await any outstanding message handlers.
      //
      //
      //
      await drainReceiver(this._receiver, 60 * 1000, abortSignal);
    }
  }

  /**
   * Creates a streaming receiver.
   * @static
   *
   * @param {ClientEntityContext} context    The connection context.
   * @param {ReceiveOptions} [options]     Receive options.
   * @return {Promise<StreamingReceiver>} A promise that resolves with an instance of StreamingReceiver.
   */
  static async create(
    context: ClientEntityContext,
    options?: ReceiveOptions &
      Pick<OperationOptions, "abortSignal"> & {
        _createStreamingReceiver?: (
          context: ClientEntityContext,
          options?: ReceiveOptions
        ) => StreamingReceiver;
      }
  ): Promise<StreamingReceiver> {
    throwErrorIfConnectionClosed(context.namespace);
    if (!options) options = {};
    if (options.autoComplete == null) options.autoComplete = true;

    let sReceiver: StreamingReceiver;

    if (options?._createStreamingReceiver) {
      sReceiver = options._createStreamingReceiver(context, options);
    } else {
      sReceiver = new StreamingReceiver(context, options);
    }

    const config: RetryConfig<void> = {
      operation: () => {
        return sReceiver._init(undefined, options?.abortSignal);
      },
      connectionId: context.namespace.connectionId,
      operationType: RetryOperationType.receiveMessage,
      retryOptions: options.retryOptions,
      abortSignal: options?.abortSignal
    };
    await retry<void>(config);
    context.streamingReceiver = sReceiver;
    return sReceiver;
  }
}

export async function drainReceiver(
  receiver: Pick<Receiver, "once" | "drain" | "addCredit">,
  maxTimeoutMs: number,
  abortSignal?: AbortSignalLike
): Promise<void> {
  // add on a drain handler
  const drainPromise = new Promise((resolve) => {
    receiver.once(ReceiverEvents.receiverDrained, () => {
      resolve();
    });

    receiver.drain = true;
    receiver.addCredit(1);
  });

  await waitForTimeoutOrAbortOrResolve({
    actionFn: () => drainPromise,
    timeoutMessage: "Drain has timed out",
    timeoutMs: maxTimeoutMs,
    abortSignal: abortSignal
  });
}
