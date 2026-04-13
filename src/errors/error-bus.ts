import { Subject, Observable } from 'rxjs';
import type { StrataError } from './strata-error';

export class ErrorBus {
  private readonly subject = new Subject<StrataError>();

  get errors$(): Observable<StrataError> {
    return this.subject.asObservable();
  }

  emit(error: StrataError): void {
    this.subject.next(error);
  }

  dispose(): void {
    this.subject.complete();
  }
}
