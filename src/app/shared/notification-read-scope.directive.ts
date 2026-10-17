import {Directive} from '@angular/core';
import {NotificationReadService} from '../services/notification-read.service';

// One shared store for the authenticated shell and its routed pages. Removing
// the shell on sign-out destroys the store and cancels the old account's work.
@Directive({selector: '[appNotificationReadScope]', providers: [NotificationReadService]})
export class NotificationReadScopeDirective {}
