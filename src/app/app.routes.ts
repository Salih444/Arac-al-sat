import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login';
import { MusteriComponent } from './components/musteri/musteri'; // Doğru sınıf adını çağırıyoruz

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'musteri', component: MusteriComponent }, // Musteri yerine MusteriComponent
  { path: '', redirectTo: 'login', pathMatch: 'full' }
];
