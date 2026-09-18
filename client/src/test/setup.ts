import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom tidak mengimplementasikan scrollTo.
window.scrollTo = (() => {}) as typeof window.scrollTo;

afterEach(() => cleanup());
