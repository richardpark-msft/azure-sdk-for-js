// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import * as log from "../log";
import { Receiver as RheaReceiver, AwaitableSender as RheaSender } from "rhea-promise";
import { translate } from "@azure/core-amqp";
import { AbortSignalLike } from "@azure/core-http";

export type RheaLink = RheaSender | RheaReceiver;

/**
 * @internal
 * @ignore
 */
export interface OpenArgs<RheaLinkT extends RheaLink> {
  create(): Promise<RheaLinkT>;
  isOpen(): boolean;

  isConnecting(value?: boolean): boolean;

  // logging related stuff.
  logger: typeof log.sender;
  logPrefix: string;

  // TODO: so...can we make the this.openLock implicit? It'd be cool
  // if that were just one less detail to manage.
  openLock: string;
  acquireLock<T>(openLock: string, fn: () => Promise<T>): Promise<T>;

  // these are more candidates to move out from LinkEntity - they're not really part of it.
  negotiateClaim(): Promise<void>;
  ensureTokenRenewal(): Promise<void>;

  abortSignal?: AbortSignalLike;
}

/**
 * @internal
 * @ignore
 *
 * @param options
 */
export async function openLink<T extends RheaLink>(args: OpenArgs<T>): Promise<T | undefined> {
  if (args.isOpen() || args.isConnecting()) {
    return Promise.resolve(undefined);
  }

  // TODO: set isConnecting up here, cleanup on finally.

  log.error(
    `${args.logPrefix} is not open and is not currently establishing itself. Hence let's try to connect.`
  );

  args.logger(
    `${args.logPrefix} Acquiring lock ${args.openLock} for initializing the session, link and possibly the connection.`
  );

  return args.acquireLock(args.openLock, async () => {
    try {
      if (args.isOpen()) {
        return Promise.resolve(undefined);
      }

      // isOpen isConnecting  Should establish
      // true     false          No
      // true     true           No
      // false    true           No
      // false    false          Yes
      log.error(
        `${args.logPrefix} is not open and is not currently establishing itself. Hence let's try to connect.`
      );

      //     "[%s] The sender '%s' with address '%s' is not open and is not currently " +
      //       "establishing itself. Hence let's try to connect.",
      //     this._context.namespace.connectionId,
      //     this.name,
      //     this.address
      //   );

      args.isConnecting(true);
      // this.isConnecting = true;
      await args.negotiateClaim();

      //   log.error(
      //     "[%s] Trying to create sender '%s'...",
      //     this._context.namespace.connectionId,
      //     this.name
      //   );

      log.error(`${args.logPrefix} Trying to create...`);

      const link = await args.create();

      //   if (!options) {
      //     options = this._createSenderOptions(Constants.defaultOperationTimeoutInMs);
      //   }
      //   this._sender = await this._context.namespace.connection.createAwaitableSender(options);

      // this.isConnecting = false;
      args.isConnecting(false);

      log.error(`${args.logPrefix}' Has been established.`);
      //     this._context.namespace.connectionId,
      //     this.name,
      //     this.address
      //   );

      // TODO: need to move to `create()` for the sender.
      //   this._sender.setMaxListeners(1000);

      log.error(`${args.logPrefix} Promise to create the link resolved.`);

      //   log.error(
      //     "[%s] Sender '%s' created with sender options: %O",
      //     this._context.namespace.connectionId,
      //     this.name,
      //     options
      //   );

      // It is possible for someone to close the sender and then start it again.
      // Thus make sure that the sender is present in the client cache.
      //   if (!this._sender) this._context.sender = this;

      await args.ensureTokenRenewal();
      return link;
    } catch (err) {
      const translatedErr = translate(err);

      log.error(`${args.logPrefix}. An error occurred during creation`, translatedErr);
      // log.error(
      //   "[%s] An error occurred while creating the sender %s",
      //   this._context.namespace.connectionId,
      //   this.name,
      //   err
      // );
      throw translatedErr;
    }
  });
}
