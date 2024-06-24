const EMPTY_SET = new Set<never>();

export class Graph<T> {
    incomingConnections: Map<T, Set<T>>;
    outgoingConnections: Map<T, Set<T>>;

    constructor() {
        this.incomingConnections = new Map();
        this.outgoingConnections = new Map();
    }

    /**
     * Add a directed connection from one node to another
     * @param src The source node
     * @param dst The destination node
     * @returns True if the connection already exists, false if not
     */
    connect(src: T, dst: T) {
        let outgoing = this.outgoingConnections.get(src);
        if (!outgoing) {
            outgoing = new Set();
            this.outgoingConnections.set(src, outgoing);
        }
        const exists = outgoing.has(dst);
        outgoing.add(dst);

        let incoming = this.incomingConnections.get(dst);
        if (!incoming) {
            incoming = new Set();
            this.incomingConnections.set(dst, incoming);
        }
        incoming.add(src);

        return exists;
    }

    /**
     * Remove a directed connection from one node to another
     * @param src The source node
     * @param dst The destination node
     * @returns True if the connection existed, false if not
     */
    disconnect(src: T, dst: T) {
        const outgoing = this.outgoingConnections.get(src);
        if (!outgoing) return;
        const exists = outgoing.has(dst);
        outgoing.delete(dst);
        if (outgoing.size === 0) {
            this.outgoingConnections.delete(src);
        }

        const incoming = this.incomingConnections.get(dst);
        if (!incoming) return;
        incoming.delete(src);
        if (incoming.size === 0) {
            this.incomingConnections.delete(dst);
        }

        return exists;
    }

    isConnected(src: T, dst: T) {
        return !!this.outgoingConnections.get(src)?.has(dst);
    }

    outgoing(src: T): Set<T> {
        return this.outgoingConnections.get(src) ?? EMPTY_SET;
    }

    incoming(dst: T): Set<T> {
        return this.incomingConnections.get(dst) ?? EMPTY_SET;
    }
}
