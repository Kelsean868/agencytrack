import React, { useContext } from 'react';
import { HarnessFrameContext, framedClass } from './harnessFrame';

/**
 * ScenePage — the page wrapper every harness scene draws around its View.
 *
 * Frameless (the default), it is the scene's own page: centred, capped and
 * padded as before. Inside the app frame (`?frame=app`, W-1 width sweep) the
 * real `.shell-content` already supplies the page padding, so the wrapper
 * drops its centring, max-width, fixed width and padding and keeps only its
 * flow classes (flex, gap). The view then gets exactly the width it gets in
 * the app — no more, no less.
 */
export default function ScenePage({ as = 'main', className = '', children }) {
  const framed = useContext(HarnessFrameContext);
  // Framed: a plain div — the app frame already owns the one <main> landmark.
  const Tag = framed ? 'div' : as;
  return <Tag className={framed ? framedClass(className) : className}>{children}</Tag>;
}
