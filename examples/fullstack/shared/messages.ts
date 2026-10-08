/**
 * Message catalogs used by both sides: the server renders pages in the
 * negotiated locale, the browser formats client-side messages (validation,
 * relative times) with the same keys.
 */

import { defineMessages } from '../../../src/i18n/index';

export const messages = defineMessages({
  en: {
    app: { title: 'bQuery Notes', language: 'Language' },
    login: {
      heading: 'Sign in',
      email: 'Email',
      password: 'Password',
      submit: 'Sign in',
      failed: 'Wrong email or password.',
      hint: 'Demo account: ada@example.com / lovelace',
    },
    notes: {
      heading: 'Your notes',
      count: '{count, plural, =0 {No notes yet} one {# note} other {# notes}}',
      title: 'Title',
      body: 'Text',
      add: 'Add note',
      remove: 'Delete',
      draftSaved: 'Draft saved on this device',
      signOut: 'Sign out',
      back: 'All notes',
      notFound: 'This note does not exist.',
    },
    validation: {
      object: 'Invalid input.',
      titleRequired: 'Give the note a title.',
      titleTooLong: 'Keep the title under 80 characters.',
      bodyTooLong: 'Keep the text under 2,000 characters.',
      emailRequired: 'Enter your email.',
      passwordRequired: 'Enter your password.',
    },
  },
  de: {
    app: { title: 'bQuery Notizen', language: 'Sprache' },
    login: {
      heading: 'Anmelden',
      email: 'E-Mail',
      password: 'Passwort',
      submit: 'Anmelden',
      failed: 'E-Mail oder Passwort ist falsch.',
      hint: 'Demo-Konto: ada@example.com / lovelace',
    },
    notes: {
      heading: 'Deine Notizen',
      count: '{count, plural, =0 {Noch keine Notizen} one {# Notiz} other {# Notizen}}',
      title: 'Titel',
      body: 'Text',
      add: 'Notiz hinzufügen',
      remove: 'Löschen',
      draftSaved: 'Entwurf auf diesem Gerät gespeichert',
      signOut: 'Abmelden',
      back: 'Alle Notizen',
      notFound: 'Diese Notiz gibt es nicht.',
    },
    validation: {
      object: 'Ungültige Eingabe.',
      titleRequired: 'Gib der Notiz einen Titel.',
      titleTooLong: 'Der Titel darf höchstens 80 Zeichen haben.',
      bodyTooLong: 'Der Text darf höchstens 2.000 Zeichen haben.',
      emailRequired: 'Gib deine E-Mail ein.',
      passwordRequired: 'Gib dein Passwort ein.',
    },
  },
});

export const LOCALES = ['en', 'de'] as const;
export type Locale = (typeof LOCALES)[number];
