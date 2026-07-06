import * as React from 'react';

/**
 * Persistent inline error with Retry — never a toast. A load failure must stay
 * on screen with a way to recover; reassure that work is safe. For field-level
 * validation, associate the message with the input via aria-describedby instead.
 */
export interface ErrorStateProps {
  /** @default "Couldn't load this view" */
  title?: string;
  /** Reassuring one/two-line body. */
  body?: string;
  /** Retry handler; the button only renders when provided. */
  onRetry?: () => void;
  /** @default 'Retry' */
  retryLabel?: string;
}
export declare function ErrorState(props: ErrorStateProps): JSX.Element;
