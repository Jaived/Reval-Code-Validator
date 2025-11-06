import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ToastMessage {
  id: string;
  title?: string;
  body: string;
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'info';
  timeout?: number; // ms
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private messagesSubject = new BehaviorSubject<ToastMessage[]>([]);
  messages$ = this.messagesSubject.asObservable();

  show(msg: Omit<ToastMessage, 'id'>) {
    const id = Math.random().toString(36).slice(2, 9);
    const message: ToastMessage = { id, ...msg } as ToastMessage;
    const current = this.messagesSubject.value.slice();
    current.push(message);
    this.messagesSubject.next(current);

    if (message.timeout && message.timeout > 0) {
      setTimeout(() => this.dismiss(id), message.timeout);
    }
    return id;
  }

  dismiss(id: string) {
    const next = this.messagesSubject.value.filter(m => m.id !== id);
    this.messagesSubject.next(next);
  }
}
