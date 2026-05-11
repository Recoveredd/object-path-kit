export type PathSegment = string | number;
export type PathInput = string | readonly PathSegment[];

export interface PathOptions {
  allowUnsafe?: boolean;
}

export interface ValidatePathResult {
  error?: Error;
  segments: PathSegment[];
  valid: boolean;
}
