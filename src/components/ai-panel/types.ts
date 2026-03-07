export interface GenerationState {
  type: 'idle' | 'loading' | 'success' | 'error';
  sql?: string;
  explanation?: string;
  error?: string;
}
