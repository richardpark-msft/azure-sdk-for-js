import { ConnectionContext } from "../connectionContext";

/**
 * Opaque class that
 */
export class SessionConnectionCache {
  // constructor() {
  //     this.queueConnections = new Map<string, ConnectionContext>();
  //     this.topicConnections = new Map<string, ConnectionContext>();
  //     this.subscriptionConnections = new Map<string, ConnectionContext>();
  // }
  //   queueConnections: Map<string, ConnectionContext>;
  //   topicConnections: Map<string, ConnectionContext>;
  //   subscriptionConnections: Map<string, ConnectionContext>;
}

/**
 * @internal
 * @ignore
 */
export interface SessionConnectionCacheInternal {
  queueConnections: Map<string, ConnectionContext>;
  topicConnections: Map<string, ConnectionContext>;
  subscriptionConnections: Map<string, ConnectionContext>;
}
