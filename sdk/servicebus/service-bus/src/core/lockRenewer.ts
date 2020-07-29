// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { ServiceBusMessageImpl } from "../serviceBusMessage";
import * as log from "../log";
import { calculateRenewAfterDuration } from "../util/utils";
import { ManagementClient } from "./managementClient";

/**
 * @internal
 * @ignore
 */
export type RenewableServiceBusMessage = Pick<
  ServiceBusMessageImpl,
  "messageId" | "lockToken" | "lockedUntilUtc"
>;

/**
 * @internal
 * @ignore
 */
export class LockRenewer {
  /**
   * @property _messageRenewLockTimers Maintains a map of messages for which
   * the lock is automatically renewed.
   */
  private _messageRenewLockTimers: Map<string, ReturnType<typeof setTimeout> | undefined> = new Map<
    string,
    ReturnType<typeof setTimeout> | undefined
  >();

  constructor(
    private _logPrefix: string,
    private _maxAutoRenewDurationInMs: number,
    private _getManagementClient: () => Pick<ManagementClient, "renewLock">,
    private _onError: (err: Error) => void
  ) {}

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

  addMessage(renewableMessage: RenewableServiceBusMessage): void {
    //
    // TODO: migrate this logic above (or consider null object)
    //
    // if (this.autoRenewLock && bMessage.lockToken) {

    const lockToken = renewableMessage.lockToken;
    const messageId = renewableMessage.messageId as string;

    if (lockToken == null || messageId == null) {
      return;
    }

    // - We need to renew locks before they expire by looking at bMessage.lockedUntilUtc.
    // - This autorenewal needs to happen **NO MORE** than maxAutoRenewDurationInMs
    // - We should be able to clear the renewal timer when the user's message handler
    // is done (whether it succeeds or fails).
    // Setting the messageId with undefined value in the _messageRenewockTimers Map because we
    // track state by checking the presence of messageId in the map. It is removed from the map
    // when an attempt is made to settle the message (either by the user or by the sdk) OR
    // when the execution of user's message handler completes.
    this._messageRenewLockTimers.set(messageId, undefined);

    log.receiver(
      `${
        this._logPrefix
      } message with id '${messageId}' is locked until ${renewableMessage.lockedUntilUtc!.toString()}.`
    );

    const totalAutoLockRenewDuration = Date.now() + this._maxAutoRenewDurationInMs;

    log.receiver(
      `${
        this._logPrefix
      } Total autolockrenew duration for message with id '${messageId}' is: ${new Date(
        totalAutoLockRenewDuration
      ).toString()}`
    );

    const autoRenewLockTask = (): void => {
      if (
        new Date(totalAutoLockRenewDuration) > renewableMessage.lockedUntilUtc! &&
        Date.now() < totalAutoLockRenewDuration
      ) {
        if (this._messageRenewLockTimers.has(messageId)) {
          // TODO: We can run into problems with clock skew between the client and the server.
          // It would be better to calculate the duration based on the "lockDuration" property
          // of the queue. However, we do not have the management plane of the client ready for
          // now. Hence we rely on the lockedUntilUtc property on the message set by ServiceBus.
          const amount = calculateRenewAfterDuration(renewableMessage.lockedUntilUtc!);
          log.receiver(
            `${this._logPrefix} Sleeping for ${amount} milliseconds while renewing the lock for message with id '${messageId}'.`
          );

          // Setting the value of the messageId to the actual timer. This will be cleared when
          // an attempt is made to settle the message (either by the user or by the sdk) OR
          // when the execution of user's message handler completes.
          this._messageRenewLockTimers.set(
            messageId,
            setTimeout(async () => {
              try {
                log.receiver(
                  `${this._logPrefix} Attempting to renew the lock for message with id '${renewableMessage.messageId}.`
                );

                renewableMessage.lockedUntilUtc = await this._getManagementClient().renewLock(
                  lockToken
                );

                log.receiver(
                  `${this._logPrefix} Successfully renewed the lock for message with id '${renewableMessage.messageId}. Re-adding lock renewal task.`
                );

                autoRenewLockTask();
              } catch (err) {
                log.error(
                  `${this._logPrefix} An error occured while auto renewing the message lock '${renewableMessage.lockToken}' for message with id '${renewableMessage.messageId}': %O.`,
                  err
                );
                // Let the user know that there was an error renewing the message lock.
                this._onError(err);
              }
            }, amount)
          );
        } else {
          log.receiver(
            `${this._logPrefix} Looks like the message lock renew timer has already been cleared for message with id '${messageId}'.`
          );
        }
      } else {
        log.receiver(
          `${this._logPrefix} Current time ${new Date(
            Date.now()
          ).toString()} exceeds the total autolockrenew duration ${new Date(
            totalAutoLockRenewDuration
          ).toString()} for message with messageId '${messageId}'. Hence we will stop the autoLockRenewTask.`
        );
        this.removeMessage(messageId);
      }
    };
    // start
    autoRenewLockTask();
  }

  clear(): void {
    for (const [messageId] of this._messageRenewLockTimers) {
      this.removeMessage(messageId);
    }
  }
}
