declare module 'polyline' {
  export function decode(str: string, precision?: number): number[][];
  export function encode(coords: number[][], precision?: number): string;
}
