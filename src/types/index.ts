export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_open: boolean;
  children?: FileEntry[];
}

export interface Tab {
  id: string;
  name: string;
  path: string | null;
  content: string;
  saved: boolean;
}

export interface Heading {
  level: number;
  text: string;
  line: number;
}

export type ThemeName = 'inkstone' | 'github' | 'onedark' | 'typora';

export interface ThemeOption {
  value: ThemeName;
  label: string;
  forceDark?: boolean;
}

export type ViewMode = 'edit' | 'split' | 'preview';

export type SidebarMode = 'tree' | 'outline' | 'recent' | 'assets';

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  target: FileEntry | null;
  parentPath: string | null;
}

export interface RenamingState {
  active: boolean;
  path: string;
  originalName: string;
  input: string;
}

export interface DocumentAsset {
  raw: string;
  name: string;
  relative: string;
  resolved: string;
  exists: boolean;
}

export type ImageAlign = 'left' | 'center' | 'right';
