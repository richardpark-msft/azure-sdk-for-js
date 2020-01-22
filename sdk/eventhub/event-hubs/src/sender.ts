// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// TODO: we can kill this file now.

// import { EventData } from "./eventData";
// import { EventHubSender } from "./eventHubSender";
// import { EventHubProducerOptions } from "../src/models/private";
// import { SendOptions, CreateBatchOptions } from "../src/models/public";
// import { ConnectionContext } from "./connectionContext";
// import { logger, logErrorStackTrace } from "./log";
// import { EventDataBatch, isEventDataBatch, EventDataBatchImpl } from "./eventDataBatch";
// import { CanonicalCode } from "@opentelemetry/types";

/**
 * Send one or more of events to the associated Event Hub.
 *
 * @param eventData  An individual `EventData` object, or an array of `EventData` objects or an
 * instance of `EventDataBatch`.
 * @param options The set of options that can be specified to influence the way in which
 * events are sent to the associated Event Hub.
 * - `partitionKey` : A value that is hashed to produce a partition assignment.
 * Not applicable if the `EventHubProducer` was created using a `partitionId`.
 * - `abortSignal`  : A signal the request to cancel the send operation.
 *
 * @returns Promise<void>
 * @throws AbortError if the operation is cancelled via the abortSignal.
 * @throws MessagingError if an error is encountered while sending a message.
 * @throws TypeError if a required parameter is missing.
 * @throws Error if the underlying connection or sender has been closed.
 * @throws Error if a partitionKey is provided when the producer was created with a partitionId.
 * @throws Error if batch was created with partitionKey different than the one provided in the options.
 * Create a new producer using the EventHubClient createProducer method.
 */
// TODO: moved over to `EventHubSender`
// async function send(
//   connectionId: string,
//   eventData: EventData | EventData[] | EventDataBatch,
//   sender: EventHubSender,
//   producerOptions: EventHubProducerOptions,
//   options: SendOptions = {}
// ): Promise<void> {
//   // TODO: shifted into EventHubSender
//   //
//   //_throwIfSenderOrConnectionClosed(sender);
//   // throwTypeErrorIfParameterMissing(connectionId, "send", "eventData", eventData);
//   // if (Array.isArray(eventData) && eventData.length === 0) {
//   //   logger.info(`[${connectionId}] Empty array was passed. No events to send.`);
//   //   return;
//   // }
//   // if (isEventDataBatch(eventData) && eventData.count === 0) {
//   //   logger.info(`[${connectionId}] Empty batch was passsed. No events to send.`);
//   //   return;
//   // }

//   if (!Array.isArray(eventData) && !isEventDataBatch(eventData)) {
//     eventData = [eventData];
//   }

//   const sendSpan = ultraCreateSpan(eventData, options, _createSendSpan);

//   try {
//     const result = await sender.send(eventData, {
//       ...producerOptions,
//       ...options
//     });
//     sendSpan.setStatus({ code: CanonicalCode.OK });
//     return result;
//   } catch (err) {
//     sendSpan.setStatus({
//       code: CanonicalCode.UNKNOWN,
//       message: err.message
//     });
//     throw err;
//   } finally {
//     sendSpan.end();
//   }

// TODO: shifting _createSendSpan and it's cousin ultraSendSpan() into `EventHubSender`
// function _createSendSpan(
//   parentSpan?: Span | SpanContext,
//   spanContextsToLink: SpanContext[] = []
// ): Span {
//   const links: Link[] = spanContextsToLink.map((spanContext) => {
//     return {
//       spanContext
//     };
//   });
//   const tracer = getTracer();
//   const span = tracer.startSpan("Azure.EventHubs.send", {
//     kind: SpanKind.CLIENT,
//     parent: parentSpan,
//     links
//   });

//   span.setAttribute("az.namespace", "Microsoft.EventHub");
//   span.setAttribute("message_bus.destination", this._eventHubName);
//   span.setAttribute("peer.address", this._endpoint);

//   return span;
// }

// function ultraCreateSpan(eventData: EventData[] | EventDataBatch, options: SendOptions, _createSendSpan: (parentSpan?: Span | SpanContext | undefined, spanContextsToLink?: SpanContext[]) => Span) {
//   let spanContextsToLink: SpanContext[] = [];
//   if (Array.isArray(eventData)) {
//     for (let i = 0; i < eventData.length; i++) {
//       const event = eventData[i];
//       if (!event.properties || !event.properties[TRACEPARENT_PROPERTY]) {
//         const messageSpan = createMessageSpan(getParentSpan(options));
//         // since these message spans are created from same context as the send span,
//         // these message spans don't need to be linked.
//         // replace the original event with the instrumented one
//         eventData[i] = instrumentEventData(eventData[i], messageSpan);
//         messageSpan.end();
//       }
//     }
//   }
//   else if (isEventDataBatch(eventData)) {
//     spanContextsToLink = eventData._messageSpanContexts;
//   }
//   const sendSpan = _createSendSpan(getParentSpan(options), spanContextsToLink);
//   return sendSpan;
// }
// TODO: I don't think this is useful anymore - you can't obtain a single instance of a producer anymore.
// function _throwIfSenderOrConnectionClosed(sender: EventHubSender, context: ConnectionContext): void {
//   throwErrorIfConnectionClosed(context);

//   if (!sender.isOpen()) {
//     const errorMessage =
//       `The EventHubProducer for "${context.config.entityPath}" has been closed and can no longer be used. ` +
//       `Please create a new EventHubProducer using the "createProducer" function on the EventHubClient.`;
//     const error = new Error(errorMessage);
//     logger.warning(`[${context.connectionId}] %O`, error);
//     logErrorStackTrace(error);
//     throw error;
//   }
// }
