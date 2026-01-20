import { Injectable } from '@angular/core';
import {
    HttpInterceptor,
    HttpRequest,
    HttpHandler,
    HttpEvent,
    HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import Swal from 'sweetalert2';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
    constructor(
        private authService: AuthService,
        private router: Router
    ) { }

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        return next.handle(request).pipe(
            catchError((error: HttpErrorResponse) => {
                // 🔐 Error 401 o 403 (no autorizado)
                if (error.status === 401 || error.status === 403) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Sesión expirada',
                        text: 'Tu sesión ha caducado. Por favor inicia sesión nuevamente.',
                        confirmButtonColor: '#2563eb' // azul Tailwind
                    }).then(() => {
                        this.authService.logout();
                        this.router.navigate(['/login']);
                    });
                }

                // 💥 Error 500+ (servidor)
              //  else if (error.status >= 500) {
               //     Swal.fire({
                //        icon: 'error',
                 //       title: 'Error del servidor',
                  //      text: 'Ocurrió un error inesperado. Intenta más tarde.',
                   //     confirmButtonColor: '#ef4444' // rojo Tailwind
                   // });
                //}

                return throwError(() => error);
            })
        );
    }
}
