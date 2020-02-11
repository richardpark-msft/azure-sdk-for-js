import { ConnectionContext } from "../connectionContext";

export class ConnectionCache {
    constructor() {
        this.queueConnections = new Map<string, ConnectionContext>();
        this.topicConnections = new Map<string, ConnectionContext>();
        this.subscriptionConnections = new Map<string, ConnectionContext>();
    }

    queueConnections: Map<string, ConnectionContext>;
    topicConnections: Map<string, ConnectionContext>;
    subscriptionConnections: Map<string, ConnectionContext>;
}