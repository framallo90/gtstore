import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AdminApiService } from './core/admin-api.service';
import { AdminAuthService } from './core/admin-auth.service';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  protected title = 'admin-dashboard';

  public authService = inject(AdminAuthService);
  private readonly api = inject(AdminApiService);

  ngOnInit() {
    // Best-effort session restore if a refresh token cookie exists.
    this.authService.restoreSessionFromHint().subscribe();
  }

  logout() {
    this.api.logout().subscribe({
      next: () => this.authService.logout(),
      error: () => this.authService.logout(),
    });
  }
}
