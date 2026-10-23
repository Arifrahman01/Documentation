import { POST as uploadHandler } from '../upload/+server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = (event) => uploadHandler(event as any);
