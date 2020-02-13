import { PeekedMessage } from "../models";
import { ClientEntityContext } from "../../clientEntityContext";

export async function peek(
  clientEntityContext: ClientEntityContext,
  maxMessageCount?: number
): Promise<PeekedMessage[]> {
  const peekedMessages = await clientEntityContext.managementClient!.peek(maxMessageCount);
  return peekedMessages;
}

export async function peekMessagesBySession(
  clientEntityContext: ClientEntityContext,
  sessionId: string,
  messageCount?: number
): Promise<PeekedMessage[]> {
  return clientEntityContext.managementClient!.peekMessagesBySession(
    sessionId,
    messageCount
  );
}

export async function peekBySequenceNumber(
  clientEntityContext: ClientEntityContext,
  fromSequenceNumber: Long,
  maxMessageCount?: number,
  sessionId?: string,
  associatedLinkName?: string
): Promise<PeekedMessage[]> {
  return clientEntityContext.managementClient!.peekBySequenceNumber(
    fromSequenceNumber,
    maxMessageCount,
    sessionId,
    // TODO: Hm...I don't think this was intended to not be here.
    // associatedLinkName
  );
}
