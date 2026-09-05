import {extractHttpErrorMessage} from './export-file-utils';

describe('export HTTP errors', () => {
  it('replaces gateway HTML with an actionable message', () => {
    expect(extractHttpErrorMessage({status: 502, error: '<html><h1>502 Bad Gateway</h1></html>'}))
      .toBe('The backend could not complete the export. Please try again.');
    expect(extractHttpErrorMessage({status: 504, error: '<html>Gateway Timeout</html>'}))
      .toBe('The export timed out. Try exporting a smaller selection.');
  });

  it('preserves structured backend timeout messages', () => {
    expect(extractHttpErrorMessage({status: 504, error: '{"error":"Export timed out. Try a smaller selection."}'}))
      .toBe('Export timed out. Try a smaller selection.');
  });

  it('explains interrupted downloads without displaying a partial file', () => {
    expect(extractHttpErrorMessage({status: 0, error: 'http://192.0.2.1:80\n'}))
      .toBe('The download connection was interrupted. Please try again.');
  });

  it('hides HTML from other server failures and preserves plain errors', () => {
    expect(extractHttpErrorMessage({status: 500, error: '<!DOCTYPE html><html>Failure</html>'}))
      .toBe('The server could not complete the export. Please try again.');
    expect(extractHttpErrorMessage({status: 500, error: 'Could not export proxies'}))
      .toBe('Could not export proxies');
  });
});
