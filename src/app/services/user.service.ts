import { SupabaseUserService } from './ui/supabase-user.service';
import { environment } from './../../environments/environments';
import { AuthService } from '../auth/services/auth.service';
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map, switchMap, timeout, tap } from 'rxjs/operators';
import { User } from '../interfaces/user.interface';

@Injectable({
    providedIn: 'root',
})
export class UserService {
    private userAdmin = `${environment.ms_user}/api/admin/users`;

    constructor(
        private http: HttpClient,
        private authService: AuthService,
        private supabaseUserService: SupabaseUserService
    ) { }

    /**
     * 🔐 Obtiene los headers con el token JWT actual para enviar en las peticiones HTTP
     */
    private getHeaders(): Observable<HttpHeaders> {
        return from(this.authService.getToken()).pipe(
            map(
                (token) =>
                    new HttpHeaders({
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    })
            )
        );
    }

    /**
     * 🔍 Obtiene un usuario por su ID desde el backend
     */
    getUserById(id: number): Observable<User | null> {
        return this.getHeaders().pipe(
            switchMap((headers) =>
                this.http.get<User>(`${this.userAdmin}/${id}`, { headers }).pipe(
                    timeout(15000),
                    catchError((error) => {
                        console.error(`Error al obtener usuario con ID ${id}:`, error);
                        return of(null);
                    })
                )
            )
        );
    }

    /**
     * 🆕 Crea un nuevo usuario:
     * - Verifica si el email ya está registrado
     * - Sube la imagen a Supabase si viene en base64
     * - Envía los datos al backend
     */
    createUser(user: User): Observable<User> {
        return this.checkEmailExistsFast(user.email).pipe(
            switchMap((exists) => {
                if (exists) {
                    return throwError(() => new Error('El correo electrónico ya está registrado'));
                }

                if (user.profileImage && user.profileImage.startsWith('data:')) {
                    const tempId = `new_${Date.now()}`;
                    return this.supabaseUserService.uploadProfileImage(user.profileImage, tempId).pipe(
                        switchMap((imageUrl) => {
                            user.profileImage = imageUrl;
                            return this.getHeaders().pipe(
                                switchMap((headers) =>
                                    this.http.post<User>(this.userAdmin, user, { headers }).pipe(
                                        timeout(15000),
                                        catchError((error) => {
                                            console.error('❌ Error al crear usuario en backend:', error);
                                            this.supabaseUserService.deleteProfileImage(imageUrl).subscribe();
                                            return throwError(() => new Error('Error al guardar el usuario.'));
                                        })
                                    )
                                )
                            );
                        })
                    );
                } else {
                    return this.getHeaders().pipe(
                        switchMap((headers) =>
                            this.http.post<User>(this.userAdmin, user, { headers }).pipe(
                                timeout(15000),
                                catchError((error) => {
                                    console.error('❌ Error al crear usuario en backend:', error);
                                    return throwError(() => new Error('Error al guardar el usuario.'));
                                })
                            )
                        )
                    );
                }
            })
        );
    }

    /**
     * 📄 Obtiene la lista de todos los usuarios
     */
    getAllUsers(): Observable<User[]> {
        return this.getHeaders().pipe(
            switchMap((headers) =>
                this.http.get<User[]>(this.userAdmin, { headers }).pipe(
                    timeout(15000),
                    catchError((error) => {
                        console.error('Error al obtener usuarios:', error);
                        return of([]);
                    })
                )
            )
        );
    }

    /**
     * ✏️ Actualiza los datos de un usuario:
     * - Compara la imagen anterior y la nueva
     * - Elimina la imagen antigua si fue reemplazada
     */
    updateUser(user: User): Observable<User> {
        return this.getUserById(user.id!).pipe(
            switchMap((currentUser) => {
                if (!currentUser) {
                    return throwError(() => new Error('Usuario no encontrado'));
                }

                const oldImageUrl = currentUser.profileImage;

                // Si se subió una nueva imagen
                if (user.profileImage && user.profileImage.startsWith('data:')) {
                    return this.supabaseUserService.uploadProfileImage(user.profileImage, user.id!.toString()).pipe(
                        switchMap((newImageUrl) => {
                            user.profileImage = newImageUrl;

                            return this.getHeaders().pipe(
                                switchMap((headers) =>
                                    this.http.put<User>(`${this.userAdmin}/${user.id}`, user, { headers }).pipe(
                                        timeout(15000),
                                        tap(() => {
                                            if (oldImageUrl) {
                                                this.supabaseUserService.deleteProfileImage(oldImageUrl).subscribe();
                                            }
                                        }),
                                        catchError((error) => {
                                            console.error('Error al actualizar usuario:', error);
                                            this.supabaseUserService.deleteProfileImage(newImageUrl).subscribe();
                                            return throwError(() => new Error('No se pudo actualizar.'));
                                        })
                                    )
                                )
                            );
                        })
                    );
                }

                // Si se eliminó la imagen (string vacío)
                else if (user.profileImage === '') {
                    if (oldImageUrl) {
                        this.supabaseUserService.deleteProfileImage(oldImageUrl).subscribe();
                    }

                    return this.getHeaders().pipe(
                        switchMap((headers) =>
                            this.http.put<User>(`${this.userAdmin}/${user.id}`, user, { headers }).pipe(
                                timeout(15000),
                                catchError((error) => {
                                    console.error('Error al actualizar usuario:', error);
                                    return throwError(() => new Error('No se pudo actualizar.'));
                                })
                            )
                        )
                    );
                }

                // Si no hubo cambios en la imagen
                else {
                    return this.getHeaders().pipe(
                        switchMap((headers) =>
                            this.http.put<User>(`${this.userAdmin}/${user.id}`, user, { headers }).pipe(
                                timeout(15000),
                                catchError((error) => {
                                    console.error('Error al actualizar usuario:', error);
                                    return throwError(() => new Error('No se pudo actualizar.'));
                                })
                            )
                        )
                    );
                }
            })
        );
    }

    /**
     * 🗑️ Elimina un usuario:
     * - Elimina primero su imagen si existe
     * - Luego lo elimina del backend
     */
    deleteUser(id: number): Observable<void> {
        return this.getUserById(id).pipe(
            switchMap((user) => {
                const deleteImageObs = user?.profileImage
                    ? this.supabaseUserService.deleteProfileImage(user.profileImage)
                    : of(true);

                return deleteImageObs.pipe(
                    switchMap(() => {
                        return this.getHeaders().pipe(
                            switchMap((headers) => this.http.delete<void>(`${this.userAdmin}/${id}`, { headers }))
                        );
                    })
                );
            })
        );
    }

    /**
     * 🔍 Obtiene un usuario por su email
     */
    getUserByEmail(email: string): Observable<User | null> {
        return this.getHeaders().pipe(
            switchMap((headers) =>
                this.http.get<User>(`${this.userAdmin}/email/${email}`, { headers }).pipe(
                    timeout(15000),
                    catchError((error) => {
                        console.error('Error al obtener usuario por email:', error);
                        return of(null);
                    })
                )
            )
        );
    }

    /**
     * ✅ Verifica si un email ya existe usando getUserByEmail (método más pesado)
     */
    checkEmailExists(email: string): Observable<boolean> {
        return this.getUserByEmail(email).pipe(
            map((user) => !!user),
            catchError(() => of(false))
        );
    }

    /**
     * ⚡ Verifica si un email ya existe usando un endpoint más rápido
     */
    checkEmailExistsFast(email: string): Observable<boolean> {
        return this.getHeaders().pipe(
            switchMap((headers) =>
                this.http.get<boolean>(`${this.userAdmin}/email-exists/${email}`, { headers }).pipe(
                    timeout(10000),
                    catchError((err) => {
                        console.error('❌ Error al verificar email duplicado:', err);
                        return of(false);
                    })
                )
            )
        );
    }
}
