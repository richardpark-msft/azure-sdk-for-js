// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import * as log from "../log";
import { Receiver as RheaReceiver, Sender as RheaSender } from "rhea-promise";

/**
 * @internal
 * @ignore
 */
export interface OpenArgs<T extends RheaSender | RheaReceiver> {
    create(): Promise<T>;    
}

/**
 * @internal
 * @ignore
 * 
 * @param options 
 */
export async function open(options?: AwaitableSenderOptions): Promise<void> {
    if (this.isOpen()) {
      return;
    }

    log.sender(
      "Acquiring lock %s for initializing the session, sender and possibly the connection.",
      this.openLock
    );

    return await defaultLock.acquire(this.openLock, async () => {
      try {
        // isOpen isConnecting  Should establish
        // true     false          No
        // true     true           No
        // false    true           No
        // false    false          Yes
        if (!this.isOpen()) {
          log.error(
            "[%s] The sender '%s' with address '%s' is not open and is not currently " +
              "establishing itself. Hence let's try to connect.",
            this._context.namespace.connectionId,
            this.name,
            this.address
          );
          this.isConnecting = true;
          await this._negotiateClaim();
          log.error(
            "[%s] Trying to create sender '%s'...",
            this._context.namespace.connectionId,
            this.name
          );
          if (!options) {
            options = this._createSenderOptions(Constants.defaultOperationTimeoutInMs);
          }
          this._sender = await this._context.namespace.connection.createAwaitableSender(options);
          this.isConnecting = false;
          log.error(
            "[%s] Sender '%s' with address '%s' has established itself.",
            this._context.namespace.connectionId,
            this.name,
            this.address
          );
          this._sender.setMaxListeners(1000);
          log.error(
            "[%s] Promise to create the sender resolved. Created sender with name: %s",
            this._context.namespace.connectionId,
            this.name
          );
          log.error(
            "[%s] Sender '%s' created with sender options: %O",
            this._context.namespace.connectionId,
            this.name,
            options
          );
          // It is possible for someone to close the sender and then start it again.
          // Thus make sure that the sender is present in the client cache.
          if (!this._sender) this._context.sender = this;
          await this._ensureTokenRenewal();
        }
      } catch (err) {
        err = translate(err);
        log.error(
          "[%s] An error occurred while creating the sender %s",
          this._context.namespace.connectionId,
          this.name,
          err
        );
        throw err;
      }
    });
  }