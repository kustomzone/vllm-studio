/**
 * NodeRegistry adapter — wraps upstream DistributedClusterManager.
 */
import type { LayerAllocation, NodeRecord, NodeRegistry } from "../interfaces";

export interface UpstreamClusterManager {
  registerNode(input: {
    node_id: string;
    host?: string;
    label?: string;
  }): Promise<{
    node_id: string;
    host: string | null;
    status: string;
    last_heartbeat_at: string;
    created_at: string;
  }>;
  heartbeat(
    nodeId: string,
    input: Record<string, unknown>,
  ): Promise<{
    node_id: string;
    host: string | null;
    status: string;
    last_heartbeat_at: string;
    created_at: string;
  } | null>;
  setAllocation(
    modelId: string,
    nodeId: string,
    startLayer: number,
    endLayer: number,
  ): Promise<void>;
  clearAllocation(modelId: string, nodeId: string): Promise<boolean>;
  listNodes(): Array<{
    node_id: string;
    host: string | null;
    status: string;
    last_heartbeat_at: string;
    created_at: string;
  }>;
  listAllocations(modelId?: string): Array<{
    model_id: string;
    node_id: string;
    start_layer: number;
    end_layer: number;
  }>;
}

let _allocCounter = 0;

export class NodeRegistryAdapter implements NodeRegistry {
  private readonly upstream: UpstreamClusterManager;

  constructor(upstream: UpstreamClusterManager) {
    this.upstream = upstream;
  }

  register(
    nodeId: string,
    host: string,
    labels?: Record<string, string>,
  ): NodeRecord {
    // Fire-and-forget the async upstream call; return synchronous kernel record
    void this.upstream.registerNode({ node_id: nodeId, host });
    return {
      nodeId,
      host,
      labels: labels ?? {},
      registeredAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
    };
  }

  heartbeat(nodeId: string): NodeRecord {
    void this.upstream.heartbeat(nodeId, {});
    const nodes = this.upstream.listNodes();
    const n = nodes.find((node) => node.node_id === nodeId);
    if (!n) throw new Error(`Unknown node: ${nodeId}`);
    return {
      nodeId: n.node_id,
      host: n.host,
      labels: {},
      registeredAt: n.created_at,
      lastHeartbeatAt: n.last_heartbeat_at,
    };
  }

  setAllocation(
    nodeId: string,
    modelKey: string,
    startLayer: number,
    endLayer: number,
  ): LayerAllocation {
    void this.upstream.setAllocation(modelKey, nodeId, startLayer, endLayer);
    return {
      allocationId: `alloc-${String(++_allocCounter).padStart(4, "0")}`,
      nodeId,
      modelKey,
      startLayer,
      endLayer,
    };
  }

  clearAllocation(modelKey: string, nodeId: string): boolean {
    void this.upstream.clearAllocation(modelKey, nodeId);
    return true;
  }

  listNodes(): NodeRecord[] {
    return this.upstream.listNodes().map((n) => ({
      nodeId: n.node_id,
      host: n.host,
      labels: {},
      registeredAt: n.created_at,
      lastHeartbeatAt: n.last_heartbeat_at,
    }));
  }

  listAllocations(modelKey?: string): LayerAllocation[] {
    return this.upstream.listAllocations(modelKey).map((a, i) => ({
      allocationId: `alloc-${a.model_id}-${a.node_id}`,
      nodeId: a.node_id,
      modelKey: a.model_id,
      startLayer: a.start_layer,
      endLayer: a.end_layer,
    }));
  }
}
