import {
    Component,
    EventEmitter,
    Input,
    OnChanges,
    OnInit,
    Output,
    SimpleChanges,
    AfterViewInit,
} from "@angular/core"
import { CommonModule } from "@angular/common"
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms"
import Swal from "sweetalert2"
import { User } from "../../../../../interfaces/user.interface"

@Component({
    selector: "app-user-modal",
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: "./user-modal.component.html",
    styleUrls: ["./user-modal.component.css"],
})
export class UserModalComponent implements OnInit, OnChanges, AfterViewInit {
    @Input() user: User | null = null               // Recibe el usuario si es modo edición
    @Output() formSubmit = new EventEmitter<User>() // Emite el formulario al guardar
    @Output() formCancel = new EventEmitter<void>() // Emite evento al cancelar

    userForm!: FormGroup                            // Formulario reactivo
    isEditing = false                               // Controla si es edición o creación
    isSubmitting = false                            // Evita múltiples envíos
    showPassword = false                            // Alterna visibilidad de la contraseña
    profilePreview: string | null = null            // Previsualización de imagen de perfil

    constructor(private fb: FormBuilder) { }

    // 🔄 Inicializa el formulario al cargar el componente
    ngOnInit(): void {
        this.createForm()
    }

    // 🧠 Se ejecuta después de renderizar la vista para actualizar si es modo edición
    ngAfterViewInit(): void {
        if (this.user && this.user.id && this.userForm) {
            setTimeout(() => {
                this.updateFormWithUserData()
            })
        }
    }

    // 🧩 Actualiza el formulario con los datos del usuario recibido
    updateFormWithUserData(): void {
        if (!this.user) return

        this.userForm.reset()

        this.userForm.patchValue({
            id: this.user.id,
            name: this.user.name,
            lastName: this.user.lastName,
            documentType: this.user.documentType,
            documentNumber: this.user.documentNumber,
            cellPhone: this.user.cellPhone,
            email: this.user.email,
            role: this.user.role[0] || "USER",
            firebaseUid: this.user.firebaseUid || "",
            profileImage: this.user.profileImage || "",
            password: "********",
        })

        this.profilePreview = this.user.profileImage || null

        // Deshabilitar email y contraseña al editar
        this.userForm.get("email")?.disable()
        this.userForm.get("password")?.disable()
        this.userForm.get("password")?.clearValidators()
        this.userForm.get("password")?.updateValueAndValidity()

        this.isEditing = true
    }

    // 🔁 Detecta si cambia el input `user` para recargar el formulario
    ngOnChanges(changes: SimpleChanges): void {
        if (changes["user"] && changes["user"].currentValue && this.userForm) {
            if (this.user && this.user.id) {
                this.updateFormWithUserData()
            } else {
                // Reinicia el formulario si es nuevo usuario
                this.isEditing = false
                this.profilePreview = null
                this.userForm.reset()

                this.userForm.get("email")?.enable()
                this.userForm.get("password")?.enable()
                this.userForm.get("password")?.setValidators([Validators.required, Validators.minLength(6)])
                this.userForm.get("password")?.updateValueAndValidity()
            }
        }
    }

    // 📄 Crea la estructura del formulario reactivo con validaciones
    createForm(): void {
        this.userForm = this.fb.group({
            id: [null],
            name: ["", [Validators.required, Validators.pattern(/^[A-Z][a-zA-Z0-9 ]*$/)]],
            lastName: ["", [Validators.required, Validators.pattern(/^([A-Z][a-z]*)(\s[A-Z][a-z]*)*$/)]],
            documentType: ["DNI", Validators.required],
            documentNumber: ["", [Validators.required, Validators.pattern(/^\d+$/), this.documentNumberValidator()]],
            cellPhone: ["", [Validators.required, Validators.pattern(/^\d{9}$/)]],
            email: ["", [Validators.required, Validators.email]],
            password: ["", [Validators.minLength(6)]],
            role: ["USER", Validators.required],
            firebaseUid: [""],
            profileImage: ["", Validators.required],
        })

        // Revalida el número si cambia el tipo de documento
        this.userForm.get("documentType")?.valueChanges.subscribe(() => {
            this.userForm.get("documentNumber")?.updateValueAndValidity()
        })
    }

    // 🧾 Valida longitud del número según el tipo de documento
    documentNumberValidator() {
        return (control: any) => {
            const type = this.userForm?.get("documentType")?.value
            const value = control.value
            if (type === "DNI" && value?.length !== 8) return { invalidLength: true }
            if (type === "CNE" && (value?.length < 8 || value?.length > 20)) return { invalidLength: true }
            return null
        }
    }

    // 🔐 Alterna la visibilidad de la contraseña
    togglePasswordVisibility(): void {
        this.showPassword = !this.showPassword
    }

    // 🖼️ Al seleccionar imagen, la convierte, redimensiona y verifica tamaño
    onImageSelected(event: any): void {
        const file: File = event.target.files[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (e: any) => {
            const img = new Image()
            img.src = e.target.result

            img.onload = () => {
                const canvas = document.createElement("canvas")
                const MAX_WIDTH = 300
                const scaleSize = MAX_WIDTH / img.width
                canvas.width = MAX_WIDTH
                canvas.height = img.height * scaleSize

                const ctx = canvas.getContext("2d")
                if (!ctx) return

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

                const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7)

                const base64Length = compressedBase64.length - (compressedBase64.indexOf(",") + 1)
                const sizeInKB = (4 * Math.ceil(base64Length / 3)) / 1024

                if (sizeInKB > 200) {
                    Swal.fire({
                        icon: "warning",
                        title: "Imagen demasiado grande",
                        text: `La imagen comprimida aún pesa ${Math.round(sizeInKB)} KB. Usa una más ligera.`,
                        confirmButtonText: "Entendido",
                    })
                    return
                }

                this.profilePreview = compressedBase64
                this.userForm.patchValue({ profileImage: compressedBase64 })

                Swal.fire({
                    icon: "success",
                    title: "Imagen cargada",
                    text: `Imagen lista (${Math.round(sizeInKB)} KB).`,
                    timer: 1500,
                    showConfirmButton: false,
                })
            }
        }

        reader.readAsDataURL(file)
    }

    // ✅ Envía el formulario si es válido, con lógica para crear o editar
    onSubmit(): void {
        if (this.userForm.valid) {
            if (!this.profilePreview && !this.isEditing) {
                Swal.fire({
                    icon: "error",
                    title: "Imagen requerida",
                    text: "Por favor, seleccione una imagen de perfil",
                    confirmButtonText: "Entendido",
                })
                return
            }

            this.isSubmitting = true
            const formValue = this.userForm.getRawValue()
            formValue.role = [formValue.role.toUpperCase()]

            if (this.isEditing) {
                delete formValue.password // No enviar password al editar

                // Lógica de imagen al editar
                if (!this.profilePreview && !this.user?.profileImage) {
                    formValue.profileImage = ""
                } else if (!this.profilePreview && this.user?.profileImage) {
                    formValue.profileImage = ""
                } else if (this.profilePreview === this.user?.profileImage) {
                    delete formValue.profileImage
                }
            }

            this.formSubmit.emit(formValue)
            this.isSubmitting = false
        } else {
            this.userForm.markAllAsTouched()

            // Validación especial para imagen
            if (this.userForm.get("profileImage")?.hasError("required") && !this.profilePreview) {
                Swal.fire({
                    icon: "error",
                    title: "Imagen requerida",
                    text: "Por favor, seleccione una imagen de perfil",
                    confirmButtonText: "Entendido",
                })
            }
        }
    }

    // 🔙 Cancela el formulario y emite evento al padre
    onCancel(): void {
        this.formCancel.emit()
    }

    // ⬆️ Capitaliza la primera letra de un campo (input)
    capitalizeFirstLetter(event: any): void {
        const input = event.target
        if (input.value.length > 0) {
            input.value = input.value.charAt(0).toUpperCase() + input.value.slice(1)
        }
    }

    // 🔠 Capitaliza cada palabra del campo (ej. apellido compuesto)
    capitalizeEachWord(event: any): void {
        const input = event.target
        const words = input.value.split(" ")
        const capitalized = words.map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        input.value = capitalized.join(" ")
    }
}
