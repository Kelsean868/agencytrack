import * as React from 'react';

/**
 * Gold-tint callout band — for recognition, awards and important notes.
 * Gold is reserved for recognition content; don't use for generic info.
 */
export interface CalloutProps {
  style?: React.CSSProperties;
  children?: React.ReactNode;
}
export declare function Callout(props: CalloutProps): JSX.Element;
