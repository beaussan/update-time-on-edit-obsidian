import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';

export const log = (name: string) => <T>(
  source$: Observable<T>,
): Observable<T> =>
  source$.pipe(
    tap((value) => console.log(`${name}:`, value)),
    finalize(() => console.log(`${name}: complete`)),
  );
