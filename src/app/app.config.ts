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
      50:  '#e3f2ec',
      100: '#b8ddd1',
      200: '#8cc8b5',
      300: '#61b399',
      400: '#4a9d83',
      500: '#348566', // logo color
      600: '#2e755a',
      700: '#27634d',
      800: '#205241',
      900: '#183e31'
    },
    surface: {
      0:   '#111111',   // navbar background / base dark - CHANGED FROM #171717
      50:  '#202020',
      100: '#2d2d2d',
      200: '#545454',
      300: '#5e5e5e',
      400: '#7a7a7a',
      500: '#ababab',   // text color
      600: '#b8b8b8',
      700: '#e8e8e8',
      800: '#ededed',
      900: '#ffffff'    // personColor
    },
    border: {
      color: 'rgba(255,255,255,0.2)' // border-color
    },
    colorScheme: {
      light: {
        primary: {
          color: '#348566',
          inverseColor: '#ffffff',
          hoverColor: '#2e755a',
          activeColor: '#27634d'
        },
        highlight: {
          background: '#348566',
          focusBackground: '#27634d',
          color: '#ffffff',
          focusColor: '#ffffff'
        },
        text: {
          color: 'rgb(171,171,171)', // text-color
          hoverColor: '#348566'
        }
      },
      dark: {
        primary: {
          color: '#348566',
          inverseColor: '#111111',
          hoverColor: '#61b399',
          activeColor: '#8cc8b5'
        },
        highlight: {
          background: 'rgba(250, 250, 250, .16)',
          focusBackground: 'rgba(250, 250, 250, .24)',
          color: 'rgba(255,255,255,.87)',
          focusColor: 'rgba(255,255,255,.87)'
        },
        text: {
          color: 'rgb(171,171,171)',
          hoverColor: '#61b399'
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
