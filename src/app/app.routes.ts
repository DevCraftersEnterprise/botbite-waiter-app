import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard, clientGuard, userGuard } from './core/guards/roles.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login-component/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'menu/:menuId',
    loadComponent: () =>
      import('./features/public/menu-viewer/menu-viewer.component').then(
        (m) => m.MenuViewerComponent
      ),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/layout/shell-component/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'home',
      },
      {
        path: 'home',
        loadComponent: () =>
          import('./features/dashboard/home-component/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'categories',
        canActivate: [clientGuard],
        loadComponent: () =>
          import('./features/dashboard/categories-component/categories.component').then(
            (m) => m.CategoriesComponent
          ),
      },
      {
        path: 'restaurants',
        loadComponent: () =>
          import('./features/dashboard/restaurants-component/restaurants.component').then(
            (m) => m.RestaurantsComponent
          ),
      },
      {
        path: 'branches',
        loadComponent: () =>
          import('./features/dashboard/branches-component/branches.component').then(
            (m) => m.BranchesComponent
          ),
      },
      {
        path: 'users',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./features/dashboard/users-component/users.component').then(
            (m) => m.UsersComponent
          ),
      },
      {
        path: 'products',
        canActivate: [clientGuard],
        loadComponent: () =>
          import('./features/dashboard/products-component/products.component').then(
            (m) => m.ProductsComponent
          ),
      },
      {
        path: 'menus',
        canActivate: [clientGuard],
        loadComponent: () =>
          import('./features/dashboard/menus-component/menus.component').then(
            (m) => m.MenusComponent
          ),
      },
      {
        path: 'menus/:slug',
        canActivate: [clientGuard],
        loadComponent: () =>
          import('./features/dashboard/menu-items-component/menu-items.component').then(
            (m) => m.MenuItemsComponent
          ),
      },
      {
        path: 'orders',
        canActivate: [userGuard],
        loadComponent: () =>
          import('./features/dashboard/orders-component/orders.component').then(
            (m) => m.OrdersComponent
          ),
      },
      {
        path: 'notifications',
        canActivate: [userGuard],
        loadComponent: () =>
          import('./features/dashboard/notifications-component/notifications.component').then(
            m => m.NotificationsComponent
          )
      }
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: '/login' },
  { path: '**', redirectTo: '/login' },
];
