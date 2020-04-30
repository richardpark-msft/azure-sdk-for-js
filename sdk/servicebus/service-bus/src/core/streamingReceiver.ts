// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { MessageReceiver, ReceiveOptions, OnMessage, OnError } from "./messageReceiver";

import { ClientEntityContext } from "../clientEntityContext";

import { throwErrorIfConnectionClosed } from "../util/errors";

/**
 * @internal
 * Describes the streaming receiver where the user can receive the message
 * by providing handler functions.
 */
export class StreamingReceiver {
  /**
   * Instantiate a new Streaming receiver for receiving messages with handlers.
   *
   * @constructor
   */
  constructor(private _messageReceiver: MessageReceiver, options?: ReceiveOptions) {
    options = options || {};
    if (options.autoComplete == null) options.autoComplete = true;

    this._messageReceiver.autoComplete = options.autoComplete;

    if (typeof options.maxConcurrentCalls === "number" && options.maxConcurrentCalls > 0) {
      this._messageReceiver.maxConcurrentCalls = options.maxConcurrentCalls;
    }

    // super(context, ReceiverType.streaming, options);
    // TODO: pretty sure this isn't used - newMessageWaitTimeoutInMs is never set in this code.
    // this.resetTimerOnNewMessageReceived = () => {
    //   if (this._newMessageReceivedTimer) clearTimeout(this._newMessageReceivedTimer);
    //   if (this.newMessageWaitTimeoutInMs) {
    //     this._newMessageReceivedTimer = setTimeout(async () => {
    //       const msg =
    //         `StreamingReceiver '${this.name}' did not receive any messages in ` +
    //         `the last ${this.newMessageWaitTimeoutInMs} milliseconds. ` +
    //         `Hence ending this receive operation.`;
    //       log.error("[%s] %s", this._context.namespace.connectionId, msg);
    //       await this.close();
    //     }, this.newMessageWaitTimeoutInMs);
    //   }
    // };
  }

  /**
   * Starts the receiver by establishing an AMQP session and an AMQP receiver link on the session.
   *
   * @param {OnMessage} onMessage The message handler to receive servicebus messages.
   * @param {OnError} onError The error handler to receive an error that occurs while receivin messages.
   */
  receive(onMessage: OnMessage, onError: OnError): void {
    throwErrorIfConnectionClosed(this._messageReceiver.namespace);
    this._messageReceiver._onMessage = onMessage;
    this._messageReceiver._onError = onError;

    if (this._messageReceiver.receiver) {
      this._messageReceiver.receiver.addCredit(this._messageReceiver.maxConcurrentCalls);
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
    messageReceiver: MessageReceiver,
    options?: ReceiveOptions
  ): Promise<StreamingReceiver> {
    throwErrorIfConnectionClosed(context.namespace);
    // TODO: do we need this? The receiver should be considered initialized by
    // the time we've hit this code.
    // const config: RetryConfig<void> = {
    //   operation: () => {
    //     return sReceiver._init();
    //   },
    //   connectionId: context.namespace.connectionId,
    //   operationType: RetryOperationType.receiveMessage,
    //   retryOptions: options.retryOptions
    // };
    // await retry<void>(config);

    messageReceiver.takeOwnership();
    context.streamingReceiver = new StreamingReceiver(messageReceiver, options);
    return context.streamingReceiver;
  }

  // compat
  close(): Promise<void> {
    return this._messageReceiver.close();
  }

  get name() {
    return this._messageReceiver.name;
  }
}
