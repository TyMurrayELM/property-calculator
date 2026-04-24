import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * Parse a JSON request body against a zod schema. On failure, returns a
 * 400 response with the zod issues; on success, returns the typed data.
 *
 * Usage:
 *   const parsed = await parseJson(request, MySchema);
 *   if (!parsed.ok) return parsed.error;
 *   const { data } = parsed; // typed as z.infer<typeof MySchema>
 */
export async function parseJson<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; error: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: 'Invalid request body', details: result.error.issues },
        { status: 400 }
      ),
    };
  }
  return { ok: true, data: result.data };
}
