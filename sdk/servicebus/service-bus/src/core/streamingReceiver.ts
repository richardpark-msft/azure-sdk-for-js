// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { MessageReceiver, ReceiveOptions, ReceiverType } from "./messageReceiver";

import { ClientEntityContext } from "../clientEntityContext";

import * as log from "../log";
import { throwErrorIfConnectionClosed } from "../util/errors";
import { RetryOperationType, RetryConfig, retry } from "@azure/core-amqp";
import { OperationOptions } from "../modelsToBeSharedWithEventHubs";
import { AbortSignalLike } from "@azure/abort-controller";
import { Receiver, ReceiverEvents, ReceiverOptions } from "rhea-promise";
import { waitForTimeoutOrAbortOrResolve } from "../util/utils";
import { MessageHandlers } from "../models";

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
  constructor(
    // eslint-disable-next-line @azure/azure-sdk/ts-use-interface-parameters
    context: ClientEntityContext,
    private _messageHandlers: MessageHandlers<unknown>,
    options?: ReceiveOptions
  ) {
    super(context, ReceiverType.streaming, options);

    this._onMessage = (...args) =>
      this._messageHandlers.processMessage.call(this._messageHandlers, ...args);
    this._onError = (...args) =>
      this._messageHandlers.processError.call(this._messageHandlers, ...args);

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
  receive(): void {
    throwErrorIfConnectionClosed(this._context.namespace);

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
      //
      //
      //
      await drainReceiver(this._receiver, 60 * 1000, abortSignal);
      await this._waitForOutstandingMessageHandlers();

      if (this._messageHandlers.processClose) {
        try {
          await this._messageHandlers.processClose();
        } catch (err) {
          await callProcessError(this._messageHandlers, err);
        }
      }
    }
  }

  private _waitForOutstandingMessageHandlers(): Promise<void> {
    //
    //
    // TODO: implement
    //
    //
    return Promise.resolve();
  }

  protected async _init(options?: ReceiverOptions, abortSignal?: AbortSignalLike): Promise<void> {
    await super._init(options, abortSignal);

    if (this._messageHandlers.processOpen) {
      try {
        await this._messageHandlers.processOpen();
      } catch (err) {
        await callProcessError(this._messageHandlers, err);
      }
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
    messageHandlers: MessageHandlers<unknown>,
    options?: ReceiveOptions &
      Pick<OperationOptions, "abortSignal"> & {
        _createStreamingReceiver?: (
          context: ClientEntityContext,
          messageHandlers: MessageHandlers<unknown>,
          options?: ReceiveOptions
        ) => StreamingReceiver;
      }
  ): Promise<StreamingReceiver> {
    throwErrorIfConnectionClosed(context.namespace);
    if (!options) options = {};
    if (options.autoComplete == null) options.autoComplete = true;

    let sReceiver: StreamingReceiver;

    if (options?._createStreamingReceiver) {
      sReceiver = options._createStreamingReceiver(context, messageHandlers, options);
    } else {
      sReceiver = new StreamingReceiver(context, messageHandlers, options);
    }

    const config: RetryConfig<void> = {
      operation: async () => sReceiver._init(undefined, options?.abortSignal),
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

/**
 * @internal
 * @ignore
 */
export function callProcessError(
  messageHandlers: Pick<MessageHandlers<unknown>, "processError">,
  err: Error
): Promise<void> {
  return messageHandlers.processError(err).catch((err) => {
    log.error("Error thrown from processError: %O", err);
  });
}
