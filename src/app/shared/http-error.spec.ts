import {HttpErrorResponse} from '@angular/common/http';
import {getHttpErrorMessage} from './http-error';

describe('getHttpErrorMessage', () => {
  it('prefers API error text and accepts either structured field', () => {
    for (const error of ['Denied', {error: 'Denied', message: 'Other'}, {error: 42, message: 'Denied'}]) {
      expect(getHttpErrorMessage(new HttpErrorResponse({status: 403, error}))).toBe('Denied');
    }
  });

  it('reports network failures and falls back for empty API responses', () => {
    expect(getHttpErrorMessage(new HttpErrorResponse({status: 0}))).toBe('Unable to reach the server');
    const error = new HttpErrorResponse({status: 503, error: {message: ' '}});
    expect(getHttpErrorMessage(error)).toBe(error.message);
    expect(getHttpErrorMessage({...error, message: ''})).toBe('Request failed with status 503');
  });
});
