import {ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withFetch,
  withInterceptorsFromDi
} from '@angular/common/http';
import {AuthInterceptor} from './services/auth-interceptor.interceptor';
import {definePreset} from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import {MessageService} from 'primeng/api';
import {providePrimeNG} from 'primeng/config';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';

const CustomTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50:'#e3f2ec',100:'#b8ddd1',200:'#8cc8b5',300:'#61b399',
      400:'#4a9d83',500:'#348566',600:'#2e755a',700:'#27634d',800:'#205241',900:'#183e31'
    },
    surface: {
      0:'#0f1113',50:'#15181b',100:'#1a1f23',200:'#21272d',300:'#2a3238',
      400:'#364048',500:'#aeb6bc',600:'#c6cdd3',700:'#dbe2e7',800:'#ecf0f3',900:'#ffffff'
    },
    border: { color:'rgba(255,255,255,.12)' },
    colorScheme: {
      // we always run in dark mode → define only dark
      dark: {
        primary: {
          color: '#348566',
          inverseColor: '#0f1113',
          hoverColor: '#2e755a',
          activeColor: '#27634d'
        },
        highlight: {
          background: 'rgba(255,255,255,.10)',
          focusBackground: 'rgba(255,255,255,.16)',
          color: 'rgba(255,255,255,.92)',
          focusColor: 'rgba(255,255,255,.92)'
        },
        text: {
          color: 'rgba(236,240,243,.92)',
          hoverColor: '#8cc8b5'
        }
      }
    }
  },

  components: {
    button: {
      // global button look
      root: {
        borderRadius: '12px',
        paddingX: '1rem',
        paddingY: '0.625rem',
        gap: '0.5rem',
        transitionDuration: '.2s',
        focusRing: { width: '2px' },
      },
      colorScheme: {
        dark: {
          // FILLED (severity="primary")
          root: {
            primary: {
              background: '#348566',
              hoverBackground: '#2e755a',
              activeBackground: '#27634d',
              color: '#ffffff',
            },
            // neutral/secondary filled (great for “Add Sources” if not outlined)
            secondary: {
              background: 'rgba(255,255,255,.06)',
              color: 'rgba(255,255,255,.92)',
              borderColor: 'rgba(255,255,255,.10)',
              hoverBackground: 'rgba(255,255,255,.10)',
              activeBackground: 'rgba(255,255,255,.12)'
            }
          },

          // OUTLINED
          outlined: {
            primary: {
              color: '#8cc8b5',
              borderColor: 'rgba(140,200,181,.65)',
              hoverBackground: 'rgba(140,200,181,.12)',
              activeBackground: 'rgba(140,200,181,.18)'
            },
            plain: {
              color: 'rgba(236,240,243,.92)',
              borderColor: 'rgba(255,255,255,.14)',
              hoverBackground: 'rgba(255,255,255,.08)'
            }
          },

          // TEXT / LINK
          text: {
            primary: { color: '#8cc8b5', hoverBackground: 'rgba(140,200,181,.08)' },
            plain:   { color: 'rgba(236,240,243,.80)', hoverBackground: 'rgba(255,255,255,.06)' }
          },
          link: { color: '#8cc8b5', hoverColor: '#b8ddd1' }
        }
      }
    }
  }
});

export const appConfig: ApplicationConfig = {
  providers: [
    MessageService,
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: CustomTheme,
        options: {
          darkModeSelector: '.dark'
        }
      }
    }),
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(withFetch(), withInterceptorsFromDi()),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }]
};
