import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'history',
    loadComponent: () => import('./features/history/history.component').then(m => m.HistoryComponent)
  },
  {
    path: 'detail/:id',
    loadComponent: () => import('./features/detail/detail.component').then(m => m.DetailComponent)
  },
  {
    path: 'verify',
    loadComponent: () => import('./features/verify/verify.component').then(m => m.VerifyComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
