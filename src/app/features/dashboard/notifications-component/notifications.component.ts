import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Check, LucideAngularModule, RotateCcw } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { OrgService } from '../../../core/services/org.service';
import { CashierNotification, SocketService } from '../../../core/services/socket.service';
import { TitleComponent } from '../../../shared/components/title/title';
import { OrdersService } from '../../../core/services/orders.service';

@Component({
  selector: 'app-notifications-component',
  imports: [CommonModule, LucideAngularModule, TitleComponent],
  templateUrl: './notifications.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsComponent implements OnInit, OnDestroy {
  protected readonly orgService = inject(OrgService);
  private readonly ordersService = inject(OrdersService);
  private readonly toastrService = inject(ToastrService);
  private readonly socketService = inject(SocketService);

  private notificationSubscription?: Subscription;

  activeNotifications = signal<CashierNotification[]>([]);
  inactiveNotifications = signal<CashierNotification[]>([]);
  isLoading = signal<boolean>(true);

  readonly checkIcon = Check;
  readonly rotateCcwIcon = RotateCcw;

  ngOnInit(): void {
    const branchId = this.orgService.selectedBranchId();

    if (!branchId) {
      this.toastrService.error('No se ha seleccionado una sucursal.');
      return;
    }

    this.loadNotifications(branchId);

    this.socketService.joinBranch(branchId);

    this.notificationSubscription = this.socketService
      .getNotificationUpdates()
      .subscribe((update) => {
        this.handleNotificationUpdate(update.notification);
      });
  }

  private loadNotifications(branchId: string): void {
    this.isLoading.set(true);
    this.ordersService.getNotificationsByBranch(branchId).subscribe({
      next: (data: { active: CashierNotification[]; inactive: CashierNotification[] }) => {
        this.activeNotifications.set(data.active);
        this.inactiveNotifications.set(data.inactive);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading notifications:', error);
        this.toastrService.error('Error al cargar las notificaciones.');
        this.isLoading.set(false);
      }
    });
  }

  private handleNotificationUpdate(notification: CashierNotification): void {
    if (notification.isActive) {
      const activeList = this.activeNotifications();
      const index = activeList.findIndex(n => n.id === notification.id);

      if (index >= 0) {
        const updated = [...activeList];
        updated[index] = notification;
        this.activeNotifications.set(updated);
      } else {
        this.activeNotifications.set([notification, ...activeList]);
        this.toastrService.info(notification.message, 'Nueva notificación');
      }

      this.removeFromInactive(notification.id);
    } else {
      const inactiveList = this.inactiveNotifications();
      const index = inactiveList.findIndex(n => n.id === notification.id);

      if (index >= 0) {
        const updated = [...inactiveList];
        updated[index] = notification;
        this.inactiveNotifications.set(updated);
      } else {
        this.inactiveNotifications.set([notification, ...inactiveList]);
      }

      this.removeFromActive(notification.id);
    }
  }

  private removeFromActive(notificationId: string): void {
    const updated = this.activeNotifications().filter(n => n.id !== notificationId);
    this.activeNotifications.set(updated);
  }

  private removeFromInactive(notificationId: string): void {
    const updated = this.inactiveNotifications().filter(n => n.id !== notificationId);
    this.inactiveNotifications.set(updated);
  }

  markAsRead(notification: CashierNotification): void {
    if (!notification.isActive) return;

    const updated = { ...notification, isActive: false };
    this.handleNotificationUpdate(updated);

    this.ordersService.markNotificationAsRead(notification.id).subscribe({
      error: () => {
        this.handleNotificationUpdate(notification);
        this.toastrService.error('Error al marcar la notificación como leída.');
      }
    });
  }

  markAsUnread(notification: CashierNotification): void {
    if (notification.isActive) return;

    const updated = { ...notification, isActive: true };
    this.handleNotificationUpdate(updated);

    this.ordersService.markNotificationAsUnread(notification.id).subscribe({
      error: () => {
        this.handleNotificationUpdate(notification);
        this.toastrService.error('Error al marcar la notificación como no leída.');
      }
    });
  }

  ngOnDestroy(): void {
    const branchId = this.orgService.selectedBranchId();
    if (branchId) {
      this.socketService.leaveBranch(branchId);
    }
    this.notificationSubscription?.unsubscribe();
  }
}