import {EMPTY, catchError, map} from 'rxjs';
import {HttpService} from '../services/http.service';
import {NotificationService} from '../services/notification-service.service';
import {buildFilterOptionList, normalizeFilterOptions} from './proxy-filters';

// Keep loading state with each caller instead of introducing a shared cache.
export function loadProxyFilterOptions(http: HttpService, notification: NotificationService) {
  return http.getProxyFilterOptions().pipe(
    map(options => {
      const filters = normalizeFilterOptions(options);
      return {
        filters,
        countries: buildFilterOptionList(filters.countries),
        types: buildFilterOptionList(filters.types),
        anonymityLevels: buildFilterOptionList(filters.anonymityLevels),
      };
    }),
    catchError(error => {
      const message = error?.error?.message ?? error?.message ?? 'Unknown error';
      notification.showError('Could not load filter options: ' + message);
      return EMPTY;
    }),
  );
}
