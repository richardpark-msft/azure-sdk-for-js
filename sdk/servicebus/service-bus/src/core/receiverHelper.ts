// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { AbortError } from "@azure/abort-controller";
import { Receiver, ReceiverEvents } from "rhea-promise";
import { receiverLogger as logger } from "../log";
import { ServiceBusError } from "../serviceBusError";

/**
 * Wraps the receiver with some higher level operations for managing state
 * like credits, draining, etc...
 *
 * @internal
 */
export class ReceiverHelper {
  private _isSuspended: boolean = true;

  constructor(
    private _getCurrentReceiver: () => { receiver: Receiver | undefined; logPrefix: string }
  ) {}

  private _getCurrentReceiverOrError():
    | "is undefined"
    | "is not open"
    | "is suspended"
    | { receiver: Receiver | undefined; logPrefix: string } {
    const currentReceiverData = this._getCurrentReceiver();

    if (currentReceiverData.receiver == null) {
      return "is undefined";
    }

    if (!currentReceiverData.receiver.isOpen()) {
      return "is not open";
    }

    if (this._isSuspended) {
      return "is suspended";
    }

    return currentReceiverData;
  }

  /**
   * Adds credits to the receiver, respecting any state that
   * indicates the receiver is closed or should not continue
   * to receive more messages.
   *
   * @param credits - Number of credits to add.
   * @returns true if credits were added, false if there is no current receiver instance
   * or `stopReceivingMessages` has been called.
   */
  addCredit(credits: number): void {
    const currentReceiverOrError = this._getCurrentReceiverOrError();

    if (typeof currentReceiverOrError === "string") {
      const errorMessage = `Can't add credits to the receiver since it ${currentReceiverOrError}.`;

      if (currentReceiverOrError === "is suspended") {
        // if a user has suspended the receiver we should consider this a non-retryable
        // error since it absolutely requires user intervention.
        throw new AbortError(errorMessage);
      }

      throw new ServiceBusError(errorMessage, "GeneralError");
    }

    if (currentReceiverOrError.receiver != null) {
      logger.verbose(`${currentReceiverOrError.logPrefix} Adding ${credits} credits`);
      currentReceiverOrError.receiver.addCredit(credits);
    }
  }

  /**
   * Drains the credits for the receiver and prevents the `receiverHelper.addCredit()` method from adding credits.
   * Call `resume()` to enable the `addCredit()` method.
   */
  async suspend(): Promise<void> {
    const { receiver, logPrefix } = this._getCurrentReceiver();

    this._isSuspended = true;

    if (!this._isValidReceiver(receiver)) {
      return;
    }

    logger.verbose(
      `${logPrefix} User has requested to stop receiving new messages, attempting to drain.`
    );

    return this.drain();
  }

  /**
   * Resets tracking so `addCredit` works again by toggling the `_isSuspended` flag.
   */
  resume(): void {
    this._isSuspended = false;
  }

  /**
   * Whether the receiver can receive messages.
   *
   * This checks if the the caller has decided to disable adding
   * credits via 'suspend' as well as whether the receiver itself is
   * still open.
   */
  canReceiveMessages(): boolean {
    const { receiver } = this._getCurrentReceiver();
    return !this._isSuspended && this._isValidReceiver(receiver);
  }

  isSuspended(): boolean {
    return this._isSuspended;
  }

  /**
   * Initiates a drain for the current receiver and resolves when
   * the drain has completed.
   *
   * NOTE: This method returns immediately if the receiver is not valid or if there
   * are no pending credits on the receiver (ie: `receiver.credit === 0`).
   */
  async drain(): Promise<void> {
    const { receiver, logPrefix } = this._getCurrentReceiver();

    if (!this._isValidReceiver(receiver)) {
      // TODO: should we throw?
      return;
    }

    if (receiver.credit === 0) {
      // nothing to drain
      return;
    }

    logger.verbose(
      `${logPrefix} Receiver is starting drain. Remaining credits; ${receiver.credit}`
    );

    const drainPromise = new Promise<void>((resolve) => {
      receiver.once(ReceiverEvents.receiverDrained, () => {
        logger.verbose(`${logPrefix} Receiver has been drained.`);
        receiver.drain = false;
        resolve();
      });

      receiver.drain = true;
      // this is not actually adding another credit - it'll just
      // cause the drain call to start.
      receiver.addCredit(1);
    });

    return drainPromise;
  }

  private _isValidReceiver(receiver: Receiver | undefined): receiver is Receiver {
    return receiver != null && receiver.isOpen();
  }
}
