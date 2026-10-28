/* Sistema criado por Diego Mendes Rodrigues, apenas para a utilização em demonstrações, usando informações e funcionalidades criadas por inteligência   artificial */
export type Tool = 'select' | 'text' | 'image' | 'rect' | 'highlight' | 'eraser';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PageRange {
  start: number;
  end: number;
}

export interface PageInfo {
  index: number;
  width: number;
  height: number;
  rotation: number;
  transform: number[];
}

export interface TextItemInfo {
  key: string;
  str: string;
  rect: Rect;
  origin: Point;
  fontSize: number;
}

export interface ImageRegionInfo {
  key: string;
  rect: Rect;
}

export interface TextProps {
  text: string;
  fontSize: number;
  color: string;
  bold: boolean;
}

export type EditorElement =
  | {
      id: string;
      page: number;
      kind: 'text';
      rect: Rect;
      origin: Point;
      props: TextProps;
      wrap: boolean;
      cover?: string;
    }
  | { id: string; page: number; kind: 'image'; rect: Rect; src: string; opacity: number }
  | {
      id: string;
      page: number;
      kind: 'rect';
      rect: Rect;
      fill: string;
      stroke: string;
      strokeWidth: number;
      opacity: number;
    }
  | { id: string; page: number; kind: 'highlight'; rect: Rect; color: string; opacity: number }
  | { id: string; page: number; kind: 'erase'; rect: Rect; color: string };

export type ElementKind = EditorElement['kind'];
