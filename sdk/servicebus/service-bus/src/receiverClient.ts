import Long from "long";
import { Receiver, SessionReceiver } from "./receiver";
import { ServiceBusClient, ServiceBusClientOptions } from "./serviceBusClient";
import {
  TokenCredential,
  OnMessage,
  OnError,
  MessageHandlerOptions,
  CorrelationFilter,
  RuleDescription
} from ".";
import { isTokenCredential } from "@azure/core-amqp";
import { ClientEntityContext } from "./clientEntityContext";
import { ClientType } from "./client";
import { ReceiveMode, ServiceBusMessage, ReceivedMessageInfo } from "./serviceBusMessage";
import { SessionReceiverOptions } from "./session/messageSession";
import { generate_uuid } from "rhea-promise";
import { throwErrorIfClientOrConnectionClosed } from "./util/errors";

export type ServiceBusClientReceiverOptions = ServiceBusClientOptions & SessionReceiverOptions;

export class ServiceBusReceiverClient {
  public _receiveMode: ReceiveMode;
  public _entityPath: string;
  private _clientEntityContext: ClientEntityContext;
  private _sbClient: ServiceBusClient;
  private _currentReceiver: Receiver | SessionReceiver;
  readonly defaultRuleName: string = "$Default";

  // Queue
  constructor(
    entityConnectionString: string,
    receiveMode?: ReceiveMode,
    options?: ServiceBusClientReceiverOptions
  );

  // Queue
  constructor(
    serviceBusConnectionString: string,
    entityName: string,
    receiveMode?: ReceiveMode,
    options?: ServiceBusClientReceiverOptions
  );

  // Queue
  constructor(
    host: string,
    entityName: string,
    credential: TokenCredential,
    receiveMode?: ReceiveMode,
    options?: ServiceBusClientReceiverOptions
  );

  // Subscription
  constructor(
    topicConnectionString: string,
    subscriptionName: string,
    receiveMode?: ReceiveMode,
    options?: ServiceBusClientReceiverOptions
  );

  // Subscription
  constructor(
    serviceBusConnectionString: string,
    topicName: string,
    subscriptionName: string,
    receiveMode?: ReceiveMode,
    options?: ServiceBusClientReceiverOptions
  );

  // Subscription
  constructor(
    host: string,
    topicName: string,
    subscriptionName: string,
    credential: TokenCredential,
    receiveMode?: ReceiveMode,
    options?: ServiceBusClientReceiverOptions
  );

  constructor(
    param1: string,
    param2?: string | ReceiveMode,
    param3?: string | ReceiveMode | ServiceBusClientReceiverOptions | TokenCredential,
    param4?: ServiceBusClientReceiverOptions | ReceiveMode | TokenCredential,
    param5?: ServiceBusClientReceiverOptions | ReceiveMode,
    param6?: ServiceBusClientReceiverOptions
  ) {
    let receiveMode: ReceiveMode;
    let options: ServiceBusClientReceiverOptions;
    if (typeof param2 !== "string") {
      // Queue
      // (entityConnectionString: string, receiveMode: ReceiveMode, options?: ServiceBusClientReceiverOptions)
      const entityConnectionString = param1;
      options = param3 as ServiceBusClientReceiverOptions;
      // get the entity name from the connection string
      const entityPathMatch = entityConnectionString.match(/^.+EntityPath=(.+?);{0,1}$/);

      if (entityPathMatch!.length !== 2) {
        throw new Error("Invalid entity connection string - no EntityPath");
      } else {
        this._entityPath = String(entityPathMatch![1]);
      }

      this._sbClient = new ServiceBusClient(entityConnectionString, options);
      receiveMode = param2 as ReceiveMode;
    } else if (isTokenCredential(param3)) {
      // Queue
      // (host: string, entityName: string, credential: TokenCredential, receiveMode: ReceiveMode, options?: ServiceBusClientReceiverOptions)
      const entityName = param2;
      options = param5 as ServiceBusClientReceiverOptions;
      this._sbClient = new ServiceBusClient(param1, param3, options);
      this._entityPath = String(entityName);
      receiveMode = param4 as ReceiveMode;
    } else if (isTokenCredential(param4)) {
      // Subscription
      // (host: string, topicName: string, subscriptionName: string, credential: TokenCredential, receiveMode: ReceiveMode, options?: ServiceBusClientReceiverOptions)
      const entityName = param2;
      options = param6 as ServiceBusClientReceiverOptions;
      this._entityPath = `${entityName}/Subscriptions/${param3}`;
      this._sbClient = new ServiceBusClient(param1, param4, options);
      receiveMode = param5 as ReceiveMode;
    } else if (typeof param3 === "string") {
      // Subscription
      // (serviceBusConnectionString: string, topicName: string, subscriptionName: string, receiveMode?: ReceiveMode, options?: ServiceBusClientReceiverOptions)
      const entityName = param2;
      options = param5 as ServiceBusClientReceiverOptions;
      this._entityPath = `${entityName}/Subscriptions/${param3}`;
      this._sbClient = new ServiceBusClient(param1, options);
      receiveMode = param4 as ReceiveMode;
    } else {
      // Queue
      // (serviceBusConnectionString: string, entityName: string, receiveMode?: ReceiveMode, options?: ServiceBusClientReceiverOptions)
      // Subscription
      // (topicConnectionString: string, subscriptionName: string, receiveMode?: ReceiveMode, options?: ServiceBusClientReceiverOptions)
      if (param1.includes("EntityPath")) {
        // Subscription
        // (topicConnectionString: string, subscriptionName: string, receiveMode?: ReceiveMode, options?: ServiceBusClientReceiverOptions)
        // get the entity name from the connection string
        const entityPathMatch = param1.match(/^.+EntityPath=(.+?);{0,1}$/);

        if (entityPathMatch!.length !== 2) {
          throw new Error("Invalid entity connection string - no EntityPath");
        } else {
          this._entityPath = `${entityPathMatch![1]}/Subscriptions/${param2}`;
        }
      } else {
        // Queue
        // (serviceBusConnectionString: string, entityName: string, receiveMode?: ReceiveMode, options?: ServiceBusClientReceiverOptions)
        this._entityPath = String(param2);
        receiveMode = param3 as ReceiveMode;
      }
      options = param4 as ServiceBusClientReceiverOptions;
      this._sbClient = new ServiceBusClient(param1, options);
      receiveMode = param3 as ReceiveMode;
    }

    this._receiveMode =
      receiveMode === ReceiveMode.receiveAndDelete ? receiveMode : ReceiveMode.peekLock;

    this._clientEntityContext = ClientEntityContext.create(
      this._entityPath,
      ClientType.ServiceBusReceiverClient,
      this._sbClient._context,
      `${this._entityPath}/${generate_uuid()}`
    );

    if (!options?.sessionId) {
      // Receiver for the subscription where sessions are not enabled
      this._currentReceiver = new Receiver(this._clientEntityContext, receiveMode);
    } else {
      this._currentReceiver = new SessionReceiver(this._clientEntityContext, receiveMode, options);
    }
  }

  public get receiveMode(): ReceiveMode {
    return this._receiveMode;
  }

  public get isClosed(): boolean {
    return this._currentReceiver.isClosed;
  }

  registerMessageHandler(
    onMessage: OnMessage,
    onError: OnError,
    options?: MessageHandlerOptions
  ): void {
    return this._currentReceiver.registerMessageHandler(onMessage, onError, options);
  }

  async receiveMessages(
    maxMessageCount: number,
    maxWaitTimeInSeconds?: number
  ): Promise<ServiceBusMessage[]> {
    return this._currentReceiver.receiveMessages(maxMessageCount, maxWaitTimeInSeconds);
  }

  async *getMessageIterator(): AsyncIterableIterator<ServiceBusMessage> {
    while (true) {
      const currentBatch = await this.receiveMessages(1);
      yield currentBatch[0];
    }
  }

  async renewMessageLock(lockTokenOrMessage: string | ServiceBusMessage): Promise<Date> {
    if (!(this._currentReceiver instanceof SessionReceiver)) {
      return this._currentReceiver.renewMessageLock(lockTokenOrMessage);
    } else {
      throw new Error("'renewMessageLock' does not exist on 'SessionReceiver'");
    }
  }

  async receiveDeferredMessage(sequenceNumber: Long): Promise<ServiceBusMessage | undefined> {
    return this._currentReceiver.receiveDeferredMessage(sequenceNumber);
  }

  async receiveDeferredMessages(sequenceNumbers: Long[]): Promise<ServiceBusMessage[]> {
    return this._currentReceiver.receiveDeferredMessages(sequenceNumbers);
  }

  async close(): Promise<void> {
    await this._currentReceiver.close();
    await this._clientEntityContext.close();
    await this._sbClient.close();
  }

  isReceivingMessages(): boolean {
    return this._currentReceiver.isReceivingMessages();
  }

  // Session methods # Begin
  public get sessionId(): string | undefined {
    if (this._currentReceiver instanceof SessionReceiver) {
      return this._currentReceiver.sessionId;
    } else {
      throw new Error("Only available on sessionful Receiver");
    }
  }

  public get sessionLockedUntilUtc(): Date | undefined {
    if (this._currentReceiver instanceof SessionReceiver) {
      return this._currentReceiver.sessionLockedUntilUtc;
    } else {
      throw new Error("Only available on sessionful Receiver");
    }
  }

  async renewSessionLock(): Promise<Date> {
    if (this._currentReceiver instanceof SessionReceiver) {
      return this._currentReceiver.renewSessionLock();
    } else {
      throw new Error("Only available on sessionful Receiver");
    }
  }

  async setState(state: any): Promise<void> {
    if (this._currentReceiver instanceof SessionReceiver) {
      return this._currentReceiver.setState(state);
    } else {
      throw new Error("Only available on sessionful Receiver");
    }
  }

  async getState(): Promise<any> {
    if (this._currentReceiver instanceof SessionReceiver) {
      return this._currentReceiver.getState();
    } else {
      throw new Error("Only available on sessionful Receiver");
    }
  }
  // Session methods # End

  // ManagementClient methods # Begin
  async peek(maxMessageCount?: number): Promise<ReceivedMessageInfo[]> {
    if (this._currentReceiver instanceof SessionReceiver) {
      return this._currentReceiver.peek(maxMessageCount);
    } else {
      throwErrorIfClientOrConnectionClosed(
        this._clientEntityContext.namespace,
        this._entityPath,
        this._clientEntityContext.isClosed
      );

      return this._clientEntityContext.managementClient!.peek(maxMessageCount);
    }
  }

  async peekBySequenceNumber(
    fromSequenceNumber: Long,
    maxMessageCount?: number
  ): Promise<ReceivedMessageInfo[]> {
    if (this._currentReceiver instanceof SessionReceiver) {
      return this._currentReceiver.peekBySequenceNumber(fromSequenceNumber, maxMessageCount);
    } else {
      throwErrorIfClientOrConnectionClosed(
        this._clientEntityContext.namespace,
        this._entityPath,
        this._clientEntityContext.isClosed
      );

      return this._clientEntityContext.managementClient!.peekBySequenceNumber(
        fromSequenceNumber,
        maxMessageCount
      );
    }
  }

  // /**
  //  * Lists the ids of the sessions on the ServiceBus Queue.
  //  * @param maxNumberOfSessions Maximum number of sessions.
  //  * @param lastUpdateTime Filter to include only sessions updated after a given time. Default
  //  * value is 3 days before the current time.
  //  */
  // async listMessageSessions(
  //   maxNumberOfSessions: number,
  //   lastUpdatedTime?: Date
  // ): Promise<string[]> {
  // TODO: Parameter validation if required
  // this.throwErrorIfClientOrConnectionClosed();
  //   return this._context.managementClient!.listMessageSessions(
  //     0,
  //     maxNumberOfSessions,
  //     lastUpdatedTime
  //   );
  // }

  // ManagementClient methods # End

  /**
   * Returns the corresponding dead letter queue path for the client entity.
   */
  getDeadLetterPath(): string {
    return `${this._entityPath}/$DeadLetterQueue`;
  }

  // #region topic-filters

  async getRules(): Promise<RuleDescription[]> {
    if (this._entityPath.includes("/Subscriptions/")) {
      throwErrorIfClientOrConnectionClosed(
        this._clientEntityContext.namespace,
        this._entityPath,
        this._clientEntityContext.isClosed
      );
      return this._clientEntityContext.managementClient!.getRules();
    } else {
      throw new Error("Only for a subscription");
    }
  }

  async removeRule(ruleName: string): Promise<void> {
    if (this._entityPath.includes("/Subscriptions/")) {
      throwErrorIfClientOrConnectionClosed(
        this._clientEntityContext.namespace,
        this._entityPath,
        this._clientEntityContext.isClosed
      );
      return this._clientEntityContext.managementClient!.removeRule(ruleName);
    } else {
      throw new Error("Only for a subscription");
    }
  }

  async addRule(
    ruleName: string,
    filter: boolean | string | CorrelationFilter,
    sqlRuleActionExpression?: string
  ): Promise<void> {
    if (this._entityPath.includes("/Subscriptions/")) {
      throwErrorIfClientOrConnectionClosed(
        this._clientEntityContext.namespace,
        this._entityPath,
        this._clientEntityContext.isClosed
      );
      return this._clientEntityContext.managementClient!.addRule(
        ruleName,
        filter,
        sqlRuleActionExpression
      );
    } else {
      throw new Error("Only for a subscription");
    }
  }

  // #endregion
}
