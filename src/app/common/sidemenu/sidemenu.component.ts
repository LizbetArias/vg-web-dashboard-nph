import { Component, OnInit, HostListener, Output, EventEmitter } from '@angular/core';
import { Router, RouterModule, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MENU_ITEMS, MenuItem } from '../../utils/menu-items';
import { AuthService } from '../../auth/services/auth.service';
import { ThemeService } from '../../services/ui/theme.service';
import { SidebarService } from '../../services/ui/sidebar.service';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-sidemenu',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './sidemenu.component.html',
  styleUrls: ['./sidemenu.component.css']
})
export class SidemenuComponent implements OnInit {
  @Output() toggleMobileMenu = new EventEmitter<boolean>();

  menuItems: MenuItem[] = [];
  userRole: string | null = null;

  dropdownIndex: number | null = null;
  subDropdownIndex: Map<number, number | null> = new Map();
  grandSubDropdownIndex: Map<number, Map<number, number | null>> = new Map();

  isSidebarCollapsed = new BehaviorSubject<boolean>(false);
  isSidebarCollapsed$ = this.isSidebarCollapsed.asObservable();

  isMobile = false;
  isMobileMenuOpen = false;
  darkMode$ = this.themeService.darkMode$;

  constructor(
    private router: Router,
    private authService: AuthService,
    private themeService: ThemeService,
    private sidebarService: SidebarService
  ) { }

  ngOnInit(): void {
    this.userRole = this.authService.getRole();
    this.menuItems = this.filterMenuByRole(MENU_ITEMS, this.userRole);

    const savedState = localStorage.getItem('sidebar-collapsed');
    if (savedState) {
      this.isSidebarCollapsed.next(savedState === 'true');
    }

    this.checkScreenSize();

    this.sidebarService.mobileSidebarOpen$.subscribe(isOpen => {
      this.isMobileMenuOpen = isOpen;
    });
  }

  @HostListener('window:resize')
  onResize() {
    this.checkScreenSize();
  }

  checkScreenSize(): void {
    this.isMobile = window.innerWidth < 768;
    if (this.isMobile && !this.isSidebarCollapsed.value) {
      this.isSidebarCollapsed.next(true);
    }
  }

  toggleSidebar(): void {
    const newState = !this.isSidebarCollapsed.value;
    this.isSidebarCollapsed.next(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  }

  toggleMobileSidebar(state?: boolean): void {
    this.sidebarService.toggleMobileSidebar(state);
  }

  toggleDropdown(index: number): void {
    if (this.isSidebarCollapsed.value && !this.isMobile) {
      this.isSidebarCollapsed.next(false);
      setTimeout(() => {
        this.dropdownIndex = this.dropdownIndex === index ? null : index;
      }, 150);
    } else {
      this.dropdownIndex = this.dropdownIndex === index ? null : index;
    }
  }

  toggleSubDropdown(parentIndex: number, childIndex: number): void {
    const current = this.subDropdownIndex.get(parentIndex);
    this.subDropdownIndex.set(parentIndex, current === childIndex ? null : childIndex);
  }

  toggleGrandSubDropdown(parentIndex: number, childIndex: number, grandChildIndex: number): void {
    if (!this.grandSubDropdownIndex.has(parentIndex)) {
      this.grandSubDropdownIndex.set(parentIndex, new Map());
    }
    const subMap = this.grandSubDropdownIndex.get(parentIndex)!;
    const current = subMap.get(childIndex);
    subMap.set(childIndex, current === grandChildIndex ? null : grandChildIndex);
  }

  toggleDarkMode(): void {
    this.themeService.toggleDarkMode();
  }

  logout(): void {
    this.authService.logout();
  }

  /**
   * Filtra recursivamente el menú según el rol del usuario.
   */
  private filterMenuByRole(items: MenuItem[], role: string | null): MenuItem[] {
    return items
      .filter(item => !item.role || item.role.includes(role!))
      .map(item => ({
        ...item,
        children: item.children ? this.filterMenuByRole(item.children, role) : undefined
      }));
  }
}
