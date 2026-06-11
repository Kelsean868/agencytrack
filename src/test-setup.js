import { expect, afterEach } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { configure } from '@testing-library/dom';

expect.extend(matchers);
afterEach(cleanup);

// CI runner resource contention means the default 1000ms waitFor/findBy* budget is
// too tight for the useEffect→setState→re-render chain under parallel full-suite load.
// 5000ms is grounded in WizardFormV2RetirementR2's validated worst-case (12-step mount).
configure({ asyncUtilTimeout: 5000 });
