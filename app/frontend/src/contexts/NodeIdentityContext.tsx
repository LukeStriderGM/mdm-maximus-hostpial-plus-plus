import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getHubs, getSpokes, type Hub, type Spoke } from "../lib/api";

type NodeType = "hub" | "spoke";

interface NodeIdentity {
  nodeId: string | null;
  nodeType: NodeType | null;
  nodeName: string | null;
  isHub: boolean;
  isSpoke: boolean;
  setNode: (id: string, type: NodeType) => void;
  isEnvConfigured: boolean;
}

const NodeIdentityContext = createContext<NodeIdentity | null>(null);

const ENV_NODE_ID = import.meta.env.VITE_NODE_ID || "";
const ENV_NODE_TYPE = (import.meta.env.VITE_NODE_TYPE || "") as NodeType | "";
const STORAGE_KEY = "h++:node-identity";

function loadPersistedNode(): { id: string; type: NodeType } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.id && parsed.type) return parsed;
  } catch { /* ignore */ }
  return null;
}

export function NodeIdentityProvider({ children }: { children: ReactNode }) {
  const isEnvConfigured = !!(ENV_NODE_ID && ENV_NODE_TYPE);
  const persisted = !isEnvConfigured ? loadPersistedNode() : null;

  const [nodeId, setNodeId] = useState<string | null>(ENV_NODE_ID || persisted?.id || null);
  const [nodeType, setNodeType] = useState<NodeType | null>((ENV_NODE_TYPE as NodeType) || persisted?.type || null);
  const [nodeName, setNodeName] = useState<string | null>(null);

  const { data: hubs } = useQuery({ queryKey: ["hubs"], queryFn: getHubs });
  const { data: spokes } = useQuery({ queryKey: ["spokes"], queryFn: () => getSpokes() });

  // Resolve node name whenever nodeId/nodeType or fetched data changes
  useEffect(() => {
    if (!nodeId || !nodeType) {
      setNodeName(null);
      return;
    }
    if (nodeType === "hub") {
      const hub = hubs?.find((h: Hub) => h.id === nodeId);
      if (hub) setNodeName(hub.name);
    } else {
      const spoke = spokes?.find((s: Spoke) => s.id === nodeId);
      if (spoke) setNodeName(spoke.name);
    }
  }, [nodeId, nodeType, hubs, spokes]);

  const setNode = (id: string, type: NodeType) => {
    setNodeId(id);
    setNodeType(type);
    if (!isEnvConfigured) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, type }));
    }
  };

  return (
    <NodeIdentityContext.Provider
      value={{
        nodeId,
        nodeType,
        nodeName,
        isHub: nodeType === "hub",
        isSpoke: nodeType === "spoke",
        setNode,
        isEnvConfigured,
      }}
    >
      {children}
    </NodeIdentityContext.Provider>
  );
}

export function useNodeIdentity() {
  const ctx = useContext(NodeIdentityContext);
  if (!ctx) throw new Error("useNodeIdentity must be used within NodeIdentityProvider");
  return ctx;
}
