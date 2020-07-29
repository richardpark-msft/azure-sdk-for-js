// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ServiceBusMessageImpl } from "../serviceBusMessage";
import * as log from "../log";
import { calculateRenewAfterDuration } from "../util/utils";

/**
 * @internal
 * @ignore
 */
export type RenewableServiceBusMessage = Pick<
  ServiceBusMessageImpl,
  "messageId" | "lockToken" | "lockedUntilUtc"
>;

export type RenewableReceiver = Receiver;

/**
 * @internal
 * @ignore
 */
export class LockRenewer {
  /**
   * @property {Map<string, Function>} _messageRenewLockTimers Maintains a map of messages for which
   * the lock is automatically renewed.
   */
  protected _messageRenewLockTimers: Map<string, NodeJS.Timer | undefined> = new Map<
    string,
    NodeJS.Timer | undefined
  >();

  constructor(private _logPrefix: string) {}

  //
  // TODO: `lockToken` seems like a better field to use...messageId is settable by the user and is re-usable.
  //
  removeMessage(messageId: string): void {
    const timer = this._messageRenewLockTimers.get(messageId);

    if (timer == null) {
      return;
    }

    this._messageRenewLockTimers.delete(messageId);
    clearTimeout(timer);

    log.receiver(
      `${this._logPrefix} Cleared the message renew lock timer for message with id '${messageId}'.`
    );
  }

  async addMessage(bMessage: RenewableServiceBusMessage, maxAutoRenewDurationInMs: number) {
    //
    // TODO: migrate this logic above (or consider null object)
    //
    // if (this.autoRenewLock && bMessage.lockToken) {

    const lockToken = bMessage.lockToken;
    // - We need to renew locks before they expire by looking at bMessage.lockedUntilUtc.
    // - This autorenewal needs to happen **NO MORE** than maxAutoRenewDurationInMs
    // - We should be able to clear the renewal timer when the user's message handler
    // is done (whether it succeeds or fails).
    // Setting the messageId with undefined value in the _messageRenewockTimers Map because we
    // track state by checking the presence of messageId in the map. It is removed from the map
    // when an attempt is made to settle the message (either by the user or by the sdk) OR
    // when the execution of user's message handler completes.
    this._messageRenewLockTimers.set(bMessage.messageId as string, undefined);

    log.receiver(
      `${this._logPrefix} message with id '${
        bMessage.messageId
      }' is locked until ${bMessage.lockedUntilUtc!.toString()}.`
    );

    const totalAutoLockRenewDuration = Date.now() + maxAutoRenewDurationInMs;

    log.receiver(
      `${this._logPrefix} Total autolockrenew duration for message with id '${
        bMessage.messageId
      }' is: ${new Date(totalAutoLockRenewDuration).toString()}`
    );

    const autoRenewLockTask = (): void => {
      if (
        new Date(totalAutoLockRenewDuration) > bMessage.lockedUntilUtc! &&
        Date.now() < totalAutoLockRenewDuration
      ) {
        if (this._messageRenewLockTimers.has(bMessage.messageId as string)) {
          // TODO: We can run into problems with clock skew between the client and the server.
          // It would be better to calculate the duration based on the "lockDuration" property
          // of the queue. However, we do not have the management plane of the client ready for
          // now. Hence we rely on the lockedUntilUtc property on the message set by ServiceBus.
          const amount = calculateRenewAfterDuration(bMessage.lockedUntilUtc!);
          log.receiver(
            `${this._logPrefix} Sleeping for ${amount} milliseconds while renewing the lock for message with id '${bMessage.messageId}'.`
          );

          // Setting the value of the messageId to the actual timer. This will be cleared when
          // an attempt is made to settle the message (either by the user or by the sdk) OR
          // when the execution of user's message handler completes.
          this._messageRenewLockTimers.set(
            bMessage.messageId as string,
            setTimeout(async () => {
              try {
                log.receiver(
                  `${this._logPrefix} Attempting to renew the lock for message with id '${bMessage.messageId}.`
                );
                bMessage.lockedUntilUtc = await this._context.managementClient!.renewLock(
                  lockToken
                );
                log.receiver(
                  `${this._logPrefix} Successfully renewed the lock for message with id '${bMessage.messageId}.`
                );
                log.receiver(
                  `${this._logPrefix} Calling the autorenewlock task again for message with id '${bMessage.messageId}.`
                );
                autoRenewLockTask();
              } catch (err) {
                log.error(
                  `${this._logPrefix} An error occured while auto renewing the message lock '${bMessage.lockToken}' for message with id '${bMessage.messageId}': %O.`,
                  err
                );
                // Let the user know that there was an error renewing the message lock.
                this._onError!(err);
              }
            }, amount)
          );
        } else {
          log.receiver(
            `${this._logPrefix} Looks like the message lock renew timer has already been cleared for message with id '${bMessage.messageId}'.`
          );
        }
      } else {
        log.receiver(
          `${this._logPrefix} Current time ${new Date(
            Date.now()
          ).toString()} exceeds the total autolockrenew duration ${new Date(
            totalAutoLockRenewDuration
          ).toString()} for message with messageId '${
            bMessage.messageId
          }'. Hence we will stop the autoLockRenewTask.`
        );
        this._clearMessageLockRenewTimer(bMessage.messageId as string);
      }
    };
    // start
    autoRenewLockTask();
  }

  async addReceiver(receiver: RenewableReceiver) {}
}
