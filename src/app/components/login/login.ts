import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  isLoginMode: boolean = true;

  loginData = { email: '', password: '' };
  registerData = { name: '', email: '', password: '', phone: '' };

  errorMessage = '';
  successMessage = '';

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  onLogin() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.loginData.email || !this.loginData.password) {
      this.errorMessage = 'Lütfen tüm alanları doldurun.';
      this.cdr.detectChanges();
      return;
    }

    this.http.post<any>('http://localhost:3000/api/auth/login', this.loginData).subscribe({
      next: (res) => {
        // sessionStorage kullanılarak sekme çakışması engellendi
        sessionStorage.setItem('currentUser', JSON.stringify(res.user));

        // Müşteri sayfasına yönlendiriyoruz
        this.router.navigate(['/musteri']);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Giriş yapılamadı!';
        this.loginData.password = ''; // Hata anında şifreyi temizle
        this.cdr.detectChanges();
      }
    });
  }

  onRegister() {
    this.errorMessage = '';
    this.successMessage = '';

    // 1. Boş alan kontrolü
    if (!this.registerData.name || !this.registerData.email || !this.registerData.password || !this.registerData.phone) {
      this.errorMessage = 'Lütfen tüm alanları eksiksiz doldurun.';
      this.cdr.detectChanges();
      return;
    }

    // 2. İsim uzunluk kontrolü (en az 3 karakter)
    if (this.registerData.name.trim().length < 3) {
      this.errorMessage = 'Ad Soyad en az 3 karakterden olmalıdır.';
      this.cdr.detectChanges();
      return;
    }

    // 3. E-posta format kontrolü
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(this.registerData.email)) {
      this.errorMessage = 'Lütfen geçerli bir e-posta adresi girin (örn: ornek@mail.com).';
      this.cdr.detectChanges();
      return;
    }

    // 4. Şifre uzunluk kontrolü (en az 6 karakter)
    if (this.registerData.password.length < 6) {
      this.errorMessage = 'Şifre en az 6 karakter olmalıdır.';
      this.cdr.detectChanges();
      return;
    }

    // 5. Telefon numarası format kontrolü
    const phoneRegex = /^(\+90|0)?5\d{9}$/;
    if (!phoneRegex.test(this.registerData.phone.replace(/\s+/g, ''))) {
      this.errorMessage = 'Lütfen geçerli bir telefon numarası girin (örn: 05321234567).';
      this.cdr.detectChanges();
      return;
    }

    // Backend'e istek atma
    this.http.post<any>('http://localhost:3000/api/auth/register', this.registerData).subscribe({
      next: (res) => {
        this.successMessage = 'Kayıt başarıyla oluşturuldu! Giriş sayfasına yönlendiriliyorsunuz...';
        this.registerData = { name: '', email: '', password: '', phone: '' };

        this.cdr.detectChanges();

        setTimeout(() => {
          this.isLoginMode = true;
          this.successMessage = '';
          this.cdr.detectChanges();
        }, 2000);
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Kayıt olunamadı!';
        this.cdr.detectChanges();
      }
    });
  }
}
