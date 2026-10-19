export type NodeType = "text" | "link" | "image" | "table";

export interface MindNode {
  id: string;
  parentId: string | null;
  children: string[];
  text: string;
  type: NodeType;
  /** For link nodes. */
  url?: string;
  /** For image nodes: id of a row in the local `assets` table (images stay on-device). */
  assetId?: string;
  /** For table nodes: rows x cols of cell text. */
  table?: string[][];
  collapsed?: boolean;
}

export type MapStyle = "curved" | "elbow" | "boxed";

export interface Note {
  id: string;
  title: string;
  folderId: string | null;
  rootId: string;
  nodes: Record<string, MindNode>;
  mapStyle: MapStyle;
  createdAt: number;
  updatedAt: number;
  /** Set when moved to the recycle bin. */
  deletedAt?: number | null;
  /** Last time this note was confirmed in the cloud (sync only). */
  syncedAt?: number | null;
  /** Marks notes created from a sync conflict. */
  conflictOf?: string | null;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface Asset {
  id: string;
  noteId: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: number;
}

export type ViewMode = "map" | "outline";

export interface Settings {
  theme: "light" | "dark" | "system";
  defaultMapStyle: MapStyle;
  aiEnabled: boolean;
  syncEnabled: boolean;
  defaultView: ViewMode;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  defaultMapStyle: "curved",
  aiEnabled: true,
  syncEnabled: true,
  defaultView: "map",
};
