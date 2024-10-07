/// <reference types="@sveltejs/kit" />

// See https://kit.svelte.dev/docs/types#the-app-namespace
// for information about these interfaces
declare namespace App {
  // interface Locals {}
  // interface Platform {}
  // interface Session {}
  // interface Stuff {}
}

declare global {
  interface HTMLElement {
    scrollIntoViewIfNeeded(arg?: boolean): void;
  }
  interface Navigator {
    msMaxTouchPoints: number;
    standalone: boolean | undefined;
  }
}

export {};
