import {HttpErrorResponse} from '@angular/common/http';

export function getHttpErrorMessage(error: HttpErrorResponse, fallback = error.status > 0 ? `Request failed with status ${error.status}` : 'Unknown error'): string {
  const apiError: unknown = error.error;
  if (typeof apiError === 'string' && apiError.trim()) {
    return apiError;
  }
  if (apiError && typeof apiError === 'object') {
    const structured = apiError as {error?: unknown; message?: unknown};
    for (const value of [structured.error, structured.message]) {
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }
  }
  if (error.status === 0) {
    return 'Unable to reach the server';
  }
  return error.message?.trim() || fallback;
}
